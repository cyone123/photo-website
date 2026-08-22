import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { and, eq, isNull, max } from "drizzle-orm";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photoVariants, photos } from "@/db/schema";
import { getR2Buckets, putR2Object } from "@/storage/r2";
import { inspectPhotoBuffer, type InspectedPhotoBuffer } from "./inspect-photo";
import { originalObjectKey, publicVariantObjectKey } from "./object-key";
import { resolvePhotoLocation, type PhotoLocation } from "./photo-location";
import { generatePhotoBlurhash, generatePublicVariants } from "./variants";

type PhotoRecord = typeof photos.$inferSelect;
type GeneratedVariants = Awaited<ReturnType<typeof generatePublicVariants>>;

export interface ProcessPhotoSourceInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType?: string;
  reservedPhotoId?: string;
  albumId?: string;
  title?: string | null;
  replaceTitle?: boolean;
  force?: boolean;
  sourceLabel?: string;
}

export interface ProcessPhotoSourceResult {
  status: "processed" | "skipped";
  photoId: string;
  variantCount: number;
}

export interface ProcessInspectedPhotoInput {
  inspection: InspectedPhotoBuffer;
  reservedPhotoId?: string;
  albumId?: string;
  title?: string | null;
  replaceTitle?: boolean;
  force?: boolean;
}

export interface PreparePhotoRecordInput {
  inspection: InspectedPhotoBuffer;
  location: PhotoLocation;
  title: string | null;
  replaceTitle?: boolean;
  force?: boolean;
  reservedPhotoId?: string;
}

export interface PreparedPhotoRecord {
  photo: PhotoRecord;
  alreadyReady: boolean;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function titleUpdate(
  currentTitle: string | null,
  nextTitle: string | null,
  replaceExisting: boolean,
) {
  return nextTitle && (replaceExisting || !currentTitle) ? { title: nextTitle } : {};
}

function locationUpdate(current: PhotoRecord, next: PhotoLocation) {
  return {
    ...(next.city && !current.locationCity ? { locationCity: next.city } : {}),
    ...(next.district && !current.locationDistrict ? { locationDistrict: next.district } : {}),
  };
}

function resolvedPhotoTitle(originalFilename: string, requestedTitle?: string | null) {
  if (requestedTitle === null) {
    return null;
  }

  if (requestedTitle !== undefined) {
    const title = requestedTitle.trim();

    if (!title) {
      throw new Error("Photo title cannot be empty.");
    }

    return title;
  }

  const title = path.parse(originalFilename).name.trim();
  return title || null;
}

async function updatePreparedPhoto(
  photo: PhotoRecord,
  input: PreparePhotoRecordInput,
): Promise<PreparedPhotoRecord> {
  const db = getDb();
  const force = input.force ?? false;
  const replaceTitle = input.replaceTitle ?? false;

  if (photo.status === "READY" && !force) {
    const updateValues = {
      ...titleUpdate(photo.title, input.title, replaceTitle),
      ...locationUpdate(photo, input.location),
    };

    if (Object.keys(updateValues).length === 0) {
      return { photo, alreadyReady: true };
    }

    const [updated] = await db
      .update(photos)
      .set({ ...updateValues, updatedAt: new Date() })
      .where(eq(photos.id, photo.id))
      .returning();

    return { photo: updated, alreadyReady: true };
  }

  const [updated] = await db
    .update(photos)
    .set({
      status: "PROCESSING",
      failureMessage: null,
      ...titleUpdate(photo.title, input.title, replaceTitle),
      ...locationUpdate(photo, input.location),
      updatedAt: new Date(),
    })
    .where(eq(photos.id, photo.id))
    .returning();

  return { photo: updated, alreadyReady: false };
}

export async function preparePhotoRecord(
  input: PreparePhotoRecordInput,
): Promise<PreparedPhotoRecord> {
  const db = getDb();
  const contentHash = sha256(input.inspection.buffer);
  const existing = await db
    .select()
    .from(photos)
    .where(eq(photos.contentHash, contentHash))
    .limit(1);

  if (existing[0]) {
    return updatePreparedPhoto(existing[0], input);
  }

  const id = input.reservedPhotoId ?? randomUUID();
  const now = new Date();
  const values = {
    id,
    contentHash,
    status: "PROCESSING" as const,
    originalKey: originalObjectKey(id, input.inspection.sourceExtension),
    width: input.inspection.width,
    height: input.inspection.height,
    takenAt: input.inspection.takenAt,
    takenAtOffsetMinutes: input.inspection.takenAtOffsetMinutes,
    cameraMake: input.inspection.cameraMake,
    cameraModel: input.inspection.cameraModel,
    lensModel: input.inspection.lensModel,
    focalLengthMm: input.inspection.focalLengthMm?.toString() ?? null,
    aperture: input.inspection.aperture?.toString() ?? null,
    exposureTimeSeconds: input.inspection.exposureTimeSeconds?.toString() ?? null,
    iso: input.inspection.iso,
    latitude: input.inspection.latitude?.toString() ?? null,
    longitude: input.inspection.longitude?.toString() ?? null,
    locationCity: input.location.city,
    locationDistrict: input.location.district,
    rawExif: input.inspection.rawExif,
    title: input.title,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const [inserted] = await db.insert(photos).values(values).returning();
    return { photo: inserted, alreadyReady: false };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const raced = await db
      .select()
      .from(photos)
      .where(eq(photos.contentHash, contentHash))
      .limit(1);

    if (!raced[0]) {
      throw error;
    }

    return updatePreparedPhoto(raced[0], input);
  }
}

async function uploadOriginal(photo: PhotoRecord, source: InspectedPhotoBuffer) {
  const { privateBucket } = getR2Buckets();

  await putR2Object({
    bucket: privateBucket,
    key: photo.originalKey,
    body: source.buffer,
    contentType: source.mimeType,
    cacheControl: "private, no-store",
  });
}

async function uploadPublicVariants(photoId: string, variants: GeneratedVariants) {
  const { publicBucket } = getR2Buckets();

  for (const variant of variants) {
    await putR2Object({
      bucket: publicBucket,
      key: publicVariantObjectKey(photoId, variant.targetWidth, variant.format),
      body: variant.buffer,
      contentType: variant.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    });
  }
}

async function saveVariants(photoId: string, variants: GeneratedVariants) {
  const db = getDb();

  for (const variant of variants) {
    await db
      .insert(photoVariants)
      .values({
        photoId,
        width: variant.width,
        height: variant.height,
        format: variant.format,
        mimeType: variant.mimeType,
        objectKey: publicVariantObjectKey(photoId, variant.targetWidth, variant.format),
        byteSize: variant.byteSize,
      })
      .onConflictDoUpdate({
        target: [photoVariants.photoId, photoVariants.width, photoVariants.format],
        set: {
          height: variant.height,
          mimeType: variant.mimeType,
          objectKey: publicVariantObjectKey(photoId, variant.targetWidth, variant.format),
          byteSize: variant.byteSize,
        },
      });
  }
}

export async function generateAndUploadVariants(photo: PhotoRecord, source: InspectedPhotoBuffer) {
  const [variants, blurhash] = await Promise.all([
    generatePublicVariants(source.buffer, Math.max(source.width, source.height)),
    generatePhotoBlurhash(source.buffer),
  ]);

  await uploadOriginal(photo, source);
  await uploadPublicVariants(photo.id, variants);
  await saveVariants(photo.id, variants);

  return { blurhash, variantCount: variants.length };
}

export async function markPhotoReady(photoId: string, blurhash: string) {
  await getDb()
    .update(photos)
    .set({ status: "READY", blurhash, failureMessage: null, updatedAt: new Date() })
    .where(eq(photos.id, photoId));
}

export async function markPhotoFailed(photoId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  try {
    await getDb()
      .update(photos)
      .set({ status: "FAILED", failureMessage: message.slice(0, 1000), updatedAt: new Date() })
      .where(eq(photos.id, photoId));
  } catch {
    // Preserve the original processing error when the database is unavailable too.
  }
}

export async function linkPhotoToAlbum(albumId: string, photoId: string) {
  const db = getDb();
  const album = await db.query.albums.findFirst({ where: eq(albums.id, albumId) });

  if (!album) {
    throw new Error(`Album not found: ${albumId}`);
  }

  const existing = await db
    .select()
    .from(albumPhotos)
    .where(and(eq(albumPhotos.albumId, album.id), eq(albumPhotos.photoId, photoId)))
    .limit(1);

  if (existing[0]) {
    return;
  }

  const lastPosition = await db
    .select({ value: max(albumPhotos.sortOrder) })
    .from(albumPhotos)
    .where(eq(albumPhotos.albumId, album.id));
  const sortOrder = Number(lastPosition[0]?.value ?? -1) + 1;

  await db
    .insert(albumPhotos)
    .values({
      albumId: album.id,
      photoId,
      sortOrder,
    })
    .onConflictDoNothing({ target: [albumPhotos.albumId, albumPhotos.photoId] });

  if (album.coverPhotoId === null) {
    await db
      .update(albums)
      .set({ coverPhotoId: photoId, updatedAt: new Date() })
      .where(and(eq(albums.id, album.id), isNull(albums.coverPhotoId)));
  }
}

export async function processPhotoSource(
  input: ProcessPhotoSourceInput,
): Promise<ProcessPhotoSourceResult> {
  const inspection = await inspectPhotoBuffer(input.buffer, {
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sourceLabel: input.sourceLabel,
  });
  return processInspectedPhotoSource({
    inspection,
    reservedPhotoId: input.reservedPhotoId,
    albumId: input.albumId,
    title: input.title,
    replaceTitle: input.replaceTitle,
    force: input.force,
  });
}

export async function processInspectedPhotoSource(
  input: ProcessInspectedPhotoInput,
): Promise<ProcessPhotoSourceResult> {
  const { inspection } = input;
  const title = resolvedPhotoTitle(inspection.originalFilename, input.title);
  const location = await resolvePhotoLocation(inspection);
  const prepared = await preparePhotoRecord({
    inspection,
    location,
    title,
    replaceTitle: input.replaceTitle,
    force: input.force,
    reservedPhotoId: input.reservedPhotoId,
  });

  if (prepared.alreadyReady) {
    if (input.albumId) {
      await linkPhotoToAlbum(input.albumId, prepared.photo.id);
    }

    return {
      status: "skipped",
      photoId: prepared.photo.id,
      variantCount: 0,
    };
  }

  try {
    const generated = await generateAndUploadVariants(prepared.photo, inspection);
    await markPhotoReady(prepared.photo.id, generated.blurhash);

    if (input.albumId) {
      await linkPhotoToAlbum(input.albumId, prepared.photo.id);
    }

    return {
      status: "processed",
      photoId: prepared.photo.id,
      variantCount: generated.variantCount,
    };
  } catch (error) {
    await markPhotoFailed(prepared.photo.id, error);
    throw error;
  }
}

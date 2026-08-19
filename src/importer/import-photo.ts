import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, max } from "drizzle-orm";
import { readImportEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photoVariants, photos } from "@/db/schema";
import { originalObjectKey, publicVariantObjectKey } from "@/importer/object-key";
import { inspectPhotoFile, type InspectedPhoto } from "@/importer/inspect-image";
import { generatePublicVariants } from "@/importer/variants";
import { getR2Buckets, putR2Object } from "@/storage/r2";

type PhotoRecord = typeof photos.$inferSelect;
type AlbumRecord = typeof albums.$inferSelect;

export interface ImportPhotoOptions {
  filePath: string;
  albumSlug: string;
  albumTitle?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface ImportPhotoResult {
  status: "imported" | "skipped" | "dry-run";
  filePath: string;
  photoId?: string;
  variantCount: number;
  albumSlug: string;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeAlbumSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Album slug cannot be empty.");
  }

  return slug;
}

async function ensureAlbum(slug: string, title?: string): Promise<AlbumRecord> {
  const db = getDb();
  const existing = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const now = new Date();
  const albumValues = {
    id: randomUUID(),
    slug,
    title: title?.trim() || titleFromSlug(slug),
    status: "PUBLISHED" as const,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const inserted = await db.insert(albums).values(albumValues).returning();
    return inserted[0];
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const raced = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);

    if (!raced[0]) {
      throw error;
    }

    return raced[0];
  }
}

async function preparePhoto(photo: InspectedPhoto, force: boolean) {
  const db = getDb();
  const contentHash = sha256(photo.buffer);
  const existing = await db
    .select()
    .from(photos)
    .where(eq(photos.contentHash, contentHash))
    .limit(1);

  if (existing[0]) {
    if (existing[0].status === "READY" && !force) {
      return { photo: existing[0], alreadyReady: true };
    }

    const [updated] = await db
      .update(photos)
      .set({ status: "PROCESSING", failureMessage: null, updatedAt: new Date() })
      .where(eq(photos.id, existing[0].id))
      .returning();

    return { photo: updated, alreadyReady: false };
  }

  const id = randomUUID();
  const values = {
    id,
    contentHash,
    status: "PROCESSING" as const,
    originalKey: originalObjectKey(id, photo.sourceExtension),
    width: photo.width,
    height: photo.height,
    takenAt: photo.takenAt,
    takenAtOffsetMinutes: photo.takenAtOffsetMinutes,
    cameraMake: photo.cameraMake,
    cameraModel: photo.cameraModel,
    lensModel: photo.lensModel,
    focalLengthMm: photo.focalLengthMm?.toString() ?? null,
    aperture: photo.aperture?.toString() ?? null,
    exposureTimeSeconds: photo.exposureTimeSeconds?.toString() ?? null,
    iso: photo.iso,
    latitude: photo.latitude?.toString() ?? null,
    longitude: photo.longitude?.toString() ?? null,
    rawExif: photo.rawExif,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const inserted = await db.insert(photos).values(values).returning();
    return { photo: inserted[0], alreadyReady: false };
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

    if (raced[0].status === "READY" && !force) {
      return { photo: raced[0], alreadyReady: true };
    }

    const [updated] = await db
      .update(photos)
      .set({ status: "PROCESSING", failureMessage: null, updatedAt: new Date() })
      .where(eq(photos.id, raced[0].id))
      .returning();

    return { photo: updated, alreadyReady: false };
  }
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function uploadAssets(
  photo: PhotoRecord,
  source: InspectedPhoto,
  variants: Awaited<ReturnType<typeof generatePublicVariants>>,
) {
  const buckets = getR2Buckets();

  await putR2Object({
    bucket: buckets.privateBucket,
    key: photo.originalKey,
    body: source.buffer,
    contentType: source.mimeType,
    cacheControl: "private, no-store",
  });

  for (const variant of variants) {
    await putR2Object({
      bucket: buckets.publicBucket,
      key: publicVariantObjectKey(photo.id, variant.targetWidth),
      body: variant.buffer,
      contentType: variant.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    });
  }
}

async function saveVariants(
  photoId: string,
  variants: Awaited<ReturnType<typeof generatePublicVariants>>,
) {
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
        objectKey: publicVariantObjectKey(photoId, variant.targetWidth),
        byteSize: variant.byteSize,
      })
      .onConflictDoUpdate({
        target: [photoVariants.photoId, photoVariants.width, photoVariants.format],
        set: {
          height: variant.height,
          mimeType: variant.mimeType,
          objectKey: publicVariantObjectKey(photoId, variant.targetWidth),
          byteSize: variant.byteSize,
        },
      });
  }
}

async function markPhotoReady(photoId: string) {
  await getDb()
    .update(photos)
    .set({ status: "READY", failureMessage: null, updatedAt: new Date() })
    .where(eq(photos.id, photoId));
}

async function markPhotoFailed(photoId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  try {
    await getDb()
      .update(photos)
      .set({ status: "FAILED", failureMessage: message.slice(0, 1000), updatedAt: new Date() })
      .where(eq(photos.id, photoId));
  } catch {
    // Preserve the original import error when the database is unavailable too.
  }
}

async function linkPhotoToAlbum(album: AlbumRecord, photoId: string) {
  const db = getDb();
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

  await db.insert(albumPhotos).values({
    albumId: album.id,
    photoId,
    sortOrder,
  });

  if (album.coverPhotoId === null) {
    await db
      .update(albums)
      .set({ coverPhotoId: photoId, updatedAt: new Date() })
      .where(and(eq(albums.id, album.id), isNull(albums.coverPhotoId)));
  }
}

export async function dryRunPhotoImport(options: ImportPhotoOptions): Promise<ImportPhotoResult> {
  const source = await inspectPhotoFile(options.filePath);
  const variants = await generatePublicVariants(
    source.buffer,
    Math.max(source.width, source.height),
  );

  return {
    status: "dry-run",
    filePath: source.filePath,
    variantCount: variants.length,
    albumSlug: options.albumSlug,
  };
}

export async function importPhoto(options: ImportPhotoOptions): Promise<ImportPhotoResult> {
  const source = await inspectPhotoFile(options.filePath);

  if (options.dryRun) {
    return dryRunPhotoImport(options);
  }

  readImportEnv();
  const albumSlug = normalizeAlbumSlug(options.albumSlug);
  const album = await ensureAlbum(albumSlug, options.albumTitle);
  const prepared = await preparePhoto(source, options.force ?? false);

  if (prepared.alreadyReady) {
    await linkPhotoToAlbum(album, prepared.photo.id);

    return {
      status: "skipped",
      filePath: source.filePath,
      photoId: prepared.photo.id,
      variantCount: 0,
      albumSlug,
    };
  }

  const variants = await generatePublicVariants(
    source.buffer,
    Math.max(source.width, source.height),
  );

  try {
    await uploadAssets(prepared.photo, source, variants);
    await saveVariants(prepared.photo.id, variants);
    await markPhotoReady(prepared.photo.id);
  } catch (error) {
    await markPhotoFailed(prepared.photo.id, error);
    throw error;
  }

  await linkPhotoToAlbum(album, prepared.photo.id);

  return {
    status: "imported",
    filePath: source.filePath,
    photoId: prepared.photo.id,
    variantCount: variants.length,
    albumSlug,
  };
}

import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { and, eq, isNull, max, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photoVariants, photos } from "@/db/schema";
import { ORIGINAL_UPLOAD_CACHE_CONTROL } from "@/lib/uploads";
import { logDuration, startTimer } from "@/server/performance-log";
import { copyR2Object, getR2Buckets, putR2Object } from "@/storage/r2";
import { inspectPhotoBuffer, type InspectedPhotoBuffer } from "./inspect-photo";
import { originalObjectKey, publicVariantObjectKey } from "./object-key";
import {
  embeddedPhotoLocation,
  hasPhotoCoordinates,
  isPhotoLocationEnabled,
  resolvePhotoLocation,
  type PhotoLocation,
} from "./photo-location";
import { PUBLIC_VARIANT_UPLOAD_CONCURRENCY } from "./variant-config";
import { generatePhotoBlurhash, generatePublicVariants } from "./variants";

type PhotoRecord = typeof photos.$inferSelect;
type GeneratedVariants = Awaited<ReturnType<typeof generatePublicVariants>>;

const albumLinkTails = new Map<string, Promise<void>>();

export type BackgroundTaskScheduler = (task: () => Promise<void>) => void;

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
  storedOriginal?: StoredOriginalSource;
  scheduleBackgroundTask?: BackgroundTaskScheduler;
}

export interface StoredOriginalSource {
  objectKey: string;
  etag?: string;
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
  storedOriginal?: StoredOriginalSource;
  scheduleBackgroundTask?: BackgroundTaskScheduler;
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

async function enrichPhotoLocation(photo: PhotoRecord, inspection: InspectedPhotoBuffer) {
  const startedAt = startTimer();

  try {
    const location = await resolvePhotoLocation(inspection);
    const updateValues = locationUpdate(photo, location);

    if (Object.keys(updateValues).length > 0) {
      await getDb()
        .update(photos)
        .set({ ...updateValues, updatedAt: new Date() })
        .where(eq(photos.id, photo.id));
    }

    logDuration(
      "photo.process.stage",
      {
        photoId: photo.id,
        filename: inspection.originalFilename,
        stage: "location_enrichment",
        updated: Object.keys(updateValues).length > 0,
      },
      startedAt,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "photo.location_enrichment_failed",
        photoId: photo.id,
        filename: inspection.originalFilename,
        message: error instanceof Error ? error.message : String(error),
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

function schedulePhotoLocationEnrichment(
  photo: PhotoRecord,
  inspection: InspectedPhotoBuffer,
  scheduleBackgroundTask?: BackgroundTaskScheduler,
) {
  if (
    !isPhotoLocationEnabled() ||
    !hasPhotoCoordinates(inspection) ||
    (photo.locationCity !== null && photo.locationDistrict !== null)
  ) {
    return;
  }

  const task = () => enrichPhotoLocation(photo, inspection);

  if (scheduleBackgroundTask) {
    scheduleBackgroundTask(task);
  } else {
    void task();
  }
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

async function withAlbumLinkLock<T>(albumId: string, task: () => Promise<T>) {
  const previous = albumLinkTails.get(albumId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  albumLinkTails.set(albumId, current);

  try {
    await previous;
    return await task();
  } finally {
    release();

    if (albumLinkTails.get(albumId) === current) {
      albumLinkTails.delete(albumId);
    }
  }
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
    cacheControl: ORIGINAL_UPLOAD_CACHE_CONTROL,
  });
}

async function persistOriginal(
  photo: PhotoRecord,
  source: InspectedPhotoBuffer,
  storedOriginal?: StoredOriginalSource,
) {
  if (!storedOriginal) {
    await uploadOriginal(photo, source);
    return;
  }

  if (storedOriginal.objectKey === photo.originalKey) {
    return;
  }

  const { privateBucket } = getR2Buckets();
  await copyR2Object({
    bucket: privateBucket,
    sourceKey: storedOriginal.objectKey,
    destinationKey: photo.originalKey,
    sourceEtag: storedOriginal.etag,
    contentType: source.mimeType,
    cacheControl: ORIGINAL_UPLOAD_CACHE_CONTROL,
  });
}

async function runWithConcurrency(tasks: Array<() => Promise<void>>, concurrency: number) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      await tasks[taskIndex]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), tasks.length) }, () => worker()),
  );
}

async function uploadR2Artifacts(
  photo: PhotoRecord,
  source: InspectedPhotoBuffer,
  variants: GeneratedVariants,
  storedOriginal?: StoredOriginalSource,
) {
  const { publicBucket } = getR2Buckets();
  const tasks = [
    () => persistOriginal(photo, source, storedOriginal),
    ...variants.map(
      (variant) => () =>
        putR2Object({
          bucket: publicBucket,
          key: publicVariantObjectKey(photo.id, variant.targetWidth, variant.format),
          body: variant.buffer,
          contentType: variant.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
        }),
    ),
  ];

  await runWithConcurrency(tasks, PUBLIC_VARIANT_UPLOAD_CONCURRENCY);
}

async function saveVariants(photoId: string, variants: GeneratedVariants) {
  const db = getDb();

  if (variants.length === 0) {
    return;
  }

  await db
    .insert(photoVariants)
    .values(
      variants.map((variant) => ({
        photoId,
        width: variant.width,
        height: variant.height,
        format: variant.format,
        mimeType: variant.mimeType,
        objectKey: publicVariantObjectKey(photoId, variant.targetWidth, variant.format),
        byteSize: variant.byteSize,
      })),
    )
    .onConflictDoUpdate({
      target: [photoVariants.photoId, photoVariants.width, photoVariants.format],
      set: {
        height: sql`excluded.height`,
        mimeType: sql`excluded.mime_type`,
        objectKey: sql`excluded.object_key`,
        byteSize: sql`excluded.byte_size`,
      },
    });
}

export async function generateAndUploadVariants(
  photo: PhotoRecord,
  source: InspectedPhotoBuffer,
  storedOriginal?: StoredOriginalSource,
) {
  const generationStartedAt = startTimer();
  const [variants, blurhash] = await Promise.all([
    generatePublicVariants(source.buffer, Math.max(source.width, source.height)),
    generatePhotoBlurhash(source.buffer),
  ]);
  logDuration(
    "photo.process.stage",
    {
      photoId: photo.id,
      filename: source.originalFilename,
      stage: "generate_variants",
      variantCount: variants.length,
    },
    generationStartedAt,
  );

  const uploadStartedAt = startTimer();
  await uploadR2Artifacts(photo, source, variants, storedOriginal);
  logDuration(
    "photo.process.stage",
    {
      photoId: photo.id,
      filename: source.originalFilename,
      stage: "r2_uploads",
      variantCount: variants.length,
      concurrency: PUBLIC_VARIANT_UPLOAD_CONCURRENCY,
    },
    uploadStartedAt,
  );

  const saveStartedAt = startTimer();
  await saveVariants(photo.id, variants);
  logDuration(
    "photo.process.stage",
    {
      photoId: photo.id,
      filename: source.originalFilename,
      stage: "save_variants",
      variantCount: variants.length,
    },
    saveStartedAt,
  );

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
  return withAlbumLinkLock(albumId, async () => {
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
  });
}

export async function processPhotoSource(
  input: ProcessPhotoSourceInput,
): Promise<ProcessPhotoSourceResult> {
  const inspectionStartedAt = startTimer();
  const inspection = await inspectPhotoBuffer(input.buffer, {
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sourceLabel: input.sourceLabel,
  });
  logDuration(
    "photo.process.stage",
    {
      filename: inspection.originalFilename,
      stage: "inspect",
      width: inspection.width,
      height: inspection.height,
    },
    inspectionStartedAt,
  );
  return processInspectedPhotoSource({
    inspection,
    reservedPhotoId: input.reservedPhotoId,
    albumId: input.albumId,
    title: input.title,
    replaceTitle: input.replaceTitle,
    force: input.force,
    storedOriginal: input.storedOriginal,
    scheduleBackgroundTask: input.scheduleBackgroundTask,
  });
}

export async function processInspectedPhotoSource(
  input: ProcessInspectedPhotoInput,
): Promise<ProcessPhotoSourceResult> {
  const totalStartedAt = startTimer();
  const { inspection } = input;
  const title = resolvedPhotoTitle(inspection.originalFilename, input.title);
  // Only embedded EXIF location is needed while hashing and deduplicating.
  // Reverse geocoding is scheduled after the photo is ready, so duplicates never wait on it.
  const location = embeddedPhotoLocation(inspection);
  const prepareStartedAt = startTimer();
  const prepared = await preparePhotoRecord({
    inspection,
    location,
    title,
    replaceTitle: input.replaceTitle,
    force: input.force,
    reservedPhotoId: input.reservedPhotoId,
  });
  logDuration(
    "photo.process.stage",
    {
      photoId: prepared.photo.id,
      filename: inspection.originalFilename,
      stage: "prepare_record",
      alreadyReady: prepared.alreadyReady,
    },
    prepareStartedAt,
  );

  if (prepared.alreadyReady) {
    const albumStartedAt = input.albumId ? startTimer() : null;

    if (input.albumId) {
      await linkPhotoToAlbum(input.albumId, prepared.photo.id);
    }

    if (albumStartedAt !== null) {
      logDuration(
        "photo.process.stage",
        {
          photoId: prepared.photo.id,
          filename: inspection.originalFilename,
          stage: "link_album",
        },
        albumStartedAt,
      );
    }

    schedulePhotoLocationEnrichment(prepared.photo, inspection, input.scheduleBackgroundTask);
    logDuration(
      "photo.process.total",
      {
        photoId: prepared.photo.id,
        filename: inspection.originalFilename,
        status: "skipped",
      },
      totalStartedAt,
    );

    return {
      status: "skipped",
      photoId: prepared.photo.id,
      variantCount: 0,
    };
  }

  try {
    const generateStartedAt = startTimer();
    const generated = await generateAndUploadVariants(
      prepared.photo,
      inspection,
      input.storedOriginal,
    );
    logDuration(
      "photo.process.stage",
      {
        photoId: prepared.photo.id,
        filename: inspection.originalFilename,
        stage: "generate_and_upload",
        variantCount: generated.variantCount,
      },
      generateStartedAt,
    );

    const readyStartedAt = startTimer();
    await markPhotoReady(prepared.photo.id, generated.blurhash);
    logDuration(
      "photo.process.stage",
      {
        photoId: prepared.photo.id,
        filename: inspection.originalFilename,
        stage: "mark_ready",
      },
      readyStartedAt,
    );

    const albumStartedAt = input.albumId ? startTimer() : null;

    if (input.albumId) {
      await linkPhotoToAlbum(input.albumId, prepared.photo.id);
    }

    if (albumStartedAt !== null) {
      logDuration(
        "photo.process.stage",
        {
          photoId: prepared.photo.id,
          filename: inspection.originalFilename,
          stage: "link_album",
        },
        albumStartedAt,
      );
    }

    schedulePhotoLocationEnrichment(prepared.photo, inspection, input.scheduleBackgroundTask);
    logDuration(
      "photo.process.total",
      {
        photoId: prepared.photo.id,
        filename: inspection.originalFilename,
        status: "processed",
        variantCount: generated.variantCount,
      },
      totalStartedAt,
    );

    return {
      status: "processed",
      photoId: prepared.photo.id,
      variantCount: generated.variantCount,
    };
  } catch (error) {
    await markPhotoFailed(prepared.photo.id, error);
    console.error(
      JSON.stringify({
        level: "error",
        event: "photo.process.failed",
        photoId: prepared.photo.id,
        filename: inspection.originalFilename,
        message: error instanceof Error ? error.message : String(error),
        durationMs: Math.max(0, Math.round(performance.now() - totalStartedAt)),
        timestamp: new Date().toISOString(),
      }),
    );
    throw error;
  }
}

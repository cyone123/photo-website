import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { albums, photos, photoUploads } from "@/db/schema";
import {
  isAcceptedUploadFile,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  ORIGINAL_UPLOAD_CACHE_CONTROL,
  type InitializedUpload,
  type UploadTaskView,
  uploadFileExtension,
  uploadMimeType,
  UPLOAD_URL_TTL_SECONDS,
} from "@/lib/uploads";
import { originalObjectKey } from "@/server/photos/object-key";
import {
  createPresignedR2PutUrl,
  deleteR2Object,
  getR2Buckets,
  getR2ObjectBuffer,
  headR2Object,
} from "@/storage/r2";

const uploadIdSchema = z.uuid();
const albumIdSchema = z.uuid();
const uploadFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
export const createUploadBatchSchema = z.object({
  albumId: albumIdSchema,
  files: z.array(uploadFileSchema).min(1).max(MAX_UPLOAD_FILES),
});

type UploadRecord = typeof photoUploads.$inferSelect;

export class UploadServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function basename(value: string) {
  return value.replaceAll("\\", "/").split("/").at(-1)?.trim() ?? "";
}

function normalizedExtension(filename: string) {
  const extension = uploadFileExtension(filename);
  return extension === "jpeg" ? "jpg" : extension;
}

function normalizedUploadFile(input: z.infer<typeof uploadFileSchema>) {
  const originalFilename = basename(input.name);
  const contentType = uploadMimeType(input.type);

  if (!originalFilename || !isAcceptedUploadFile(originalFilename, contentType)) {
    throw new UploadServiceError(
      `不支持文件“${originalFilename || "未命名文件"}”的扩展名或 Content-Type。`,
    );
  }

  return {
    originalFilename,
    contentType,
    expectedByteSize: input.size,
    extension: normalizedExtension(originalFilename),
  };
}

function publicFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 1000);
}

function structuredUploadLog(event: string, values: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "info",
      event,
      ...values,
      timestamp: new Date().toISOString(),
    }),
  );
}

function uploadTaskView(task: UploadRecord & { album?: { title: string } | null }): UploadTaskView {
  return {
    id: task.id,
    albumId: task.albumId,
    albumTitle: task.album?.title ?? "未知相册",
    originalFilename: task.originalFilename,
    contentType: task.contentType,
    expectedByteSize: task.expectedByteSize,
    status: task.status,
    photoId: task.photoId,
    deduplicated: task.deduplicated,
    attemptCount: task.attemptCount,
    failureMessage: task.failureMessage,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}

async function uploadById(idInput: string) {
  const id = uploadIdSchema.parse(idInput);
  return getDb().query.photoUploads.findFirst({
    where: eq(photoUploads.id, id),
    with: { album: { columns: { title: true } } },
  });
}

export async function getAdminUploadTask(id: string) {
  const task = await uploadById(id);
  return task ? uploadTaskView(task) : null;
}

export async function getAdminUploadTasks(input?: { albumId?: string; limit?: number }) {
  const albumId = input?.albumId ? albumIdSchema.parse(input.albumId) : undefined;
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  const tasks = await getDb().query.photoUploads.findMany({
    where: albumId ? eq(photoUploads.albumId, albumId) : undefined,
    orderBy: [desc(photoUploads.createdAt)],
    limit,
    with: { album: { columns: { title: true } } },
  });
  return tasks.map(uploadTaskView);
}

export async function createUploadBatch(input: unknown): Promise<InitializedUpload[]> {
  const parsed = createUploadBatchSchema.parse(input);
  const db = getDb();
  const album = await db.query.albums.findFirst({
    columns: { id: true },
    where: eq(albums.id, parsed.albumId),
  });

  if (!album) {
    throw new UploadServiceError("目标相册不存在或已被删除。", 404);
  }

  const files = parsed.files.map(normalizedUploadFile);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + UPLOAD_URL_TTL_SECONDS * 1000);
  const { privateBucket } = getR2Buckets();
  const pending = files.map((file) => {
    const id = randomUUID();
    const reservedPhotoId = randomUUID();
    return {
      id,
      reservedPhotoId,
      albumId: album.id,
      objectKey: originalObjectKey(reservedPhotoId, file.extension),
      originalFilename: file.originalFilename,
      contentType: file.contentType,
      expectedByteSize: file.expectedByteSize,
      status: "PENDING" as const,
      uploadExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  });
  const presignedUrls = await Promise.all(
    pending.map((task) =>
      createPresignedR2PutUrl({
        bucket: privateBucket,
        key: task.objectKey,
        contentType: task.contentType,
        cacheControl: ORIGINAL_UPLOAD_CACHE_CONTROL,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      }),
    ),
  );

  await db.insert(photoUploads).values(pending);
  structuredUploadLog("admin.upload.batch_created", {
    albumId: album.id,
    uploadCount: pending.length,
    totalBytes: pending.reduce((sum, task) => sum + task.expectedByteSize, 0),
  });

  return pending.map((task, index) => ({
    uploadId: task.id,
    reservedPhotoId: task.reservedPhotoId,
    objectKey: task.objectKey,
    originalFilename: task.originalFilename,
    contentType: task.contentType,
    cacheControl: ORIGINAL_UPLOAD_CACHE_CONTROL,
    expectedByteSize: task.expectedByteSize,
    presignedUrl: presignedUrls[index],
    expiresAt: expiresAt.toISOString(),
  }));
}

async function markUploadFailed(taskId: string, error: unknown, photoId?: string | null) {
  const failureMessage = publicFailureMessage(error);
  await getDb()
    .update(photoUploads)
    .set({
      status: "FAILED",
      failureMessage,
      ...(photoId !== undefined ? { photoId } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(photoUploads.id, taskId), inArray(photoUploads.status, ["PROCESSING", "UPLOADED"])),
    );
  return failureMessage;
}

async function verifyUploadedObject(task: UploadRecord) {
  const { privateBucket } = getR2Buckets();
  const object = await headR2Object({ bucket: privateBucket, key: task.objectKey });

  if (!object) {
    throw new UploadServiceError("R2 中没有找到上传的原图，请重新上传。", 409);
  }

  if (object.byteSize !== task.expectedByteSize) {
    throw new UploadServiceError(
      `上传大小不一致：预期 ${task.expectedByteSize} 字节，实际 ${object.byteSize ?? "未知"} 字节。`,
      409,
    );
  }

  if (uploadMimeType(object.contentType ?? "") !== task.contentType) {
    throw new UploadServiceError("上传对象的 Content-Type 与签发记录不一致。", 409);
  }

  return object;
}

async function claimUpload(task: UploadRecord) {
  const db = getDb();
  const now = new Date();
  await db
    .update(photoUploads)
    .set({ status: "UPLOADED", failureMessage: null, updatedAt: now })
    .where(
      and(
        eq(photoUploads.id, task.id),
        inArray(photoUploads.status, ["PENDING", "UPLOADED", "FAILED"]),
      ),
    );
  const [claimed] = await db
    .update(photoUploads)
    .set({
      status: "PROCESSING",
      failureMessage: null,
      attemptCount: sql`${photoUploads.attemptCount} + 1`,
      updatedAt: now,
    })
    .where(and(eq(photoUploads.id, task.id), eq(photoUploads.status, "UPLOADED")))
    .returning();

  if (!claimed) {
    throw new UploadServiceError("该上传任务正在处理，请稍后刷新状态。", 409);
  }

  return claimed;
}

async function photoIdForFailedBuffer(buffer: Buffer) {
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const existing = await getDb().query.photos.findFirst({
    columns: { id: true },
    where: eq(photos.contentHash, contentHash),
  });
  return existing?.id ?? null;
}

async function processClaimedUpload(task: UploadRecord, sourceEtag: string | null) {
  const { privateBucket } = getR2Buckets();
  let buffer: Buffer | undefined;

  try {
    buffer = await getR2ObjectBuffer({
      bucket: privateBucket,
      key: task.objectKey,
      maxBytes: task.expectedByteSize,
      ifMatch: sourceEtag ?? undefined,
    });
    const { processPhotoSource } = await import("@/server/photos/process-photo");
    const result = await processPhotoSource({
      buffer,
      originalFilename: task.originalFilename,
      mimeType: task.contentType,
      sourceLabel: `R2 upload ${task.id}`,
      reservedPhotoId: task.reservedPhotoId,
      albumId: task.albumId,
      storedOriginal: {
        objectKey: task.objectKey,
        etag: sourceEtag ?? undefined,
      },
    });
    const photo = await getDb().query.photos.findFirst({
      columns: { id: true, originalKey: true },
      where: eq(photos.id, result.photoId),
    });

    if (!photo) {
      throw new Error("照片处理完成，但数据库记录不存在。");
    }

    // A retry can legitimately skip a READY photo created by this same task.
    // Ownership, rather than the processing status, decides deduplication and cleanup.
    const deduplicated = photo.id !== task.reservedPhotoId;

    if (photo.originalKey !== task.objectKey) {
      await deleteR2Object({ bucket: privateBucket, key: task.objectKey });
    }

    const now = new Date();
    await getDb()
      .update(photoUploads)
      .set({
        status: "SUCCEEDED",
        photoId: photo.id,
        deduplicated,
        failureMessage: null,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(photoUploads.id, task.id), eq(photoUploads.status, "PROCESSING")));
    structuredUploadLog("admin.upload.succeeded", {
      uploadId: task.id,
      albumId: task.albumId,
      photoId: photo.id,
      deduplicated,
      variantCount: result.variantCount,
    });
    return getAdminUploadTask(task.id);
  } catch (error) {
    const photoId = buffer ? await photoIdForFailedBuffer(buffer) : null;
    const failureMessage = await markUploadFailed(task.id, error, photoId);
    console.error(
      JSON.stringify({
        level: "error",
        event: "admin.upload.failed",
        uploadId: task.id,
        albumId: task.albumId,
        photoId,
        message: failureMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new UploadServiceError("照片处理失败，请查看任务错误并重试。", 422);
  }
}

export async function completeUploadTask(idInput: string) {
  const task = await uploadById(idInput);

  if (!task) {
    throw new UploadServiceError("上传任务不存在。", 404);
  }

  if (task.status === "SUCCEEDED") {
    return uploadTaskView(task);
  }

  if (task.status === "PROCESSING") {
    throw new UploadServiceError("该上传任务正在处理。", 409);
  }

  const object = await verifyUploadedObject(task).catch(async (error: unknown) => {
    await getDb()
      .update(photoUploads)
      .set({ status: "FAILED", failureMessage: publicFailureMessage(error), updatedAt: new Date() })
      .where(
        and(eq(photoUploads.id, task.id), inArray(photoUploads.status, ["PENDING", "FAILED"])),
      );
    throw error;
  });

  return processClaimedUpload(await claimUpload(task), object.etag);
}

async function renewUpload(task: UploadRecord) {
  const { privateBucket } = getR2Buckets();
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);
  const presignedUrl = await createPresignedR2PutUrl({
    bucket: privateBucket,
    key: task.objectKey,
    contentType: task.contentType,
    cacheControl: ORIGINAL_UPLOAD_CACHE_CONTROL,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
  await getDb()
    .update(photoUploads)
    .set({
      status: "PENDING",
      failureMessage: null,
      uploadExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(photoUploads.id, task.id));

  return {
    action: "upload" as const,
    upload: {
      uploadId: task.id,
      reservedPhotoId: task.reservedPhotoId,
      objectKey: task.objectKey,
      originalFilename: task.originalFilename,
      contentType: task.contentType,
      cacheControl: ORIGINAL_UPLOAD_CACHE_CONTROL,
      expectedByteSize: task.expectedByteSize,
      presignedUrl,
      expiresAt: expiresAt.toISOString(),
    } satisfies InitializedUpload,
  };
}

export async function retryUploadTask(idInput: string) {
  const task = await uploadById(idInput);

  if (!task) {
    throw new UploadServiceError("上传任务不存在。", 404);
  }

  if (task.status === "SUCCEEDED") {
    return { action: "completed" as const, task: uploadTaskView(task) };
  }

  if (task.status === "PROCESSING") {
    throw new UploadServiceError("该上传任务正在处理。", 409);
  }

  const { privateBucket } = getR2Buckets();
  const object = await headR2Object({ bucket: privateBucket, key: task.objectKey });
  const objectIsReusable =
    object?.byteSize === task.expectedByteSize &&
    uploadMimeType(object.contentType ?? "") === task.contentType;

  if (!objectIsReusable) {
    if (object) {
      await deleteR2Object({ bucket: privateBucket, key: task.objectKey });
    }

    return renewUpload(task);
  }

  return { action: "processing" as const, task: await completeUploadTask(task.id) };
}

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photos } from "@/db/schema";
import { normalizeAlbumSlug } from "@/lib/album-slug";

const albumIdSchema = z.uuid();
export const albumFieldsSchema = z.object({
  title: z.string().trim().min(1, "请输入相册标题。").max(120, "标题不能超过 120 个字符。"),
  slug: z.string().trim().min(1, "请输入相册 slug。").max(120, "Slug 不能超过 120 个字符。"),
  description: z.string().trim().max(1000, "简介不能超过 1000 个字符。"),
  shootingContext: z.string().trim().max(5000, "拍摄背景不能超过 5000 个字符。"),
});

export type AlbumFieldsInput = z.infer<typeof albumFieldsSchema>;

export class AlbumServiceError extends Error {}

const photoIdSchema = z.uuid();

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function parsedAlbumFields(input: AlbumFieldsInput) {
  const parsed = albumFieldsSchema.parse(input);

  return {
    title: parsed.title,
    slug: normalizeAlbumSlug(parsed.slug),
    description: parsed.description || null,
    shootingContext: parsed.shootingContext || null,
  };
}

export async function isAlbumSlugAvailable(slugInput: string, excludeId?: string) {
  const slug = normalizeAlbumSlug(slugInput);
  const condition = excludeId
    ? and(eq(albums.slug, slug), ne(albums.id, albumIdSchema.parse(excludeId)))
    : eq(albums.slug, slug);
  const existing = await getDb().select({ id: albums.id }).from(albums).where(condition).limit(1);
  return { available: !existing[0], slug };
}

export async function createAlbum(input: AlbumFieldsInput) {
  const values = parsedAlbumFields(input);

  try {
    const [created] = await getDb()
      .insert(albums)
      .values({ ...values, status: "DRAFT" })
      .returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AlbumServiceError("这个 slug 已经被使用，请换一个。");
    }

    throw error;
  }
}

export async function updateAlbumDetails(idInput: string, input: AlbumFieldsInput) {
  const id = albumIdSchema.parse(idInput);
  const db = getDb();
  const current = await db.query.albums.findFirst({ where: eq(albums.id, id) });

  if (!current) {
    throw new AlbumServiceError("相册不存在或已被删除。");
  }

  const values = parsedAlbumFields(input);

  if (current.status === "PUBLISHED" && values.slug !== current.slug) {
    throw new AlbumServiceError("已发布相册不能修改 slug。");
  }

  try {
    const [updated] = await db
      .update(albums)
      .set({
        ...values,
        slug: current.status === "PUBLISHED" ? current.slug : values.slug,
        updatedAt: new Date(),
      })
      .where(eq(albums.id, id))
      .returning();
    return { album: updated, publicContentChanged: current.status === "PUBLISHED" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AlbumServiceError("这个 slug 已经被使用，请换一个。");
    }

    throw error;
  }
}

export async function publishAlbum(idInput: string) {
  const id = albumIdSchema.parse(idInput);
  const db = getDb();
  const album = await db.query.albums.findFirst({ where: eq(albums.id, id) });

  if (!album) {
    throw new AlbumServiceError("相册不存在或已被删除。");
  }

  const readyPhotos = await db
    .select({ id: photos.id })
    .from(albumPhotos)
    .innerJoin(photos, and(eq(photos.id, albumPhotos.photoId), eq(photos.status, "READY")))
    .where(eq(albumPhotos.albumId, id))
    .orderBy(asc(albumPhotos.sortOrder), asc(albumPhotos.photoId));

  if (readyPhotos.length === 0) {
    throw new AlbumServiceError("至少需要一张处理完成的照片才能发布相册。");
  }

  const readyIds = new Set(readyPhotos.map((photo) => photo.id));

  if (album.coverPhotoId && !readyIds.has(album.coverPhotoId)) {
    throw new AlbumServiceError("当前封面不是相册内处理完成的照片，请先更换封面。");
  }

  const [updated] = await db
    .update(albums)
    .set({
      status: "PUBLISHED",
      coverPhotoId: album.coverPhotoId ?? readyPhotos[0].id,
      publishedAt: album.publishedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(albums.id, id))
    .returning();
  return updated;
}

export async function unpublishAlbum(idInput: string) {
  const id = albumIdSchema.parse(idInput);
  const [updated] = await getDb()
    .update(albums)
    .set({ status: "DRAFT", updatedAt: new Date() })
    .where(eq(albums.id, id))
    .returning();

  if (!updated) {
    throw new AlbumServiceError("相册不存在或已被删除。");
  }

  return updated;
}

function parsedPhotoIds(input: string[] | { photoIds: string[] }) {
  const photoIds = Array.isArray(input) ? input : input.photoIds;
  const parsed = z.array(photoIdSchema).safeParse(photoIds);

  if (!parsed.success) {
    throw new AlbumServiceError("照片排序数据不正确。");
  }

  if (new Set(parsed.data).size !== parsed.data.length) {
    throw new AlbumServiceError("照片排序中不能包含重复照片。");
  }

  return parsed.data;
}

/**
 * Persist the complete album order in one database transaction. The complete
 * set comparison is intentionally performed inside the transaction so a
 * concurrent membership change cannot turn a partial client payload into a
 * valid-looking order.
 */
export async function saveAlbumPhotoOrder(
  idInput: string,
  input: string[] | { photoIds: string[] },
) {
  const albumId = albumIdSchema.parse(idInput);
  const photoIds = parsedPhotoIds(input);
  const db = getDb();

  return db.transaction(async (tx) => {
    const album = await tx.query.albums.findFirst({ where: eq(albums.id, albumId) });

    if (!album) {
      throw new AlbumServiceError("相册不存在或已被删除。");
    }

    const currentRows = await tx
      .select({ photoId: albumPhotos.photoId })
      .from(albumPhotos)
      .where(eq(albumPhotos.albumId, albumId));
    const currentIds = currentRows.map((row) => row.photoId);
    const currentIdSet = new Set(currentIds);
    const foreignIds = photoIds.filter((photoId) => !currentIdSet.has(photoId));
    const omittedIds = currentIds.filter((photoId) => !photoIds.includes(photoId));

    if (foreignIds.length > 0) {
      throw new AlbumServiceError("排序中包含不属于该相册的照片。");
    }

    if (omittedIds.length > 0 || photoIds.length !== currentIds.length) {
      throw new AlbumServiceError("照片排序必须包含相册当前的全部照片。");
    }

    if (photoIds.length > 0) {
      const orderCase = sql<number>`case ${sql.join(
        photoIds.map(
          (photoId, index) => sql`when ${albumPhotos.photoId} = ${photoId} then ${index}`,
        ),
        sql` `,
      )} else ${albumPhotos.sortOrder} end`;

      await tx
        .update(albumPhotos)
        .set({ sortOrder: orderCase })
        .where(and(eq(albumPhotos.albumId, albumId), inArray(albumPhotos.photoId, photoIds)));
    }

    await tx.update(albums).set({ updatedAt: new Date() }).where(eq(albums.id, albumId));

    return { albumId, photoIds };
  });
}

function focalPoint(value: number | undefined, name: string, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new AlbumServiceError(`${name} 必须是 0 到 100 之间的数字。`);
  }

  return Math.round(value);
}

export async function updateAlbumCover(input: {
  albumId: string;
  photoId: string;
  coverFocalX?: number;
  coverFocalY?: number;
}) {
  const albumId = albumIdSchema.parse(input.albumId);
  const photoId = photoIdSchema.parse(input.photoId);
  const db = getDb();

  return db.transaction(async (tx) => {
    const album = await tx.query.albums.findFirst({ where: eq(albums.id, albumId) });

    if (!album) {
      throw new AlbumServiceError("相册不存在或已被删除。");
    }

    const membership = await tx
      .select({ status: photos.status })
      .from(albumPhotos)
      .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
      .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)))
      .limit(1);

    if (!membership[0]) {
      throw new AlbumServiceError("封面照片必须属于该相册。");
    }

    if (membership[0].status !== "READY") {
      throw new AlbumServiceError("封面照片必须已经处理完成。");
    }

    const [updated] = await tx
      .update(albums)
      .set({
        coverPhotoId: photoId,
        coverFocalX: focalPoint(input.coverFocalX, "横向焦点", album.coverFocalX),
        coverFocalY: focalPoint(input.coverFocalY, "纵向焦点", album.coverFocalY),
        updatedAt: new Date(),
      })
      .where(eq(albums.id, albumId))
      .returning();

    return updated;
  });
}

function normalizedChapterText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  return value.trim() || null;
}

export async function updateAlbumChapter(input: {
  albumId: string;
  photoId: string;
  title?: string | null;
  text?: string | null;
}) {
  const albumId = albumIdSchema.parse(input.albumId);
  const photoId = photoIdSchema.parse(input.photoId);
  const db = getDb();
  const [updated] = await db
    .update(albumPhotos)
    .set({
      ...(input.title === undefined ? {} : { chapterTitle: normalizedChapterText(input.title) }),
      ...(input.text === undefined ? {} : { chapterText: normalizedChapterText(input.text) }),
    })
    .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)))
    .returning();

  if (!updated) {
    throw new AlbumServiceError("章节照片不属于该相册。");
  }

  return updated;
}

export async function clearAlbumChapter(albumId: string, photoId: string) {
  return updateAlbumChapter({ albumId, photoId, title: null, text: null });
}

interface PhotoStorageKeys {
  originalKey: string;
  variantKeys: string[];
}

async function deletePhotoStorage(keys: PhotoStorageKeys) {
  let buckets;

  try {
    const { getR2Buckets } = await import("@/storage/r2");
    buckets = getR2Buckets();
  } catch (error) {
    // A DB-only local environment has no R2 objects to clean up. Keep the
    // record deletion usable there while still surfacing real storage errors.
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("required for photo storage")) {
      return;
    }

    throw error;
  }

  const { deleteR2Object } = await import("@/storage/r2");
  await Promise.all([
    deleteR2Object({ bucket: buckets.privateBucket, key: keys.originalKey }),
    ...keys.variantKeys.map((key) => deleteR2Object({ bucket: buckets.publicBucket, key })),
  ]);
}

export async function removePhotoFromAlbum(albumIdInput: string, photoIdInput: string) {
  const albumId = albumIdSchema.parse(albumIdInput);
  const photoId = photoIdSchema.parse(photoIdInput);
  const db = getDb();

  const removed = await db.transaction(async (tx) => {
    const album = await tx.query.albums.findFirst({ where: eq(albums.id, albumId) });

    if (!album) {
      throw new AlbumServiceError("相册不存在或已被删除。");
    }

    const membership = await tx
      .select({ photoId: albumPhotos.photoId })
      .from(albumPhotos)
      .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)))
      .limit(1);

    if (!membership[0]) {
      throw new AlbumServiceError("照片不属于该相册，无法移除。");
    }

    const photo = await tx.query.photos.findFirst({
      where: eq(photos.id, photoId),
      with: { variants: true },
    });
    const otherMembership = await tx
      .select({ albumId: albumPhotos.albumId })
      .from(albumPhotos)
      .where(and(eq(albumPhotos.photoId, photoId), ne(albumPhotos.albumId, albumId)))
      .limit(1);
    const deletePhoto = otherMembership.length === 0;

    await tx
      .delete(albumPhotos)
      .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)));

    const readyPhotos = await tx
      .select({ id: photos.id })
      .from(albumPhotos)
      .innerJoin(photos, and(eq(photos.id, albumPhotos.photoId), eq(photos.status, "READY")))
      .where(eq(albumPhotos.albumId, albumId))
      .orderBy(asc(albumPhotos.sortOrder), asc(albumPhotos.photoId));
    const readyCoverPhotoId = readyPhotos[0]?.id ?? null;
    const nextCoverPhotoId =
      album.coverPhotoId === photoId ? readyCoverPhotoId : album.coverPhotoId;
    const coverIsUsable = nextCoverPhotoId
      ? readyPhotos.some((readyPhoto) => readyPhoto.id === nextCoverPhotoId)
      : false;
    const resolvedCoverPhotoId = coverIsUsable ? nextCoverPhotoId : readyCoverPhotoId;
    const nextStatus =
      album.status === "PUBLISHED" && readyPhotos.length === 0 ? "DRAFT" : album.status;

    if (album.coverPhotoId !== resolvedCoverPhotoId || album.status !== nextStatus) {
      await tx
        .update(albums)
        .set({
          coverPhotoId: resolvedCoverPhotoId,
          coverFocalX: 50,
          coverFocalY: 50,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(albums.id, albumId));
    } else {
      await tx.update(albums).set({ updatedAt: new Date() }).where(eq(albums.id, albumId));
    }

    const storageKeys =
      deletePhoto && photo
        ? {
            originalKey: photo.originalKey,
            variantKeys: photo.variants.map((variant) => variant.objectKey),
          }
        : null;

    if (deletePhoto) {
      await tx.delete(photos).where(eq(photos.id, photoId));
    }

    return {
      photoId,
      deletedPhoto: deletePhoto,
      storageKeys,
      coverPhotoId: resolvedCoverPhotoId,
      status: nextStatus,
    };
  });

  if (removed.storageKeys) {
    await deletePhotoStorage(removed.storageKeys);
  }

  return removed;
}

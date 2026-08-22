import { and, asc, eq, ne } from "drizzle-orm";
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

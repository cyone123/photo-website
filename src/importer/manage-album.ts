import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { albumPhotos, albums } from "@/db/schema";
import { normalizeAlbumSlug } from "@/lib/album-slug";

export type UpdateAlbumOptions = {
  slug: string;
  description?: string;
  shootingContext?: string;
  coverPhotoId?: string;
  coverFocalX?: number;
  coverFocalY?: number;
};

function validateFocalPoint(value: number | undefined, name: string) {
  if (value === undefined) {
    return;
  }

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a number from 0 to 100.`);
  }
}

export async function updateAlbum(options: UpdateAlbumOptions) {
  const db = getDb();
  const slug = normalizeAlbumSlug(options.slug);
  const album = await db.query.albums.findFirst({ where: eq(albums.slug, slug) });

  if (!album) {
    throw new Error(`Album not found: ${slug}`);
  }

  validateFocalPoint(options.coverFocalX, "--focus-x");
  validateFocalPoint(options.coverFocalY, "--focus-y");

  if (options.coverPhotoId) {
    const membership = await db.query.albumPhotos.findFirst({
      where: and(eq(albumPhotos.albumId, album.id), eq(albumPhotos.photoId, options.coverPhotoId)),
    });

    if (!membership) {
      throw new Error("The cover photo must belong to this album.");
    }
  }

  const updates: Partial<typeof albums.$inferInsert> = { updatedAt: new Date() };

  if (options.description !== undefined) {
    updates.description = options.description.trim() || null;
  }

  if (options.shootingContext !== undefined) {
    updates.shootingContext = options.shootingContext.trim() || null;
  }

  if (options.coverPhotoId !== undefined) {
    updates.coverPhotoId = options.coverPhotoId;
  }

  if (options.coverFocalX !== undefined) {
    updates.coverFocalX = Math.round(options.coverFocalX);
  }

  if (options.coverFocalY !== undefined) {
    updates.coverFocalY = Math.round(options.coverFocalY);
  }

  const [updated] = await db.update(albums).set(updates).where(eq(albums.id, album.id)).returning();

  return updated;
}

export async function setAlbumChapter(options: {
  slug: string;
  photoId: string;
  title?: string;
  text?: string;
}) {
  const db = getDb();
  const slug = normalizeAlbumSlug(options.slug);
  const album = await db.query.albums.findFirst({ where: eq(albums.slug, slug) });

  if (!album) {
    throw new Error(`Album not found: ${slug}`);
  }

  const [updated] = await db
    .update(albumPhotos)
    .set({
      chapterTitle: options.title?.trim() || null,
      chapterText: options.text?.trim() || null,
    })
    .where(and(eq(albumPhotos.albumId, album.id), eq(albumPhotos.photoId, options.photoId)))
    .returning();

  if (!updated) {
    throw new Error("The chapter photo must belong to this album.");
  }

  return updated;
}

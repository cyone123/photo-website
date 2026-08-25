import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { readServerEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photos } from "@/db/schema";

type PhotoStatus = (typeof photos.$inferSelect)["status"];
type AlbumStatus = (typeof albums.$inferSelect)["status"];

export interface AdminStatusCounts {
  ready: number;
  processing: number;
  failed: number;
}

export interface AdminAlbumSummary extends AdminStatusCounts {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: AlbumStatus;
  coverUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface AdminAlbumPhoto {
  id: string;
  status: PhotoStatus;
  title: string | null;
  description: string | null;
  takenAt: Date | null;
  width: number;
  height: number;
  previewUrl: string | null;
  sortOrder: number;
  chapterTitle: string | null;
  chapterText: string | null;
}

export interface AdminAlbumDetail extends AdminStatusCounts {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shootingContext: string | null;
  coverPhotoId: string | null;
  coverFocalX: number;
  coverFocalY: number;
  status: AlbumStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  photos: AdminAlbumPhoto[];
}

function getPublicImageUrl(objectKey: string) {
  try {
    const baseUrl = readServerEnv().R2_PUBLIC_BASE_URL;

    if (!baseUrl) {
      return null;
    }

    const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl.replace(/\/$/, "")}/${encodedKey}`;
  } catch {
    return null;
  }
}

function previewUrl(
  variants: Array<{ width: number; format: string; objectKey: string }>,
): string | null {
  const candidates = variants
    .filter((variant) => variant.format === "avif")
    .sort((left, right) => left.width - right.width);
  const selected = candidates.find((variant) => variant.width >= 640) ?? candidates.at(-1);
  return selected ? getPublicImageUrl(selected.objectKey) : null;
}

function emptyStatusCounts(): AdminStatusCounts {
  return { ready: 0, processing: 0, failed: 0 };
}

function addStatus(counts: AdminStatusCounts, status: PhotoStatus) {
  if (status === "READY") {
    counts.ready += 1;
  } else if (status === "PROCESSING") {
    counts.processing += 1;
  } else {
    counts.failed += 1;
  }
}

export async function getAdminDashboardStats() {
  const db = getDb();
  const [albumGroups, photoGroups] = await Promise.all([
    db.select({ status: albums.status, value: count() }).from(albums).groupBy(albums.status),
    db.select({ status: photos.status, value: count() }).from(photos).groupBy(photos.status),
  ]);
  const result = {
    albums: { total: 0, draft: 0, published: 0 },
    photos: emptyStatusCounts(),
  };

  for (const group of albumGroups) {
    const value = Number(group.value);
    result.albums.total += value;

    if (group.status === "PUBLISHED") {
      result.albums.published = value;
    } else {
      result.albums.draft = value;
    }
  }

  for (const group of photoGroups) {
    const value = Number(group.value);
    result.photos[
      group.status === "READY" ? "ready" : group.status === "FAILED" ? "failed" : "processing"
    ] = value;
  }

  return result;
}

export async function getAdminAlbums(): Promise<AdminAlbumSummary[]> {
  const db = getDb();
  const albumRows = await db.select().from(albums).orderBy(desc(albums.updatedAt));

  if (albumRows.length === 0) {
    return [];
  }

  const albumIds = albumRows.map((album) => album.id);
  const membershipRows = await db
    .select({ albumId: albumPhotos.albumId, status: photos.status })
    .from(albumPhotos)
    .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
    .where(inArray(albumPhotos.albumId, albumIds));
  const coverIds = albumRows.flatMap((album) => (album.coverPhotoId ? [album.coverPhotoId] : []));
  const coverRows =
    coverIds.length > 0
      ? await db.query.photos.findMany({
          where: inArray(photos.id, coverIds),
          with: { variants: true },
        })
      : [];
  const counts = new Map<string, AdminStatusCounts>();

  for (const row of membershipRows) {
    const albumCounts = counts.get(row.albumId) ?? emptyStatusCounts();
    addStatus(albumCounts, row.status);
    counts.set(row.albumId, albumCounts);
  }

  const coverById = new Map(coverRows.map((photo) => [photo.id, previewUrl(photo.variants)]));

  return albumRows.map((album) => ({
    id: album.id,
    slug: album.slug,
    title: album.title,
    description: album.description,
    status: album.status,
    publishedAt: album.publishedAt,
    updatedAt: album.updatedAt,
    coverUrl: album.coverPhotoId ? (coverById.get(album.coverPhotoId) ?? null) : null,
    ...(counts.get(album.id) ?? emptyStatusCounts()),
  }));
}

export async function getAdminAlbumById(id: string): Promise<AdminAlbumDetail | null> {
  const album = await getDb().query.albums.findFirst({
    where: eq(albums.id, id),
    with: {
      albumPhotos: {
        orderBy: [asc(albumPhotos.sortOrder), asc(albumPhotos.photoId)],
        with: {
          photo: {
            with: { variants: true },
          },
        },
      },
    },
  });

  if (!album) {
    return null;
  }

  const statusCounts = emptyStatusCounts();
  const albumPhotoList = album.albumPhotos.flatMap((entry) => {
    if (!entry.photo) {
      return [];
    }

    addStatus(statusCounts, entry.photo.status);

    return [
      {
        id: entry.photo.id,
        status: entry.photo.status,
        title: entry.photo.title,
        description: entry.photo.description,
        takenAt: entry.photo.takenAt,
        width: entry.photo.width,
        height: entry.photo.height,
        previewUrl: previewUrl(entry.photo.variants),
        sortOrder: entry.sortOrder,
        chapterTitle: entry.chapterTitle,
        chapterText: entry.chapterText,
      },
    ];
  });

  return {
    id: album.id,
    slug: album.slug,
    title: album.title,
    description: album.description,
    shootingContext: album.shootingContext,
    coverPhotoId: album.coverPhotoId,
    coverFocalX: album.coverFocalX,
    coverFocalY: album.coverFocalY,
    status: album.status,
    publishedAt: album.publishedAt,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
    photos: albumPhotoList,
    ...statusCounts,
  };
}

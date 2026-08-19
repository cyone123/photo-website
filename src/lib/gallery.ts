import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { readServerEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photos } from "@/db/schema";

export const GALLERY_CACHE_TAG = "gallery";

const GALLERY_CACHE_OPTIONS = {
  tags: [GALLERY_CACHE_TAG],
  revalidate: 3600,
};

export type GalleryDate = Date | string | null;

export interface GalleryVariant {
  width: number;
  height: number;
  format: string;
  objectKey: string;
  url: string | null;
}

export interface GalleryPhoto {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  title: string | null;
  description: string | null;
  takenAt: GalleryDate;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLengthMm: string | null;
  aperture: string | null;
  exposureTimeSeconds: string | null;
  iso: number | null;
  latitude: string | null;
  longitude: string | null;
  previewUrl: string | null;
  detailUrl: string | null;
  variants: GalleryVariant[];
  albums: Array<{ slug: string; title: string }>;
}

export interface GalleryAlbum {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: GalleryDate;
  photos: GalleryPhoto[];
  coverPhoto: GalleryPhoto | null;
}

export interface GalleryAlbumSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: GalleryDate;
  photoCount: number;
  coverPhoto: GalleryPhoto | null;
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

function chooseVariant(variants: GalleryVariant[], preferredWidth: number) {
  const usable = variants
    .filter((variant) => variant.format === "webp")
    .sort((left, right) => left.width - right.width);

  return usable.find((variant) => variant.width >= preferredWidth) ?? usable.at(-1) ?? null;
}

type PhotoWithVariants = {
  id: string;
  status: string;
  width: number;
  height: number;
  title: string | null;
  description: string | null;
  takenAt: Date | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLengthMm: string | null;
  aperture: string | null;
  exposureTimeSeconds: string | null;
  iso: number | null;
  latitude: string | null;
  longitude: string | null;
  variants: Array<{
    width: number;
    height: number;
    format: string;
    objectKey: string;
  }>;
};

function toGalleryPhoto(
  photo: PhotoWithVariants,
  photoAlbums: Array<{ slug: string; title: string }> = [],
): GalleryPhoto {
  const variants = photo.variants.map((variant) => ({
    ...variant,
    url: getPublicImageUrl(variant.objectKey),
  }));
  const preview = chooseVariant(variants, 640);
  const detail = chooseVariant(variants, 1600);

  return {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    aspectRatio: photo.width / photo.height,
    title: photo.title,
    description: photo.description,
    takenAt: photo.takenAt,
    cameraMake: photo.cameraMake,
    cameraModel: photo.cameraModel,
    lensModel: photo.lensModel,
    focalLengthMm: photo.focalLengthMm,
    aperture: photo.aperture,
    exposureTimeSeconds: photo.exposureTimeSeconds,
    iso: photo.iso,
    latitude: photo.latitude,
    longitude: photo.longitude,
    previewUrl: preview?.url ?? null,
    detailUrl: detail?.url ?? null,
    variants,
    albums: photoAlbums,
  };
}

async function queryPublishedAlbumBySlug(slug: string) {
  return getDb().query.albums.findFirst({
    where: and(eq(albums.slug, slug), eq(albums.status, "PUBLISHED")),
    with: {
      albumPhotos: {
        orderBy: [asc(albumPhotos.sortOrder)],
        with: {
          photo: {
            with: {
              variants: true,
            },
          },
        },
      },
    },
  });
}

type RawAlbum = NonNullable<Awaited<ReturnType<typeof queryPublishedAlbumBySlug>>>;
type RawAlbumPhoto = RawAlbum["albumPhotos"][number];
type RawPhoto = NonNullable<RawAlbumPhoto["photo"]>;

function toGalleryAlbum(album: RawAlbum): GalleryAlbum {
  const albumPhotosList = album.albumPhotos.flatMap((entry) => {
    if (!entry.photo || entry.photo.status !== "READY") {
      return [];
    }

    return [toGalleryPhoto(entry.photo)];
  });

  return {
    id: album.id,
    slug: album.slug,
    title: album.title,
    description: album.description,
    publishedAt: album.publishedAt,
    photos: albumPhotosList,
    coverPhoto:
      albumPhotosList.find((photo) => photo.id === album.coverPhotoId) ??
      albumPhotosList[0] ??
      null,
  };
}

async function queryPublishedAlbumSummaries(limit?: number): Promise<GalleryAlbumSummary[]> {
  const db = getDb();
  const baseQuery = db
    .select({
      id: albums.id,
      slug: albums.slug,
      title: albums.title,
      description: albums.description,
      publishedAt: albums.publishedAt,
      createdAt: albums.createdAt,
      coverPhotoId: albums.coverPhotoId,
      photoCount: count(photos.id).mapWith(Number),
    })
    .from(albums)
    .leftJoin(albumPhotos, eq(albumPhotos.albumId, albums.id))
    .leftJoin(photos, and(eq(photos.id, albumPhotos.photoId), eq(photos.status, "READY")))
    .where(eq(albums.status, "PUBLISHED"))
    .groupBy(albums.id)
    .orderBy(desc(albums.publishedAt), desc(albums.createdAt));
  const rows = limit ? await baseQuery.limit(limit) : await baseQuery;
  const coverPhotoIds = [
    ...new Set(rows.flatMap((album) => (album.coverPhotoId ? [album.coverPhotoId] : []))),
  ];
  const coverPhotos =
    coverPhotoIds.length > 0
      ? await db.query.photos.findMany({
          where: and(inArray(photos.id, coverPhotoIds), eq(photos.status, "READY")),
          with: { variants: true },
        })
      : [];
  const coverPhotoById = new Map(
    coverPhotos.map((photo) => [photo.id, toGalleryPhoto(photo as RawPhoto)]),
  );

  return rows.map((album) => ({
    id: album.id,
    slug: album.slug,
    title: album.title,
    description: album.description,
    publishedAt: album.publishedAt,
    photoCount: album.photoCount,
    coverPhoto: album.coverPhotoId ? (coverPhotoById.get(album.coverPhotoId) ?? null) : null,
  }));
}

const getCachedPublishedAlbumSummaries = unstable_cache(
  queryPublishedAlbumSummaries,
  ["published-album-summaries"],
  GALLERY_CACHE_OPTIONS,
);

export function getPublishedAlbumSummaries(limit?: number) {
  return getCachedPublishedAlbumSummaries(limit);
}

const getCachedAlbumBySlug = unstable_cache(
  async (slug: string) => {
    const album = await queryPublishedAlbumBySlug(slug);

    return album ? toGalleryAlbum(album as RawAlbum) : null;
  },
  ["published-album-by-slug"],
  GALLERY_CACHE_OPTIONS,
);

export function getAlbumBySlug(slug: string) {
  return getCachedAlbumBySlug(slug);
}

async function queryLatestPhotos(limit: number) {
  return getDb().query.photos.findMany({
    where: eq(photos.status, "READY"),
    orderBy: [desc(photos.takenAt), desc(photos.createdAt)],
    limit,
    with: {
      variants: true,
    },
  });
}

const getCachedLatestPhotos = unstable_cache(
  async (limit: number) => {
    const latest = await queryLatestPhotos(limit);
    return latest.map((photo) => toGalleryPhoto(photo as RawPhoto));
  },
  ["latest-photos"],
  GALLERY_CACHE_OPTIONS,
);

export function getLatestPhotos(limit = 6) {
  return getCachedLatestPhotos(limit);
}

const getCachedPhotoById = unstable_cache(
  async (id: string) => {
    const photo = await getDb().query.photos.findFirst({
      where: and(eq(photos.id, id), eq(photos.status, "READY")),
      with: {
        variants: true,
        albumPhotos: {
          with: {
            album: true,
          },
        },
      },
    });

    if (!photo) {
      return null;
    }

    const publishedAlbums = photo.albumPhotos.flatMap((entry) => {
      if (!entry.album || entry.album.status !== "PUBLISHED") {
        return [];
      }

      return [{ slug: entry.album.slug, title: entry.album.title }];
    });

    return toGalleryPhoto(photo as RawPhoto, publishedAlbums);
  },
  ["ready-photo-by-id"],
  GALLERY_CACHE_OPTIONS,
);

export function getPhotoById(id: string) {
  return getCachedPhotoById(id);
}

function asDate(value: GalleryDate) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPhotoDate(value: GalleryDate) {
  const date = asDate(value);

  if (!date) {
    return "未记录日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatPhotoYear(value: GalleryDate) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("zh-CN", { year: "numeric" }).format(date) : "—";
}

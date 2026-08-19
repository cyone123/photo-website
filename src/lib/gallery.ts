import { and, asc, desc, eq } from "drizzle-orm";
import { readServerEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { albumPhotos, albums, photos } from "@/db/schema";

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
  publishedAt: Date | null;
  photos: GalleryPhoto[];
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

async function queryPublishedAlbums() {
  return getDb().query.albums.findMany({
    where: eq(albums.status, "PUBLISHED"),
    orderBy: [desc(albums.publishedAt), desc(albums.createdAt)],
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

type RawAlbum = Awaited<ReturnType<typeof queryPublishedAlbums>>[number];
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

export async function getPublishedAlbums() {
  try {
    return (await queryPublishedAlbums()).map(toGalleryAlbum);
  } catch {
    return [];
  }
}

export async function getAlbumBySlug(slug: string) {
  try {
    const album = await getDb().query.albums.findFirst({
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

    return album ? toGalleryAlbum(album as RawAlbum) : null;
  } catch {
    return null;
  }
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

export async function getLatestPhotos(limit = 6) {
  try {
    const latest = await queryLatestPhotos(limit);
    return latest.map((photo) => toGalleryPhoto(photo as RawPhoto));
  } catch {
    return [];
  }
}

export async function getPhotoById(id: string) {
  try {
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
  } catch {
    return null;
  }
}

export function formatPhotoDate(date: Date | null) {
  if (!date) {
    return "未记录日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatPhotoYear(date: Date | null) {
  return date ? new Intl.DateTimeFormat("zh-CN", { year: "numeric" }).format(date) : "—";
}

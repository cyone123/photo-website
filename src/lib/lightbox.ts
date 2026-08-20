import type { LightboxPhoto } from "@/components/photo-lightbox-types";
import { formatPhotoDate, type GalleryPhoto } from "@/lib/gallery";

export function toLightboxPhoto(photo: GalleryPhoto): LightboxPhoto {
  const sources = photo.variants
    .filter(
      (variant): variant is typeof variant & { url: string } =>
        variant.format === "webp" && Boolean(variant.url),
    )
    .sort((left, right) => left.width - right.width)
    .map((variant) => ({ width: variant.width, url: variant.url }));
  const fallback = sources.find((source) => source.width >= 1600) ?? sources.at(-1) ?? null;
  const camera = [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ");

  return {
    id: photo.id,
    title: photo.title ?? "未命名照片",
    description: photo.description,
    dateLabel: formatPhotoDate(photo.takenAt),
    dimensionsLabel: `${photo.width} × ${photo.height}`,
    cameraLabel: camera || null,
    detailHref: `/photos/${photo.id}`,
    fallbackUrl: fallback?.url ?? photo.detailUrl ?? photo.previewUrl,
    sources,
  };
}

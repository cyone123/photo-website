import type { LightboxPhoto } from "@/components/photo-lightbox-types";
import type { GalleryDate, GalleryPhoto } from "@/lib/gallery";

function formatPhotoDate(value: GalleryDate) {
  if (!value) {
    return "未记录日期";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未记录日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toLightboxPhoto(photo: GalleryPhoto): LightboxPhoto {
  const sources = photo.variants
    .filter(
      (variant): variant is typeof variant & { url: string } =>
        (variant.format === "avif" || variant.format === "webp") && Boolean(variant.url),
    )
    .sort((left, right) => left.width - right.width)
    .map((variant) => ({ width: variant.width, url: variant.url, format: variant.format }));
  const webpSources = sources.filter((source) => source.format === "webp");
  const fallback = webpSources.find((source) => source.width >= 1600) ?? webpSources.at(-1) ?? null;
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

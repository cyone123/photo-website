/* eslint-disable @next/next/no-img-element -- R2 already stores each responsive variant; srcset selects them without re-encoding. */
import type { GalleryPhoto } from "@/lib/gallery";

type ResponsivePhotoImageProps = {
  photo: GalleryPhoto;
  alt: string;
  sizes: string;
  preferredWidth?: number;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
};

export function ResponsivePhotoImage({
  photo,
  alt,
  sizes,
  preferredWidth = 960,
  loading = "lazy",
  fetchPriority = "auto",
}: ResponsivePhotoImageProps) {
  const variants = photo.variants
    .filter(
      (variant): variant is typeof variant & { url: string } =>
        variant.format === "webp" && Boolean(variant.url),
    )
    .sort((left, right) => left.width - right.width);
  const fallback = variants.find((variant) => variant.width >= preferredWidth) ?? variants.at(-1);

  if (!fallback) {
    return null;
  }

  return (
    <img
      src={fallback.url}
      srcSet={variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ")}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
    />
  );
}

import type { PublicImageFormat } from "./variants";

export function originalObjectKey(photoId: string, extension: string) {
  return `photos/${photoId}/original.${extension}`;
}

export function publicVariantObjectKey(
  photoId: string,
  width: number,
  format: PublicImageFormat = "webp",
) {
  return `photos/${photoId}/${width}.${format}`;
}

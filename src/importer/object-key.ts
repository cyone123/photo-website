import type { PublicImageFormat, PublicImageWidth } from "./constants";

export function originalObjectKey(photoId: string, extension: string) {
  return `photos/${photoId}/original.${extension}`;
}

export function publicVariantObjectKey(
  photoId: string,
  width: PublicImageWidth,
  format: PublicImageFormat = "webp",
) {
  return `photos/${photoId}/${width}.${format}`;
}

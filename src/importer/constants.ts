export const PUBLIC_IMAGE_WIDTHS = [480, 960, 1600, 2400] as const;

export type PublicImageFormat = "webp";

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
]);

export function getVariantWidths(maxDimension: number) {
  const widths = PUBLIC_IMAGE_WIDTHS.filter((width) => width <= maxDimension);

  return widths.length > 0 ? [...widths] : [Math.max(1, Math.floor(maxDimension))];
}

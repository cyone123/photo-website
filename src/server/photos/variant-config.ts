export const PUBLIC_IMAGE_WIDTHS = [480, 960, 1600, 2400] as const;

export const PUBLIC_IMAGE_FORMATS = ["avif"] as const;
export const PUBLIC_IMAGE_AVIF_EFFORT = 2;
export const PUBLIC_VARIANT_UPLOAD_CONCURRENCY = 3;

export type PublicImageFormat = (typeof PUBLIC_IMAGE_FORMATS)[number];

export function getVariantWidths(maxDimension: number) {
  const widths = PUBLIC_IMAGE_WIDTHS.filter((width) => width <= maxDimension);

  return widths.length > 0 ? [...widths] : [Math.max(1, Math.floor(maxDimension))];
}

export const PUBLIC_IMAGE_WIDTHS = [480, 960, 1600, 2400] as const;

export type PublicImageWidth = (typeof PUBLIC_IMAGE_WIDTHS)[number];
export type PublicImageFormat = "webp";

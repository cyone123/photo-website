export {
  getVariantWidths,
  PUBLIC_IMAGE_FORMATS,
  PUBLIC_IMAGE_WIDTHS,
  type PublicImageFormat,
} from "@/server/photos/variant-config";

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

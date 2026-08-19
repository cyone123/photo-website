import sharp from "sharp";
import { getVariantWidths, type PublicImageFormat } from "./constants";

export interface GeneratedVariant {
  targetWidth: number;
  width: number;
  height: number;
  format: PublicImageFormat;
  mimeType: "image/webp";
  buffer: Buffer;
  byteSize: number;
}

export async function generatePublicVariants(buffer: Buffer, maxDimension: number) {
  const targetWidths = getVariantWidths(maxDimension);
  const variants: GeneratedVariant[] = [];

  for (const targetWidth of targetWidths) {
    const output = await sharp(buffer)
      .rotate()
      .resize({
        width: targetWidth,
        height: targetWidth,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!output.info.width || !output.info.height) {
      throw new Error(`Unable to determine generated variant dimensions for ${targetWidth}px.`);
    }

    variants.push({
      targetWidth,
      width: output.info.width,
      height: output.info.height,
      format: "webp",
      mimeType: "image/webp",
      buffer: output.data,
      byteSize: output.data.byteLength,
    });
  }

  return variants;
}

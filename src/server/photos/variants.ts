import { encode } from "blurhash";
import sharp from "sharp";
import { getVariantWidths, type PublicImageFormat } from "./variant-config";

export type { PublicImageFormat } from "./variant-config";

export interface GeneratedVariant {
  targetWidth: number;
  width: number;
  height: number;
  format: PublicImageFormat;
  mimeType: "image/avif";
  buffer: Buffer;
  byteSize: number;
}

export async function generatePublicVariants(buffer: Buffer, maxDimension: number) {
  const targetWidths = getVariantWidths(maxDimension);
  const variants: GeneratedVariant[] = [];

  for (const targetWidth of targetWidths) {
    const pipeline = sharp(buffer).rotate().resize({
      width: targetWidth,
      height: targetWidth,
      fit: "inside",
      withoutEnlargement: true,
    });
    const output = await pipeline.clone().avif({ quality: 62, effort: 4 }).toBuffer({
      resolveWithObject: true,
    });

    if (!output.info.width || !output.info.height) {
      throw new Error(
        `Unable to determine generated avif variant dimensions for ${targetWidth}px.`,
      );
    }

    variants.push({
      targetWidth,
      width: output.info.width,
      height: output.info.height,
      format: "avif",
      mimeType: "image/avif",
      buffer: output.data,
      byteSize: output.data.byteLength,
    });
  }

  return variants;
}

export async function generatePhotoBlurhash(buffer: Buffer) {
  const output = await sharp(buffer)
    .rotate()
    .resize({ width: 32, height: 32, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!output.info.width || !output.info.height || output.info.channels !== 4) {
    throw new Error("Unable to prepare RGBA pixels for BlurHash generation.");
  }

  const pixels = new Uint8ClampedArray(
    output.data.buffer,
    output.data.byteOffset,
    output.data.byteLength,
  );

  return encode(pixels, output.info.width, output.info.height, 4, 3);
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";

export async function inspectImage(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const buffer = await readFile(absolutePath);
  const [metadata, exif] = await Promise.all([sharp(buffer).metadata(), exifr.parse(buffer)]);

  return {
    path: absolutePath,
    format: metadata.format ?? null,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    space: metadata.space ?? null,
    hasAlpha: metadata.hasAlpha ?? false,
    takenAt:
      exif && exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : null,
    cameraMake: exif?.Make ?? null,
    cameraModel: exif?.Model ?? null,
    lensModel: exif?.LensModel ?? null,
    focalLength: exif?.FocalLength ?? null,
    aperture: exif?.FNumber ?? null,
    exposureTime: exif?.ExposureTime ?? null,
    iso: exif?.ISO ?? null,
    latitude: exif?.latitude ?? null,
    longitude: exif?.longitude ?? null,
  };
}

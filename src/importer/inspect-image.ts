import { readFile } from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";
import { mimeTypeForExtension, storageExtension } from "./file-utils";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type ExifRecord = Record<string, unknown>;

export interface InspectedPhoto {
  filePath: string;
  buffer: Buffer;
  sourceExtension: string;
  mimeType: string;
  format: string | null;
  width: number;
  height: number;
  orientation: number | null;
  rawExif: Record<string, JsonValue>;
  takenAt: Date | null;
  takenAtOffsetMinutes: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLengthMm: number | null;
  aperture: number | null;
  exposureTimeSeconds: number | null;
  iso: number | null;
  latitude: number | null;
  longitude: number | null;
  locationCity: string | null;
  locationDistrict: string | null;
  space: string | null;
  hasAlpha: boolean;
}

function isRecord(value: unknown): value is ExifRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, toJsonValue(nestedValue)]),
    );
  }

  return String(value);
}

function normalizeExif(value: ExifRecord) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .map(([key, nestedValue]) => [key, toJsonValue(nestedValue)]),
  ) as Record<string, JsonValue>;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function locationText(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized || null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = locationText(item);

      if (text) {
        return text;
      }
    }
  }

  return null;
}

function normalizedKey(value: string) {
  return (
    value
      .split(":")
      .at(-1)
      ?.toLowerCase()
      .replace(/[^a-z]/g, "") ?? ""
  );
}

function findLocationValue(value: unknown, keys: Set<string>, depth = 0): string | null {
  if (depth > 4 || !isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.has(normalizedKey(key))) {
      const text = locationText(nestedValue);

      if (text) {
        return text;
      }
    }
  }

  for (const nestedValue of Object.values(value)) {
    const text = findLocationValue(nestedValue, keys, depth + 1);

    if (text) {
      return text;
    }
  }

  return null;
}

function extractLocation(exif: ExifRecord) {
  return {
    city: findLocationValue(exif, new Set(["city"])),
    district: findLocationValue(exif, new Set(["sublocation", "location", "district", "county"])),
  };
}

function parseExifDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const exifDate = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);

  if (exifDate) {
    const [, year, month, day, hour, minute, second, fraction] = exifDate;
    const milliseconds = fraction ? Number(`0.${fraction}`) * 1000 : 0;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        milliseconds,
      ),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOffsetMinutes(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^([+-])(\d{2}):?(\d{2})$/);

  if (!match) {
    return null;
  }

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function orientedDimensions(width: number, height: number, orientation: number | null) {
  return orientation !== null && [5, 6, 7, 8].includes(orientation)
    ? { width: height, height: width }
    : { width, height };
}

async function readExif(buffer: Buffer) {
  try {
    const parsed = await exifr.parse(buffer, { iptc: true, xmp: true });
    return isRecord(parsed) ? parsed : {};
  } catch {
    // A valid image without readable EXIF should still be importable.
    return {};
  }
}

export async function inspectPhotoFile(filePath: string): Promise<InspectedPhoto> {
  const absolutePath = path.resolve(filePath);
  const buffer = await readFile(absolutePath);
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to determine image dimensions: ${absolutePath}`);
  }

  const exif = await readExif(buffer);
  const location = extractLocation(exif);
  const orientation = asNumber(metadata.orientation);
  const dimensions = orientedDimensions(metadata.width, metadata.height, orientation);
  const format = metadata.format ?? null;
  const extension = storageExtension(absolutePath, format);

  return {
    filePath: absolutePath,
    buffer,
    sourceExtension: extension,
    mimeType: mimeTypeForExtension(extension, format),
    format,
    width: dimensions.width,
    height: dimensions.height,
    orientation,
    rawExif: normalizeExif(exif),
    takenAt: parseExifDate(exif.DateTimeOriginal ?? exif.CreateDate ?? exif.ModifyDate),
    takenAtOffsetMinutes: parseOffsetMinutes(exif.OffsetTimeOriginal ?? exif.OffsetTime),
    cameraMake: asString(exif.Make),
    cameraModel: asString(exif.Model),
    lensModel: asString(exif.LensModel),
    focalLengthMm: asNumber(exif.FocalLength),
    aperture: asNumber(exif.FNumber ?? exif.ApertureValue),
    exposureTimeSeconds: asNumber(exif.ExposureTime),
    iso: asNumber(exif.ISO),
    latitude: asNumber(exif.latitude ?? exif.GPSLatitude),
    longitude: asNumber(exif.longitude ?? exif.GPSLongitude),
    locationCity: location.city,
    locationDistrict: location.district,
    space: metadata.space ?? null,
    hasAlpha: metadata.hasAlpha ?? false,
  };
}

export function inspectionSummary(photo: InspectedPhoto) {
  return {
    path: photo.filePath,
    format: photo.format,
    width: photo.width,
    height: photo.height,
    space: photo.space,
    hasAlpha: photo.hasAlpha,
    takenAt: photo.takenAt?.toISOString() ?? null,
    cameraMake: photo.cameraMake,
    cameraModel: photo.cameraModel,
    lensModel: photo.lensModel,
    focalLength: photo.focalLengthMm,
    aperture: photo.aperture,
    exposureTime: photo.exposureTimeSeconds,
    iso: photo.iso,
    latitude: photo.latitude,
    longitude: photo.longitude,
    locationCity: photo.locationCity,
    locationDistrict: photo.locationDistrict,
  };
}

export async function inspectImage(filePath: string) {
  return inspectionSummary(await inspectPhotoFile(filePath));
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { inspectPhotoBuffer, type InspectedPhotoBuffer } from "@/server/photos/inspect-photo";

export interface InspectedPhoto extends InspectedPhotoBuffer {
  filePath: string;
}

export async function inspectPhotoFile(filePath: string): Promise<InspectedPhoto> {
  const absolutePath = path.resolve(filePath);
  const buffer = await readFile(absolutePath);
  const inspected = await inspectPhotoBuffer(buffer, {
    originalFilename: path.basename(absolutePath),
    sourceLabel: absolutePath,
  });

  return { ...inspected, filePath: absolutePath };
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

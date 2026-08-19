import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_IMAGE_EXTENSIONS } from "./constants";

const MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

export function fileExtension(filePath: string) {
  return path.extname(filePath).slice(1).toLowerCase();
}

export function storageExtension(filePath: string, format?: string | null) {
  const extension = fileExtension(filePath);

  if (extension === "jpeg") {
    return "jpg";
  }

  if (extension) {
    return extension;
  }

  if (format === "jpeg") {
    return "jpg";
  }

  return format ?? "bin";
}

export function mimeTypeForExtension(extension: string, format?: string | null) {
  return (
    MIME_TYPES[extension.toLowerCase()] ?? (format ? `image/${format}` : "application/octet-stream")
  );
}

export function isSupportedImageFile(filePath: string) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(fileExtension(filePath));
}

async function collectFromDirectory(directoryPath: string, files: string[]) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await collectFromDirectory(entryPath, files);
    } else if (entry.isFile() && isSupportedImageFile(entryPath)) {
      files.push(entryPath);
    }
  }
}

export async function collectImageFiles(inputPaths: string[]) {
  if (inputPaths.length === 0) {
    throw new Error("Please provide at least one image file or directory.");
  }

  const files: string[] = [];

  for (const inputPath of inputPaths) {
    const absolutePath = path.resolve(inputPath);
    const stats = await lstat(absolutePath);

    if (stats.isDirectory()) {
      await collectFromDirectory(absolutePath, files);
      continue;
    }

    if (!stats.isFile()) {
      throw new Error(`Input is not a regular file or directory: ${inputPath}`);
    }

    if (!isSupportedImageFile(absolutePath)) {
      throw new Error(`Unsupported image extension: ${inputPath}`);
    }

    files.push(absolutePath);
  }

  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

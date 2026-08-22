import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_IMAGE_EXTENSIONS } from "./constants";
import { fileExtension } from "@/server/photos/source-format";

export {
  fileExtension,
  mimeTypeForExtension,
  storageExtension,
} from "@/server/photos/source-format";

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

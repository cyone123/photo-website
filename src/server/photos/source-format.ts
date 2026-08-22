import path from "node:path";

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

export function fileExtension(filename: string) {
  return path.extname(filename).slice(1).toLowerCase();
}

export function storageExtension(filename: string, format?: string | null) {
  const extension = fileExtension(filename);

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

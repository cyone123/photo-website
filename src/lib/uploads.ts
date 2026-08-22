export const MAX_UPLOAD_FILES = 20;
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
export const UPLOAD_CONCURRENCY = 2;
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const ORIGINAL_UPLOAD_CACHE_CONTROL = "private, no-store";

export const UPLOAD_EXTENSION_MIME_TYPES = {
  avif: ["image/avif"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heif", "image/heic"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  png: ["image/png"],
  tif: ["image/tiff"],
  tiff: ["image/tiff"],
  webp: ["image/webp"],
} as const;

export type UploadTaskStatus = "PENDING" | "UPLOADED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface UploadTaskView {
  id: string;
  albumId: string;
  albumTitle: string;
  originalFilename: string;
  contentType: string;
  expectedByteSize: number;
  status: UploadTaskStatus;
  photoId: string | null;
  deduplicated: boolean;
  attemptCount: number;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface InitializedUpload {
  uploadId: string;
  reservedPhotoId: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  cacheControl: string;
  expectedByteSize: number;
  presignedUrl: string;
  expiresAt: string;
}

export function uploadFileExtension(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").at(-1) ?? "";
  return basename.split(".").at(-1)?.toLowerCase() ?? "";
}

export function uploadMimeType(value: string) {
  return value.trim().toLowerCase().split(";", 1)[0];
}

export function isAcceptedUploadFile(filename: string, contentType: string) {
  const extension = uploadFileExtension(filename);
  const accepted = UPLOAD_EXTENSION_MIME_TYPES[
    extension as keyof typeof UPLOAD_EXTENSION_MIME_TYPES
  ] as readonly string[] | undefined;
  return Boolean(accepted?.includes(uploadMimeType(contentType)));
}

export function formatUploadByteSize(byteSize: number) {
  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
}

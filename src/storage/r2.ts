import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readServerEnv } from "@/config/env";

function createR2Client() {
  const env = readServerEnv();

  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for R2 access.",
    );
  }

  return new S3Client({
    endpoint: env.R2_ENDPOINT,
    region: "auto",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

let r2Client: S3Client | undefined;

export function getR2Client() {
  r2Client ??= createR2Client();
  return r2Client;
}

export function getR2Buckets() {
  const env = readServerEnv();

  if (!env.R2_PUBLIC_BUCKET || !env.R2_PRIVATE_BUCKET) {
    throw new Error("R2_PUBLIC_BUCKET and R2_PRIVATE_BUCKET are required for photo storage.");
  }

  return {
    publicBucket: env.R2_PUBLIC_BUCKET,
    privateBucket: env.R2_PRIVATE_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? null,
  };
}

export async function putR2Object(input: {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    }),
  );
}

export async function createPresignedR2PutUrl(input: {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
}) {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
    {
      expiresIn: input.expiresInSeconds,
      signableHeaders: new Set(["content-type"]),
    },
  );
}

function isR2NotFound(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey"
  );
}

export async function headR2Object(input: { bucket: string; key: string }) {
  try {
    const result = await getR2Client().send(
      new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }),
    );

    return {
      byteSize: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
      etag: result.ETag ?? null,
      lastModified: result.LastModified ?? null,
    };
  } catch (error) {
    if (isR2NotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function getR2ObjectBuffer(input: { bucket: string; key: string; maxBytes?: number }) {
  const result = await getR2Client().send(
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
  );

  if (!result.Body) {
    throw new Error(`R2 object has no body: ${input.key}`);
  }

  if (
    input.maxBytes !== undefined &&
    result.ContentLength !== undefined &&
    result.ContentLength > input.maxBytes
  ) {
    throw new Error(`R2 object exceeds the allowed size: ${input.key}`);
  }

  const bytes = await result.Body.transformToByteArray();

  if (input.maxBytes !== undefined && bytes.byteLength > input.maxBytes) {
    throw new Error(`R2 object exceeds the allowed size: ${input.key}`);
  }

  return Buffer.from(bytes);
}

export async function deleteR2Object(input: { bucket: string; key: string }) {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key }));
}

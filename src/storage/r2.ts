import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

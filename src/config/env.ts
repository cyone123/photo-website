import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  DATABASE_URL: optionalNonEmptyString,
  R2_ENDPOINT: optionalUrl,
  R2_ACCESS_KEY_ID: optionalNonEmptyString,
  R2_SECRET_ACCESS_KEY: optionalNonEmptyString,
  R2_PUBLIC_BUCKET: optionalNonEmptyString,
  R2_PRIVATE_BUCKET: optionalNonEmptyString,
  R2_PUBLIC_BASE_URL: optionalUrl,
  REVALIDATE_SECRET: optionalNonEmptyString,
  BETTER_AUTH_SECRET: optionalNonEmptyString,
  BETTER_AUTH_URL: optionalUrl,
  ADMIN_EMAIL: z.preprocess((value) => (value === "" ? undefined : value), z.email().optional()),
});

const importEnvSchema = serverEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PUBLIC_BUCKET: z.string().min(1),
  R2_PRIVATE_BUCKET: z.string().min(1),
  SITE_REVALIDATE_URL: optionalUrl,
});

const adminInitEnvSchema = serverEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

export function readServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function readImportEnv() {
  return importEnvSchema.parse(process.env);
}

export function readAdminInitEnv() {
  return adminInitEnvSchema.parse(process.env);
}

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { readImportEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { albums } from "@/db/schema";
import { inspectPhotoFile } from "@/importer/inspect-image";
import { normalizeAlbumSlug } from "@/lib/album-slug";
import { generatePhotoBlurhash, generatePublicVariants } from "@/server/photos/variants";
import { processInspectedPhotoSource } from "@/server/photos/process-photo";

type AlbumRecord = typeof albums.$inferSelect;

export interface ImportPhotoOptions {
  filePath: string;
  albumSlug: string;
  albumTitle?: string;
  photoTitle?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface ImportPhotoResult {
  status: "imported" | "skipped" | "dry-run";
  filePath: string;
  photoId?: string;
  variantCount: number;
  albumSlug: string;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export { normalizeAlbumSlug } from "@/lib/album-slug";

async function ensureAlbum(slug: string, title?: string): Promise<AlbumRecord> {
  const db = getDb();
  const existing = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const now = new Date();
  const albumValues = {
    id: randomUUID(),
    slug,
    title: title?.trim() || titleFromSlug(slug),
    status: "PUBLISHED" as const,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const [inserted] = await db.insert(albums).values(albumValues).returning();
    return inserted;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const raced = await db.select().from(albums).where(eq(albums.slug, slug)).limit(1);

    if (!raced[0]) {
      throw error;
    }

    return raced[0];
  }
}

export async function dryRunPhotoImport(options: ImportPhotoOptions): Promise<ImportPhotoResult> {
  const source = await inspectPhotoFile(options.filePath);
  const [variants] = await Promise.all([
    generatePublicVariants(source.buffer, Math.max(source.width, source.height)),
    generatePhotoBlurhash(source.buffer),
  ]);

  return {
    status: "dry-run",
    filePath: source.filePath,
    variantCount: variants.length,
    albumSlug: options.albumSlug,
  };
}

export async function importPhoto(options: ImportPhotoOptions): Promise<ImportPhotoResult> {
  if (options.dryRun) {
    return dryRunPhotoImport(options);
  }

  const source = await inspectPhotoFile(options.filePath);
  readImportEnv();
  const albumSlug = normalizeAlbumSlug(options.albumSlug);
  const album = await ensureAlbum(albumSlug, options.albumTitle);
  const result = await processInspectedPhotoSource({
    inspection: source,
    albumId: album.id,
    title: options.photoTitle,
    replaceTitle: options.photoTitle !== undefined,
    force: options.force,
  });

  return {
    status: result.status === "processed" ? "imported" : "skipped",
    filePath: source.filePath,
    photoId: result.photoId,
    variantCount: result.variantCount,
    albumSlug,
  };
}

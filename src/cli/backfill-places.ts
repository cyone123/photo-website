import { and, asc, count, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { loadProjectEnv } from "@/config/load-env";
import { getDb } from "@/db/client";
import { photos } from "@/db/schema";
import { assignPhotoPlace } from "@/server/photos/photo-place";
import { isPhotoLocationEnabled } from "@/server/photos/photo-location";
import { revalidatePublishedGallery } from "@/importer/revalidate-site";

async function main() {
  loadProjectEnv();
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run"))
    throw new Error("用法：pnpm photo:places [--dry-run]");
  const db = getDb();
  const pending = and(
    eq(photos.status, "READY"),
    isNull(photos.placeId),
    isNotNull(photos.latitude),
    isNotNull(photos.longitude),
  );
  const [coverage] = await db
    .select({
      ready: count(),
    })
    .from(photos)
    .where(eq(photos.status, "READY"));
  const [remaining] = await db.select({ value: count() }).from(photos).where(pending);
  console.log(JSON.stringify({ readyPhotos: coverage.ready, pendingWithGPS: remaining.value }));
  if (args.includes("--dry-run")) return;
  if (!isPhotoLocationEnabled()) throw new Error("请先启用 PHOTO_LOCATION_ENABLED。");
  let cursor: string | undefined;
  let assigned = 0;
  let unresolved = 0;
  let failed = 0;
  try {
    while (true) {
      const batch = await db
        .select({
          id: photos.id,
          placeId: photos.placeId,
          latitude: photos.latitude,
          longitude: photos.longitude,
        })
        .from(photos)
        .where(and(pending, cursor ? gt(photos.id, cursor) : undefined))
        .orderBy(asc(photos.id))
        .limit(100);
      if (!batch.length) break;
      for (const photo of batch) {
        try {
          if (await assignPhotoPlace(photo)) assigned += 1;
          else unresolved += 1;
        } catch (error) {
          failed += 1;
          console.error(
            JSON.stringify({
              event: "photo.place_backfill_failed",
              photoId: photo.id,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        }
        cursor = photo.id;
      }
      console.log(JSON.stringify({ assigned, unresolved, failed }));
    }
  } finally {
    if (assigned) await revalidatePublishedGallery();
  }
  console.log(JSON.stringify({ assigned, unresolved, failed, complete: true }));
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: "photo.place_backfill_failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});

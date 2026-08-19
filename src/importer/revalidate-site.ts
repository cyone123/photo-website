import { readImportEnv } from "@/config/env";

export async function revalidatePublishedGallery() {
  const { REVALIDATE_SECRET, SITE_REVALIDATE_URL } = readImportEnv();

  if (!REVALIDATE_SECRET || !SITE_REVALIDATE_URL) {
    return { status: "skipped" as const };
  }

  const response = await fetch(SITE_REVALIDATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REVALIDATE_SECRET}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Gallery cache revalidation failed with HTTP ${response.status}.`);
  }

  return { status: "revalidated" as const };
}

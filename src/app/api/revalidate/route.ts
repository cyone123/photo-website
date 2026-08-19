import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { readServerEnv } from "@/config/env";
import { GALLERY_CACHE_TAG } from "@/lib/gallery";

export const runtime = "nodejs";

function secretsMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const expectedSecret = readServerEnv().REVALIDATE_SECRET;

  if (!expectedSecret) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "gallery.revalidate.misconfigured",
        timestamp: new Date().toISOString(),
      }),
    );
    return Response.json({ error: "Revalidation is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  const actualSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!secretsMatch(actualSecret, expectedSecret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  revalidateTag(GALLERY_CACHE_TAG, { expire: 0 });

  return Response.json({ revalidated: true, tag: GALLERY_CACHE_TAG });
}

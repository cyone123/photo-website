import { ALBUM_PAGE_SIZE, getAlbumPhotoPage } from "@/lib/gallery";

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

export async function GET(request: Request, context: RouteContext<"/api/albums/[slug]/photos">) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 100_000);
  const limit = boundedInteger(url.searchParams.get("limit"), ALBUM_PAGE_SIZE, 1, 48);
  const page = await getAlbumPhotoPage(slug, offset, limit);

  if (!page) {
    return Response.json({ message: "Album not found." }, { status: 404 });
  }

  return Response.json(page, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600" },
  });
}

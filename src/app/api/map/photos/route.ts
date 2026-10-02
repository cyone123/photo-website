import { z } from "zod";
import { getMapPhotoPage, getMapPlaces } from "@/lib/gallery";

export const runtime = "nodejs";

const querySchema = z.object({
  place: z.uuid().optional(),
  country: z
    .string()
    .regex(/^[a-zA-Z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "照片查询参数无效。" }, { status: 400 });
  try {
    const { place, country, offset, limit } = query.data;
    if (
      place &&
      !(await getMapPlaces()).some(
        (entry) => entry.id === place && (!country || entry.countryCode.toUpperCase() === country),
      )
    ) {
      return Response.json({ error: "此地点暂无公开照片。" }, { status: 404 });
    }
    return Response.json(await getMapPhotoPage(place ?? null, offset, limit, country ?? null), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "map.photos_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json({ error: "暂时无法加载照片，请稍后重试。" }, { status: 500 });
  }
}

import { isAlbumSlugAvailable } from "@/server/admin/album-service";
import { getAdminSession } from "@/server/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const excludeId = url.searchParams.get("excludeId") ?? undefined;

  try {
    return Response.json(await isAlbumSlugAvailable(slug, excludeId));
  } catch {
    return Response.json({ error: "Invalid slug." }, { status: 400 });
  }
}

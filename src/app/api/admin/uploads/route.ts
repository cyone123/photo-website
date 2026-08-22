import { createUploadBatch, getAdminUploadTasks } from "@/server/admin/upload-service";
import { uploadErrorResponse } from "@/server/admin/upload-api";
import { getAdminSession } from "@/server/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const albumId = new URL(request.url).searchParams.get("albumId") ?? undefined;
    return Response.json(
      { tasks: await getAdminUploadTasks({ albumId }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > 64 * 1024) {
      return Response.json({ error: "上传初始化请求过大。" }, { status: 413 });
    }

    const body = await request.text();

    if (body.length > 64 * 1024) {
      return Response.json({ error: "上传初始化请求过大。" }, { status: 413 });
    }

    return Response.json({ uploads: await createUploadBatch(JSON.parse(body)) }, { status: 201 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

import { getAdminUploadTask } from "@/server/admin/upload-service";
import { uploadErrorResponse } from "@/server/admin/upload-api";
import { getAdminSession } from "@/server/auth/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const task = await getAdminUploadTask((await context.params).id);
    return task
      ? Response.json({ task }, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "上传任务不存在。" }, { status: 404 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

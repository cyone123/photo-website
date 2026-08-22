import { refreshAfterUpload, uploadErrorResponse } from "@/server/admin/upload-api";
import { retryUploadTask } from "@/server/admin/upload-service";
import { getAdminSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await retryUploadTask((await context.params).id);
    refreshAfterUpload("task" in result ? result.task : null);
    return Response.json(result);
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

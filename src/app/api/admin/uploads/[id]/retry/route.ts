import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { GALLERY_CACHE_TAG } from "@/lib/gallery";
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
    const uploadId = (await context.params).id;
    const result = await retryUploadTask(
      uploadId,
      (work) =>
        after(async () => {
          try {
            await work();
          } catch (error) {
            console.error(
              JSON.stringify({
                level: "error",
                event: "admin.upload.background_failed",
                uploadId,
                message: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              }),
            );
          } finally {
            revalidateTag(GALLERY_CACHE_TAG, { expire: 0 });
          }
        }),
      refreshAfterUpload,
    );
    refreshAfterUpload("task" in result ? result.task : null);
    return Response.json(result, {
      status: "action" in result && result.action === "processing" ? 202 : 200,
    });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

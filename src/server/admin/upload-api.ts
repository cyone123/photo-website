import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { GALLERY_CACHE_TAG } from "@/lib/gallery";
import type { UploadTaskView } from "@/lib/uploads";
import { UploadServiceError } from "./upload-service";

export function uploadErrorResponse(error: unknown) {
  if (error instanceof UploadServiceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return Response.json({ error: "请求内容不正确。" }, { status: 400 });
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "admin.upload.api_failed",
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }),
  );
  return Response.json({ error: "上传服务暂时不可用。" }, { status: 500 });
}

export function refreshAfterUpload(task: UploadTaskView | null) {
  if (!task || task.status !== "SUCCEEDED") {
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/uploads");
  revalidatePath("/admin/albums");
  revalidatePath(`/admin/albums/${task.albumId}`);
  revalidatePath(`/admin/albums/${task.albumId}/preview`);
  revalidateTag(GALLERY_CACHE_TAG, { expire: 0 });
}

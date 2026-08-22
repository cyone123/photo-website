import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { GALLERY_CACHE_TAG } from "@/lib/gallery";
import { refreshAfterUpload, uploadErrorResponse } from "@/server/admin/upload-api";
import { completeUploadTask } from "@/server/admin/upload-service";
import { getAdminSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const task = await completeUploadTask((await context.params).id, (work) =>
      after(async () => {
        await work();
        revalidateTag(GALLERY_CACHE_TAG, { expire: 0 });
      }),
    );
    refreshAfterUpload(task);
    return Response.json({ task });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

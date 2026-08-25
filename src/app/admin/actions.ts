"use server";

import { APIError } from "better-auth/api";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AdminActionState, AdminMutationState } from "@/components/admin/admin-action-state";
import { GALLERY_CACHE_TAG } from "@/lib/gallery";
import {
  AlbumServiceError,
  albumFieldsSchema,
  clearAlbumChapter,
  createAlbum,
  removePhotoFromAlbum,
  publishAlbum,
  saveAlbumPhotoOrder,
  unpublishAlbum,
  updateAlbumChapter,
  updateAlbumCover,
  updateAlbumDetails,
} from "@/server/admin/album-service";
import { PhotoServiceError, updatePhoto } from "@/server/admin/photo-service";
import { auth } from "@/server/auth/auth";
import { requireAdmin } from "@/server/auth/session";

const loginSchema = z.object({
  email: z.email("请输入有效的邮箱地址。"),
  password: z.string().min(1, "请输入密码。"),
  next: z.string().optional(),
});

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function albumFields(formData: FormData) {
  return albumFieldsSchema.safeParse({
    title: formText(formData, "title"),
    slug: formText(formData, "slug"),
    description: formText(formData, "description"),
    shootingContext: formText(formData, "shootingContext"),
  });
}

function actionError(error: unknown, fallback: string): AdminActionState {
  if (error instanceof AlbumServiceError || error instanceof PhotoServiceError) {
    return { status: "error", message: error.message };
  }

  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "请检查提交内容。",
      fieldErrors: error.flatten().fieldErrors,
    };
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "admin.action.failed",
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }),
  );
  return { status: "error", message: fallback };
}

function refreshAdminAlbum(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/albums");
  revalidatePath(`/admin/albums/${id}`);
  revalidatePath(`/admin/albums/${id}/preview`);
}

function refreshPublicGallery() {
  revalidateTag(GALLERY_CACHE_TAG, { expire: 0 });
}

function safeAdminDestination(value: string | undefined) {
  return value === "/admin" || value?.startsWith("/admin/") ? value : "/admin";
}

export async function loginAdmin(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = loginSchema.safeParse({
    email: formText(formData, "email").trim().toLowerCase(),
    password: formText(formData, "password"),
    next: formText(formData, "next"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "请检查登录信息。",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let signedIn: Awaited<ReturnType<typeof auth.api.signInEmail>>;

  try {
    signedIn = await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "admin.login.failed",
        error: error instanceof APIError ? error.status : "UNKNOWN",
        timestamp: new Date().toISOString(),
      }),
    );
    return { status: "error", message: "邮箱或密码不正确。" };
  }

  const roles = signedIn.user.role?.split(",").map((role) => role.trim()) ?? [];

  if (!roles.includes("admin")) {
    await auth.api.signOut({ headers: await headers() });
    return { status: "error", message: "该账号没有后台管理权限。" };
  }

  redirect(safeAdminDestination(parsed.data.next));
}

export async function logoutAdmin() {
  await requireAdmin();
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}

export async function createAlbumAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = albumFields(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "请检查相册信息。",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let created;

  try {
    created = await createAlbum(parsed.data);
  } catch (error) {
    return actionError(error, "创建相册失败，请稍后重试。");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/albums");
  redirect(`/admin/albums/${created.id}`);
}

export async function updateAlbumAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const id = formText(formData, "id");
  const parsed = albumFields(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "请检查相册信息。",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await updateAlbumDetails(id, parsed.data);
    refreshAdminAlbum(id);

    if (result.publicContentChanged) {
      refreshPublicGallery();
    }

    return { status: "success", message: "相册信息已保存。" };
  } catch (error) {
    return actionError(error, "保存失败，请稍后重试。");
  }
}

export async function publishAlbumAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const id = formText(formData, "id");

  try {
    await publishAlbum(id);
    refreshAdminAlbum(id);
    refreshPublicGallery();
    return { status: "success", message: "相册已发布，公开网站缓存已刷新。" };
  } catch (error) {
    return actionError(error, "发布失败，请稍后重试。");
  }
}

export async function unpublishAlbumAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const id = formText(formData, "id");

  try {
    await unpublishAlbum(id);
    refreshAdminAlbum(id);
    refreshPublicGallery();
    return { status: "success", message: "相册已转为草稿，公开缓存已刷新。" };
  } catch (error) {
    return actionError(error, "取消发布失败，请稍后重试。");
  }
}

export async function saveAlbumPhotoOrderAction(
  albumId: string,
  input: string[] | { photoIds: string[] },
): Promise<AdminActionState> {
  await requireAdmin();

  try {
    await saveAlbumPhotoOrder(albumId, input);
    refreshAdminAlbum(albumId);
    refreshPublicGallery();
    return { status: "success", message: "照片顺序已保存。" };
  } catch (error) {
    return actionError(error, "保存照片顺序失败，请稍后重试。");
  }
}

export async function updateAlbumCoverAction(input: {
  albumId: string;
  photoId: string;
  coverFocalX?: number;
  coverFocalY?: number;
}): Promise<AdminActionState> {
  await requireAdmin();

  try {
    await updateAlbumCover(input);
    refreshAdminAlbum(input.albumId);
    refreshPublicGallery();
    return { status: "success", message: "封面和焦点已保存。" };
  } catch (error) {
    return actionError(error, "保存封面失败，请稍后重试。");
  }
}

export async function updatePhotoAction(input: {
  id: string;
  title?: string | null;
  description?: string | null;
  takenAt?: string | null;
}): Promise<AdminActionState> {
  await requireAdmin();

  try {
    await updatePhoto(input);
    refreshPublicGallery();
    return { status: "success", message: "照片信息已保存。" };
  } catch (error) {
    return actionError(error, "保存照片信息失败，请稍后重试。");
  }
}

export async function updateAlbumChapterAction(input: {
  albumId: string;
  photoId: string;
  title?: string | null;
  text?: string | null;
}): Promise<AdminActionState> {
  await requireAdmin();

  try {
    await updateAlbumChapter(input);
    refreshAdminAlbum(input.albumId);
    refreshPublicGallery();
    return { status: "success", message: "章节内容已保存。" };
  } catch (error) {
    return actionError(error, "保存章节失败，请稍后重试。");
  }
}

export async function clearAlbumChapterAction(
  albumId: string,
  photoId: string,
): Promise<AdminActionState> {
  await requireAdmin();

  try {
    await clearAlbumChapter(albumId, photoId);
    refreshAdminAlbum(albumId);
    refreshPublicGallery();
    return { status: "success", message: "章节已清除。" };
  } catch (error) {
    return actionError(error, "清除章节失败，请稍后重试。");
  }
}

export async function removeAlbumPhotoAction(
  albumId: string,
  photoId: string,
): Promise<AdminMutationState> {
  await requireAdmin();

  try {
    const result = await removePhotoFromAlbum(albumId, photoId);
    refreshAdminAlbum(albumId);
    refreshPublicGallery();
    return {
      status: "success",
      message: result.deletedPhoto ? "照片已从相册移除并清理存储。" : "照片已从相册移除。",
      coverPhotoId: result.coverPhotoId,
      albumStatus: result.status,
    };
  } catch (error) {
    return actionError(error, "移除照片失败，请稍后重试。");
  }
}

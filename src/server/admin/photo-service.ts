import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { photos } from "@/db/schema";
import { toPhotoDate } from "@/lib/photo-date";

const photoIdSchema = z.uuid();
const updatePhotoInputSchema = z.object({
  id: photoIdSchema,
  title: z.string().max(240).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  takenAt: z
    .union([z.string().max(80), z.date()])
    .nullable()
    .optional(),
});

export interface UpdatePhotoInput {
  id: string;
  title?: string | null;
  description?: string | null;
  takenAt?: string | Date | null;
}

export class PhotoServiceError extends Error {}

function optionalText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value.trim() || null;
}

function invalidTakenAt(): never {
  throw new PhotoServiceError("拍摄时间格式不正确。");
}

function parseTakenAt(value: string | Date | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  return toPhotoDate(value) ?? invalidTakenAt();
}

export async function updatePhoto(input: UpdatePhotoInput) {
  const parsed = updatePhotoInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new PhotoServiceError("照片信息格式不正确。");
  }

  const id = parsed.data.id;
  const title = optionalText(parsed.data.title);
  const description = optionalText(parsed.data.description);
  const takenAt = parseTakenAt(parsed.data.takenAt);
  const values = {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    ...(takenAt === undefined ? {} : { takenAt }),
  };

  if (Object.keys(values).length === 0) {
    throw new PhotoServiceError("请至少编辑一项照片信息。");
  }

  const [updated] = await getDb()
    .update(photos)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(photos.id, id))
    .returning({
      id: photos.id,
      title: photos.title,
      description: photos.description,
      takenAt: photos.takenAt,
    });

  if (!updated) {
    throw new PhotoServiceError("照片不存在或已被删除。");
  }

  return updated;
}

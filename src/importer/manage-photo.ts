import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { photos } from "@/db/schema";

export interface UpdatePhotoOptions {
  id: string;
  title?: string;
  description?: string;
}

function normalizedText(value: string | undefined, field: string) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} cannot be empty.`);
  }

  return normalized;
}

export async function updatePhoto(options: UpdatePhotoOptions) {
  const title = normalizedText(options.title, "Photo title");
  const description = normalizedText(options.description, "Photo description");

  if (title === undefined && description === undefined) {
    throw new Error("Provide --title or --description.");
  }

  const [updated] = await getDb()
    .update(photos)
    .set({
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
      updatedAt: new Date(),
    })
    .where(eq(photos.id, options.id))
    .returning({ id: photos.id, title: photos.title });

  if (!updated) {
    throw new Error(`Photo not found: ${options.id}`);
  }

  return updated;
}

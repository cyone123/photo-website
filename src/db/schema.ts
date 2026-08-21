import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const photoStatusEnum = pgEnum("photo_status", ["PROCESSING", "READY", "FAILED"]);
export const albumStatusEnum = pgEnum("album_status", ["DRAFT", "PUBLISHED"]);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentHash: text("content_hash").notNull(),
    status: photoStatusEnum("status").default("PROCESSING").notNull(),
    originalKey: text("original_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: false, mode: "date" }),
    takenAtOffsetMinutes: integer("taken_at_offset_minutes"),
    cameraMake: text("camera_make"),
    cameraModel: text("camera_model"),
    lensModel: text("lens_model"),
    focalLengthMm: numeric("focal_length_mm", { precision: 8, scale: 2 }),
    aperture: numeric("aperture", { precision: 6, scale: 2 }),
    exposureTimeSeconds: numeric("exposure_time_seconds", { precision: 12, scale: 8 }),
    iso: integer("iso"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    locationCity: text("location_city"),
    locationDistrict: text("location_district"),
    rawExif: jsonb("raw_exif").$type<Record<string, unknown>>(),
    title: text("title"),
    description: text("description"),
    blurhash: text("blurhash"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("photos_content_hash_unique").on(table.contentHash),
    index("photos_status_idx").on(table.status),
    index("photos_taken_at_idx").on(table.takenAt),
  ],
);

export const photoVariants = pgTable(
  "photo_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    format: text("format").notNull(),
    mimeType: text("mime_type").notNull(),
    objectKey: text("object_key").notNull(),
    byteSize: integer("byte_size"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("photo_variants_identity_unique").on(table.photoId, table.width, table.format),
    index("photo_variants_photo_id_idx").on(table.photoId),
  ],
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    shootingContext: text("shooting_context"),
    coverPhotoId: uuid("cover_photo_id").references(() => photos.id, { onDelete: "set null" }),
    coverFocalX: integer("cover_focal_x").default(50).notNull(),
    coverFocalY: integer("cover_focal_y").default(50).notNull(),
    status: albumStatusEnum("status").default("DRAFT").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("albums_slug_unique").on(table.slug)],
);

export const albumPhotos = pgTable(
  "album_photos",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    chapterTitle: text("chapter_title"),
    chapterText: text("chapter_text"),
  },
  (table) => [
    primaryKey({ columns: [table.albumId, table.photoId] }),
    index("album_photos_sort_order_idx").on(table.albumId, table.sortOrder),
  ],
);

export const photosRelations = relations(photos, ({ many }) => ({
  variants: many(photoVariants),
  albumPhotos: many(albumPhotos),
}));

export const photoVariantsRelations = relations(photoVariants, ({ one }) => ({
  photo: one(photos, {
    fields: [photoVariants.photoId],
    references: [photos.id],
  }),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  coverPhoto: one(photos, {
    fields: [albums.coverPhotoId],
    references: [photos.id],
  }),
  albumPhotos: many(albumPhotos),
}));

export const albumPhotosRelations = relations(albumPhotos, ({ one }) => ({
  album: one(albums, {
    fields: [albumPhotos.albumId],
    references: [albums.id],
  }),
  photo: one(photos, {
    fields: [albumPhotos.photoId],
    references: [photos.id],
  }),
}));

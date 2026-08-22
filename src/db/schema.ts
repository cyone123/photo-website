import { relations } from "drizzle-orm";
import {
  boolean,
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

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    role: text("role").default("user"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true, mode: "date" }),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("account_issuer_account_id_unique").on(table.issuer, table.accountId),
    index("account_user_id_idx").on(table.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const photoStatusEnum = pgEnum("photo_status", ["PROCESSING", "READY", "FAILED"]);
export const albumStatusEnum = pgEnum("album_status", ["DRAFT", "PUBLISHED"]);
export const photoUploadStatusEnum = pgEnum("photo_upload_status", [
  "PENDING",
  "UPLOADED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
]);

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

export const photoUploads = pgTable(
  "photo_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservedPhotoId: uuid("reserved_photo_id").notNull(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    expectedByteSize: integer("expected_byte_size").notNull(),
    status: photoUploadStatusEnum("status").default("PENDING").notNull(),
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    deduplicated: boolean("deduplicated").default(false).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    failureMessage: text("failure_message"),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("photo_uploads_object_key_unique").on(table.objectKey),
    index("photo_uploads_album_id_idx").on(table.albumId),
    index("photo_uploads_status_idx").on(table.status),
    index("photo_uploads_created_at_idx").on(table.createdAt),
  ],
);

export const photosRelations = relations(photos, ({ many }) => ({
  variants: many(photoVariants),
  albumPhotos: many(albumPhotos),
  uploads: many(photoUploads),
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
  uploads: many(photoUploads),
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

export const photoUploadsRelations = relations(photoUploads, ({ one }) => ({
  album: one(albums, {
    fields: [photoUploads.albumId],
    references: [albums.id],
  }),
  photo: one(photos, {
    fields: [photoUploads.photoId],
    references: [photos.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

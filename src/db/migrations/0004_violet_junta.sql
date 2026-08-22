CREATE TYPE "public"."photo_upload_status" AS ENUM('PENDING', 'UPLOADED', 'PROCESSING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TABLE "photo_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserved_photo_id" uuid NOT NULL,
	"album_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"expected_byte_size" integer NOT NULL,
	"status" "photo_upload_status" DEFAULT 'PENDING' NOT NULL,
	"photo_id" uuid,
	"deduplicated" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"failure_message" text,
	"upload_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "photo_uploads" ADD CONSTRAINT "photo_uploads_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_uploads" ADD CONSTRAINT "photo_uploads_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "photo_uploads_object_key_unique" ON "photo_uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "photo_uploads_album_id_idx" ON "photo_uploads" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "photo_uploads_status_idx" ON "photo_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photo_uploads_created_at_idx" ON "photo_uploads" USING btree ("created_at");
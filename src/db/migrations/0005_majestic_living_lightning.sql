CREATE TABLE "photo_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"region" text,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "place_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "photo_places_source_unique" ON "photo_places" USING btree ("source","source_key");--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_place_id_photo_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."photo_places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_photos_photo_id_idx" ON "album_photos" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photos_place_id_idx" ON "photos" USING btree ("place_id");
ALTER TABLE "album_photos" ADD COLUMN "chapter_title" text;--> statement-breakpoint
ALTER TABLE "album_photos" ADD COLUMN "chapter_text" text;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "shooting_context" text;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "cover_focal_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "cover_focal_y" integer DEFAULT 50 NOT NULL;
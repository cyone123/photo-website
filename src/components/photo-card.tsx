/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "./arrow-up-right";
import { PhotoPlaceholder } from "./photo-placeholder";
import { formatPhotoDate, type GalleryPhoto } from "@/lib/gallery";

export function PhotoCard({
  photo,
  index = 0,
  priority = false,
}: {
  photo: GalleryPhoto;
  index?: number;
  priority?: boolean;
}) {
  return (
    <Link
      className="photo-card"
      href={`/photos/${photo.id}`}
      style={{ "--photo-ratio": `${photo.width} / ${photo.height}` } as CSSProperties}
    >
      <div className="photo-card-media">
        {photo.previewUrl ? (
          <img
            src={photo.previewUrl}
            alt={photo.title ?? "相册照片"}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <PhotoPlaceholder index={index} />
        )}
        <span className="photo-card-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="photo-card-caption">
        <div>
          <span className="photo-card-date">{formatPhotoDate(photo.takenAt)}</span>
          <h3>{photo.title ?? "未命名照片"}</h3>
        </div>
        <span className="photo-card-arrow">
          <ArrowUpRight />
        </span>
      </div>
    </Link>
  );
}

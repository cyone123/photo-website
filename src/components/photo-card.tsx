import type { CSSProperties } from "react";
import Link from "next/link";
import { PhotoPlaceholder } from "./photo-placeholder";
import { ResponsivePhotoImage } from "./responsive-photo-image";
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
          <ResponsivePhotoImage
            photo={photo}
            alt={photo.title ?? "相册照片"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            preferredWidth={640}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
        ) : (
          <PhotoPlaceholder index={index} />
        )}
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="photo-card-caption">
        <span className="photo-card-date">{formatPhotoDate(photo.takenAt)}</span>
        <h3>{photo.title ?? "未命名照片"}</h3>
      </div>
    </Link>
  );
}

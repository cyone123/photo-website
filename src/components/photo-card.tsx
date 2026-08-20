import type { CSSProperties } from "react";
import Link from "next/link";
import { PhotoPlaceholder } from "./photo-placeholder";
import { ResponsivePhotoImage } from "./responsive-photo-image";
import type { GalleryPhoto } from "@/lib/gallery";

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
      className="photo-card justified-photo-card"
      href={`/photos/${photo.id}`}
      data-lightbox-index={index}
      style={
        {
          "--photo-ratio": `${photo.width} / ${photo.height}`,
          "--photo-grow": String(photo.aspectRatio),
        } as CSSProperties
      }
    >
      <div className="photo-card-media">
        {photo.previewUrl ? (
          <ResponsivePhotoImage
            photo={photo}
            alt={photo.title ?? "相册照片"}
            sizes="(max-width: 480px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw"
            preferredWidth={640}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
        ) : (
          <PhotoPlaceholder index={index} />
        )}
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
    </Link>
  );
}

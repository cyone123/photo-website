import Link from "next/link";
import type { GalleryAlbumSummary } from "@/lib/gallery";
import { formatPhotoYear } from "@/lib/gallery";
import { albumHref } from "@/lib/routes";
import { PhotoPlaceholder } from "./photo-placeholder";
import { ResponsivePhotoImage } from "./responsive-photo-image";

export function AlbumCard({ album, index = 0 }: { album: GalleryAlbumSummary; index?: number }) {
  return (
    <Link className="album-card" href={albumHref(album.slug)}>
      <div className="album-card-media">
        {album.coverPhoto?.previewUrl ? (
          <ResponsivePhotoImage
            photo={album.coverPhoto}
            alt={album.title}
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw"
            preferredWidth={640}
            loading="lazy"
            objectPosition={`${album.coverFocalX}% ${album.coverFocalY}%`}
          />
        ) : (
          <PhotoPlaceholder index={index} />
        )}
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="album-card-caption">
        <span className="album-card-meta">
          {formatPhotoYear(album.publishedAt)} · {album.photoCount} 张照片
        </span>
        <h3>{album.title}</h3>
      </div>
    </Link>
  );
}

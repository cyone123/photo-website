/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { GalleryAlbum } from "@/lib/gallery";
import { formatPhotoYear } from "@/lib/gallery";
import { PhotoPlaceholder } from "./photo-placeholder";

export function AlbumCard({ album, index = 0 }: { album: GalleryAlbum; index?: number }) {
  return (
    <Link className="album-card" href={`/albums/${album.slug}`}>
      <div className="album-card-media">
        {album.coverPhoto?.previewUrl ? (
          <img
            src={album.coverPhoto.previewUrl}
            alt={album.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <PhotoPlaceholder index={index} />
        )}
        <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="album-card-caption">
        <span className="album-card-meta">
          {formatPhotoYear(album.publishedAt)} · {album.photos.length} 张照片
        </span>
        <h3>{album.title}</h3>
      </div>
    </Link>
  );
}

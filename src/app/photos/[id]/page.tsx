import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PhotoLightboxStage } from "@/components/photo-lightbox";
import { PhotoDetails } from "@/components/photo-details";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { ResponsivePhotoImage } from "@/components/responsive-photo-image";
import { getAlbumBySlug, getPhotoById } from "@/lib/gallery";
import { toLightboxPhoto } from "@/lib/lightbox";

type PhotoPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PhotoPageProps): Promise<Metadata> {
  const { id } = await params;
  const photo = await getPhotoById(id);

  return {
    title: photo?.title ?? "照片",
    description: photo?.description ?? "个人照片档案。",
  };
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params;
  const photo = await getPhotoById(id);

  if (!photo) {
    notFound();
  }

  const parentAlbum = photo.albums[0];
  const camera = [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ");
  const album = parentAlbum ? await getAlbumBySlug(parentAlbum.slug) : null;
  const viewerPhotos = album?.photos.length ? album.photos : [photo];
  const viewerIndex = Math.max(
    0,
    viewerPhotos.findIndex((albumPhoto) => albumPhoto.id === photo.id),
  );

  return (
    <main className="page-frame page-frame-main">
      <Breadcrumbs current={photo.title ?? "照片"} parent={parentAlbum?.title} />

      <header className="page-head">
        <span className="label">Photo</span>
        <h1>{photo.title ?? "未命名照片"}</h1>
        {photo.description ? <p className="page-head-meta">{photo.description}</p> : null}
      </header>

      <figure className="photo-stage">
        <PhotoLightboxStage photos={viewerPhotos.map(toLightboxPhoto)} initialIndex={viewerIndex}>
          {photo.detailUrl ? (
            <ResponsivePhotoImage
              photo={photo}
              alt={photo.title ?? "相册照片"}
              sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1488px) calc(100vw - 48px), 1440px"
              preferredWidth={1600}
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <PhotoPlaceholder index={Number.parseInt(photo.id.slice(0, 2), 16) || 0} />
          )}
        </PhotoLightboxStage>
        <figcaption className="photo-stage-footer">
          <span>
            {photo.width} × {photo.height}
            {camera ? ` · ${camera}` : ""}
          </span>
          {parentAlbum ? (
            <Link href={`/albums/${parentAlbum.slug}`}>返回 {parentAlbum.title} →</Link>
          ) : null}
        </figcaption>
      </figure>

      <PhotoDetails photo={photo} />
    </main>
  );
}

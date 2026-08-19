/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PhotoDetails } from "@/components/photo-details";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { getPhotoById } from "@/lib/gallery";

export const dynamic = "force-dynamic";

type PhotoPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PhotoPageProps): Promise<Metadata> {
  const { id } = await params;
  const photo = await getPhotoById(id);

  return {
    title: photo ? `${photo.title ?? "照片"} · 光的档案` : "照片 · 光的档案",
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

  return (
    <main className="page-frame page-frame-main">
      <Breadcrumbs current={photo.title ?? "照片"} parent={parentAlbum?.title} />

      <header className="page-head">
        <span className="label">Photo</span>
        <h1>{photo.title ?? "未命名照片"}</h1>
        {photo.description ? <p className="page-head-meta">{photo.description}</p> : null}
      </header>

      <figure className="photo-stage">
        {photo.detailUrl ? (
          <img src={photo.detailUrl} alt={photo.title ?? "相册照片"} decoding="async" />
        ) : (
          <PhotoPlaceholder index={Number.parseInt(photo.id.slice(0, 2), 16) || 0} />
        )}
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

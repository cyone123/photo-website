/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PhotoDetails } from "@/components/photo-details";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteHeader } from "@/components/site-header";
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

  return (
    <>
      <SiteHeader />
      <main className="page-frame photo-page">
        <Breadcrumbs current={photo.title ?? "照片"} parent={parentAlbum?.title} />

        <div className="photo-viewer-layout">
          <section className="photo-viewer-stage">
            {photo.detailUrl ? (
              <img src={photo.detailUrl} alt={photo.title ?? "相册照片"} decoding="async" />
            ) : (
              <PhotoPlaceholder index={Number.parseInt(photo.id.slice(0, 2), 16) || 0} />
            )}
            <div className="photo-viewer-footer">
              <span>
                {photo.width} × {photo.height}
              </span>
              {parentAlbum ? (
                <Link href={`/albums/${parentAlbum.slug}`}>返回 {parentAlbum.title} ↗</Link>
              ) : null}
            </div>
          </section>

          <PhotoDetails photo={photo} />
        </div>
      </main>
    </>
  );
}

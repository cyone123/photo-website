import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { PhotoGrid } from "@/components/photo-grid";
import { formatPhotoYear, getAlbumBySlug } from "@/lib/gallery";

export const dynamic = "force-dynamic";

type AlbumPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);

  return {
    title: album ? `${album.title} · 光的档案` : "相册 · 光的档案",
    description: album?.description ?? "个人照片相册。",
  };
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);

  if (!album) {
    notFound();
  }

  return (
    <main className="page-frame page-frame-main">
      <Breadcrumbs current={album.title} parent="相册" />

      <header className="page-head">
        <span className="label">
          Album / {formatPhotoYear(album.publishedAt)} /{" "}
          {String(album.photos.length).padStart(2, "0")} Photos
        </span>
        <h1>{album.title}</h1>
        {album.description ? <p className="page-head-meta">{album.description}</p> : null}
      </header>

      {album.photos.length > 0 ? (
        <PhotoGrid photos={album.photos} />
      ) : (
        <EmptyState title="这个相册还没有照片。" description="照片导入并发布后会在这里出现。" />
      )}
    </main>
  );
}

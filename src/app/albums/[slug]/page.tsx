import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumPhotoStream } from "@/components/album-photo-stream";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import {
  ALBUM_PAGE_SIZE,
  formatPhotoYear,
  getAlbumPhotoPage,
  getPublishedAlbumOverview,
} from "@/lib/gallery";

type AlbumPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { slug } = await params;
  const album = await getPublishedAlbumOverview(slug);

  return {
    title: album?.title ?? "相册",
    description: album?.description ?? "个人照片相册。",
  };
}

export default async function AlbumPage({ params, searchParams }: AlbumPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view;
  const viewPages = Math.min(20, Math.max(1, Number.parseInt(requestedView ?? "1", 10) || 1));
  const [album, photoPage] = await Promise.all([
    getPublishedAlbumOverview(slug),
    getAlbumPhotoPage(slug, 0, viewPages * ALBUM_PAGE_SIZE),
  ]);

  if (!album || !photoPage) {
    notFound();
  }

  return (
    <main className="page-frame page-frame-main">
      <Breadcrumbs current={album.title} parent="相册" />

      <header className="page-head">
        <span className="label">
          Album / {formatPhotoYear(album.publishedAt)} / {String(album.photoCount).padStart(2, "0")}{" "}
          Photos
        </span>
        <h1>{album.title}</h1>
        {album.description ? <p className="page-head-meta">{album.description}</p> : null}
      </header>

      {album.shootingContext ? (
        <aside className="album-context">
          <span className="label">拍摄背景 / Context</span>
          <p>{album.shootingContext}</p>
        </aside>
      ) : null}

      {photoPage.photos.length > 0 ? (
        <AlbumPhotoStream
          albumSlug={album.slug}
          initialPhotos={photoPage.photos}
          initialNextOffset={photoPage.nextOffset}
        />
      ) : (
        <EmptyState title="这个相册还没有照片。" description="照片导入并发布后会在这里出现。" />
      )}
    </main>
  );
}

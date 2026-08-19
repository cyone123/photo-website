import type { Metadata } from "next";
import { AlbumCard } from "@/components/album-card";
import { EmptyState } from "@/components/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SiteHeader } from "@/components/site-header";
import { getPublishedAlbums } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "相册 · 光的档案",
  description: "按时间和主题整理的个人照片相册。",
};

export default async function AlbumsPage() {
  const albums = await getPublishedAlbums();

  return (
    <>
      <SiteHeader />
      <main className="page-frame archive-page">
        <section className="archive-heading">
          <span className="eyebrow">ARCHIVE / {String(albums.length).padStart(2, "0")}</span>
          <h1>相册</h1>
          <p>一些地方、一些时间，以及被留下来的光。</p>
        </section>

        <section className="archive-content">
          <SectionHeading eyebrow="COLLECTIONS" title="按组观看" />
          {albums.length > 0 ? (
            <div className="album-grid">
              {albums.map((album, index) => (
                <AlbumCard key={album.id} album={album} index={index} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="第一组相册还在路上。"
              description="从本地 CLI 导入一组照片之后，它会出现在这里。"
              href="/about"
              action="了解这个档案"
            />
          )}
        </section>
      </main>
    </>
  );
}

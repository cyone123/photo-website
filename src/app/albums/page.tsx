import type { Metadata } from "next";
import { AlbumCard } from "@/components/album-card";
import { EmptyState } from "@/components/empty-state";
import { getPublishedAlbumSummaries } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "相册",
  description: "按时间和主题整理的个人照片相册。",
};

export default async function AlbumsPage() {
  const albums = await getPublishedAlbumSummaries();

  return (
    <main className="page-frame page-frame-main">
      <header className="page-head">
        <span className="label">Archive / {String(albums.length).padStart(2, "0")}</span>
        <h1>相册</h1>
      </header>

      {albums.length > 0 ? (
        <div className="album-grid">
          {albums.map((album, index) => (
            <AlbumCard key={album.id} album={album} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="还没有相册。"
          description="从本地 CLI 导入一组照片之后，它会出现在这里。"
        />
      )}
    </main>
  );
}

/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import { EmptyState } from "@/components/empty-state";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SectionHeading } from "@/components/section-heading";
import { formatPhotoYear, getLatestPhotos, getPublishedAlbums } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "光的档案 · Personal Photo Archive",
  description: "一个持续更新的个人影像档案。",
};

export default async function Home() {
  const [albums, latestPhotos] = await Promise.all([getPublishedAlbums(), getLatestPhotos(9)]);
  const featuredAlbum = albums[0];
  const featuredPhoto = featuredAlbum?.coverPhoto ?? latestPhotos[0] ?? null;
  const featuredHref = featuredAlbum
    ? `/albums/${featuredAlbum.slug}`
    : featuredPhoto
      ? `/photos/${featuredPhoto.id}`
      : null;

  return (
    <main className="page-frame-main">
      {featuredHref ? (
        <Link className="hero-band" href={featuredHref}>
          <div className="hero-band-media">
            {featuredPhoto?.detailUrl ? (
              <img
                src={featuredPhoto.detailUrl}
                alt={featuredPhoto.title ?? "精选照片"}
                decoding="async"
              />
            ) : (
              <PhotoPlaceholder index={0} />
            )}
            <div className="hero-band-copy">
              <span className="label">
                {featuredAlbum ? "精选相册 / Featured Album" : "精选照片 / Featured"}
              </span>
              <h1>{featuredAlbum?.title ?? featuredPhoto?.title ?? "光的档案"}</h1>
              {featuredAlbum ? (
                <span className="hero-band-meta">
                  {featuredAlbum.photos.length} 张照片 ·{" "}
                  {formatPhotoYear(featuredAlbum.publishedAt)}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
      ) : (
        <section className="hero-band hero-band-empty">
          <div className="hero-band-copy">
            <span className="label">Personal Photo Archive</span>
            <h1>光的档案</h1>
          </div>
        </section>
      )}

      <div className="page-frame">
        <section className="section">
          <SectionHeading label="01 / Albums" title="相册" href="/albums" />
          {albums.length > 0 ? (
            <div className="album-grid">
              {albums.slice(0, 6).map((album, index) => (
                <AlbumCard key={album.id} album={album} index={index} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="还没有相册。"
              description="从本地 CLI 导入一组照片之后，它会出现在这里。"
            />
          )}
        </section>

        {latestPhotos.length > 0 ? (
          <section className="section">
            <SectionHeading label="02 / Recent" title="最近" />
            <PhotoGrid photos={latestPhotos} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

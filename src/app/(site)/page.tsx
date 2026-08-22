import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import { EmptyState } from "@/components/empty-state";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { ResponsivePhotoImage } from "@/components/responsive-photo-image";
import { SectionHeading } from "@/components/section-heading";
import { formatPhotoYear, getLatestPhotos, getPublishedAlbumSummaries } from "@/lib/gallery";
import { albumHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "光的档案 · Personal Photo Archive",
  description: "一个持续更新的个人影像档案。",
};

export default async function Home() {
  const [albums, latestPhotos] = await Promise.all([
    getPublishedAlbumSummaries(6),
    getLatestPhotos(9),
  ]);
  const featuredAlbum = albums[0];
  const featuredPhoto = featuredAlbum?.coverPhoto ?? latestPhotos[0] ?? null;
  const featuredHref = featuredAlbum
    ? albumHref(featuredAlbum.slug)
    : featuredPhoto
      ? `/photos/${featuredPhoto.id}`
      : null;
  // hero 带宽高比跟随照片原生比例（限制在 16:9–21:9），避免 cover 裁切导致构图偏移
  const heroRatio = featuredPhoto
    ? Math.min(Math.max(featuredPhoto.aspectRatio, 16 / 9), 21 / 9)
    : 21 / 9;

  return (
    <main className="page-frame-main">
      {featuredHref ? (
        <Link className="hero-band" href={featuredHref}>
          <div
            className="hero-band-media"
            style={{ "--hero-ratio": String(heroRatio) } as CSSProperties}
          >
            {featuredPhoto?.detailUrl ? (
              <ResponsivePhotoImage
                photo={featuredPhoto}
                alt={featuredPhoto.title ?? "精选照片"}
                sizes="100vw"
                preferredWidth={1600}
                loading="eager"
                fetchPriority="high"
                objectPosition={
                  featuredAlbum
                    ? `${featuredAlbum.coverFocalX}% ${featuredAlbum.coverFocalY}%`
                    : undefined
                }
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
                  {featuredAlbum.photoCount} 张照片 · {formatPhotoYear(featuredAlbum.publishedAt)}
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

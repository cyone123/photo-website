/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import { ArrowUpRight } from "@/components/arrow-up-right";
import { EmptyState } from "@/components/empty-state";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SectionHeading } from "@/components/section-heading";
import { SiteHeader } from "@/components/site-header";
import { getLatestPhotos, getPublishedAlbums, type GalleryPhoto } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "光的档案 · Personal Photo Archive",
  description: "一个持续更新的个人影像档案。",
};

function HeroFrame({
  photo,
  albumTitle,
  albumSlug,
}: {
  photo: GalleryPhoto | null;
  albumTitle?: string;
  albumSlug?: string;
}) {
  const content = (
    <>
      <div className="hero-frame-media">
        {photo?.detailUrl ? (
          <img src={photo.detailUrl} alt={photo.title ?? "精选照片"} decoding="async" />
        ) : (
          <PhotoPlaceholder index={2} />
        )}
        <span className="hero-frame-stamp">SELECTED / 01</span>
      </div>
      <div className="hero-frame-caption">
        <span>{albumTitle ?? "FIRST LIGHT"}</span>
        <span>{photo ? "打开照片" : "档案正在形成"} ↗</span>
      </div>
    </>
  );

  return albumSlug ? (
    <Link className="hero-frame" href={`/albums/${albumSlug}`}>
      {content}
    </Link>
  ) : (
    <div className="hero-frame">{content}</div>
  );
}

export default async function Home() {
  const [albums, latestPhotos] = await Promise.all([getPublishedAlbums(), getLatestPhotos(6)]);
  const featuredAlbum = albums[0];
  const featuredPhoto = featuredAlbum?.coverPhoto ?? latestPhotos[0] ?? null;
  const imageCount = albums.reduce((total, album) => total + album.photos.length, 0);

  return (
    <>
      <SiteHeader />
      <main className="page-frame home-page">
        <section className="home-hero">
          <div className="hero-copy">
            <span className="eyebrow">PERSONAL PHOTO ARCHIVE / 2026</span>
            <h1>
              关于光、时间，<em>以及被保存下来的片刻。</em>
            </h1>
            <p>
              一个持续更新的个人影像档案。这里不追求放下所有照片，只留下那些在回看时仍然愿意停留片刻的画面。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/albums">
                浏览相册 <ArrowUpRight />
              </Link>
              <Link className="text-link" href="/about">
                关于这个档案 <span>↗</span>
              </Link>
            </div>
            <div className="hero-stats" aria-label="档案统计">
              <div>
                <strong>{String(albums.length).padStart(2, "0")}</strong>
                <span>相册</span>
              </div>
              <div>
                <strong>{String(imageCount).padStart(2, "0")}</strong>
                <span>照片</span>
              </div>
              <div>
                <strong>∞</strong>
                <span>继续更新</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-topline">
              <span>THE FIRST FRAME</span>
              <span>{String(albums.length || 1).padStart(2, "0")} / 26</span>
            </div>
            <HeroFrame
              photo={featuredPhoto}
              albumTitle={featuredAlbum?.title}
              albumSlug={featuredAlbum?.slug}
            />
            <p className="hero-visual-note">每一张照片，都是一次重新看见。</p>
          </div>
        </section>

        <section className="home-section">
          <SectionHeading eyebrow="01 / COLLECTIONS" title="按组观看" href="/albums" />
          {albums.length > 0 ? (
            <div className="album-grid home-album-grid">
              {albums.slice(0, 3).map((album, index) => (
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

        <section className="home-section home-latest-section">
          <SectionHeading eyebrow="02 / RECENTLY SEEN" title="最近看见" />
          {latestPhotos.length > 0 ? (
            <PhotoGrid photos={latestPhotos} />
          ) : (
            <div className="recent-empty">
              <span>还没有最近照片</span>
              <span>等待下一次导入 →</span>
            </div>
          )}
        </section>

        <section className="home-manifesto">
          <span className="eyebrow">03 / A SMALL NOTE</span>
          <blockquote>“最值得保存的，往往不是发生了什么，而是当时看见它的方式。”</blockquote>
          <Link className="text-link" href="/about">
            读一读这个项目 <span>↗</span>
          </Link>
        </section>
      </main>

      <footer className="site-footer">
        <span>光的档案 / PERSONAL PHOTO ARCHIVE</span>
        <span>用时间整理，用眼睛回看。</span>
      </footer>
    </>
  );
}

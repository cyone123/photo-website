"use client";

import type { CSSProperties } from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PhotoLightboxGallery } from "./photo-lightbox";
import { ResponsivePhotoImage } from "./responsive-photo-image";
import type { GalleryAlbumPhoto, GalleryDate } from "@/lib/gallery";
import { toLightboxPhoto } from "@/lib/lightbox";

const PAGE_SIZE = 24;

type AlbumPhotoPageResponse = {
  photos: GalleryAlbumPhoto[];
  nextOffset: number | null;
};

function formatPhotoDate(value: GalleryDate) {
  if (!value) {
    return "未记录日期";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未记录日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function AlbumStreamCard({
  photo,
  index,
  priority,
}: {
  photo: GalleryAlbumPhoto;
  index: number;
  priority: boolean;
}) {
  return (
    <Link
      className="photo-card justified-photo-card"
      href={`/photos/${photo.id}`}
      data-lightbox-index={index}
      style={
        {
          "--photo-ratio": `${photo.width} / ${photo.height}`,
          "--photo-grow": String(photo.aspectRatio),
        } as CSSProperties
      }
    >
      <div className="photo-card-media">
        <ResponsivePhotoImage
          photo={photo}
          alt={photo.title ?? `相册照片 ${photo.sequence}`}
          sizes="(max-width: 480px) calc(100vw - 32px), (max-width: 1024px) 50vw, 33vw"
          preferredWidth={640}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        />
        <span className="card-index">{String(photo.sequence).padStart(2, "0")}</span>
      </div>
      <div className="photo-card-caption">
        <span className="photo-card-date">{formatPhotoDate(photo.takenAt)}</span>
        <h3>{photo.title ?? "未命名照片"}</h3>
      </div>
    </Link>
  );
}

export function AlbumPhotoStream({
  albumSlug,
  initialPhotos,
  initialNextOffset,
}: {
  albumSlug: string;
  initialPhotos: GalleryAlbumPhoto[];
  initialNextOffset: number | null;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollKey = `album-scroll:${albumSlug}`;

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/photos?offset=${nextOffset}&limit=${PAGE_SIZE}`,
      );

      if (!response.ok) {
        throw new Error("暂时无法继续加载照片。");
      }

      const page = (await response.json()) as AlbumPhotoPageResponse;
      setPhotos((current) => {
        const knownIds = new Set(current.map((photo) => photo.id));
        const appended = page.photos.filter((photo) => !knownIds.has(photo.id));
        const nextPhotos = [...current, ...appended];
        const url = new URL(window.location.href);
        url.searchParams.set("view", String(Math.max(1, Math.ceil(nextPhotos.length / PAGE_SIZE))));
        window.history.replaceState(window.history.state, "", url);
        return nextPhotos;
      });
      setNextOffset(page.nextOffset);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "暂时无法继续加载照片。");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [albumSlug, nextOffset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || nextOffset === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore, nextOffset]);

  useEffect(() => {
    const storedPosition = sessionStorage.getItem(scrollKey);

    if (storedPosition) {
      const scrollY = Number(storedPosition);

      if (Number.isFinite(scrollY) && scrollY > 0) {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "auto" }));
      }
    }

    const saveScrollPosition = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    window.addEventListener("pagehide", saveScrollPosition);

    return () => {
      saveScrollPosition();
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [scrollKey]);

  return (
    <section className="album-photo-stream" aria-label="相册照片">
      <PhotoLightboxGallery
        photos={photos.map(toLightboxPhoto)}
        className="photo-grid photo-grid-justified"
      >
        {photos.map((photo, index) => (
          <Fragment key={photo.id}>
            {photo.chapterTitle || photo.chapterText ? (
              <header className="album-chapter">
                <span className="label">Chapter / {String(photo.sequence).padStart(2, "0")}</span>
                {photo.chapterTitle ? <h2>{photo.chapterTitle}</h2> : null}
                {photo.chapterText ? <p>{photo.chapterText}</p> : null}
              </header>
            ) : null}
            <AlbumStreamCard photo={photo} index={index} priority={index < 3} />
          </Fragment>
        ))}
      </PhotoLightboxGallery>

      <div ref={sentinelRef} className="album-load-more" aria-live="polite">
        {loading ? <span>正在载入下一组照片…</span> : null}
        {error ? (
          <>
            <span>{error}</span>
            <button type="button" onClick={() => void loadMore()}>
              重试
            </button>
          </>
        ) : null}
        {!loading && !error && nextOffset === null ? <span>已浏览全部照片</span> : null}
      </div>
    </section>
  );
}

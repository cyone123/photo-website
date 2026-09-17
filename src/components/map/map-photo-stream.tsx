"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoLightboxGallery } from "@/components/photo-lightbox";
import { PhotoCard } from "@/components/photo-card";
import { toLightboxPhoto } from "@/lib/lightbox";
import type { MapPhotoPage } from "@/lib/gallery";
import { MAP_PAGE_SIZE, MAP_MAX_VIEW_PAGES, mapHref } from "@/lib/photo-map";

export function MapPhotoStream({
  placeId,
  initialPage,
}: {
  placeId: string | null;
  initialPage: MapPhotoPage;
}) {
  const [photos, setPhotos] = useState(initialPage.photos);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const scrollKey = `map-scroll:${placeId ?? "all"}`;
  const view = Math.min(MAP_MAX_VIEW_PAGES, Math.max(1, Math.ceil(photos.length / MAP_PAGE_SIZE)));
  const returnTo = mapHref(placeId, view);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const position = Number(sessionStorage.getItem(scrollKey));
        if (position > 0 && Number.isFinite(position))
          window.scrollTo({ top: position, behavior: "instant" });
      } catch {
        /* Storage is optional in private browsing. */
      }
    });
    const save = () => {
      try {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      } catch {
        /* Optional storage. */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      cancelAnimationFrame(frame);
      save();
      window.removeEventListener("pagehide", save);
      activeRequest.current?.abort();
    };
  }, [scrollKey]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      offset: String(nextOffset),
      limit: String(MAP_PAGE_SIZE),
    });
    if (placeId) params.set("place", placeId);
    try {
      const response = await fetch(`/api/map/photos?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("照片载入失败");
      const page: MapPhotoPage = await response.json();
      if (controller.signal.aborted) return;
      setPhotos((current) => {
        const known = new Set(current.map((photo) => photo.id));
        return [...current, ...page.photos.filter((photo) => !known.has(photo.id))];
      });
      setNextOffset(page.nextOffset);
      const loadedView = Math.min(
        MAP_MAX_VIEW_PAGES,
        Math.ceil((nextOffset + page.photos.length) / MAP_PAGE_SIZE),
      );
      window.history.replaceState(window.history.state, "", mapHref(placeId, loadedView));
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        activeRequest.current = null;
      }
    }
  }, [nextOffset, placeId]);

  if (!photos.length)
    return (
      <div className="empty-state">
        <h3>这里还没有照片。</h3>
        <p>已发布且已确认地点的照片会显示在足迹中。</p>
      </div>
    );

  return (
    <>
      <PhotoLightboxGallery
        className="photo-grid photo-grid-justified"
        photos={photos.map((photo) => ({
          ...toLightboxPhoto(photo),
          detailHref: `/photos/${photo.id}?from=map&${new URLSearchParams({ ...(placeId ? { place: placeId } : {}), view: String(view) })}`,
        }))}
      >
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            priority={index < 3}
            href={`/photos/${photo.id}?from=map&${new URLSearchParams({ ...(placeId ? { place: placeId } : {}), view: String(view) })}`}
          />
        ))}
      </PhotoLightboxGallery>
      <div className="map-load-more" aria-live="polite">
        {error && <p>暂时无法载入照片，请重试。</p>}
        {nextOffset !== null ? (
          <button type="button" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "正在载入…" : error ? "重试" : "加载更多照片 ↓"}
          </button>
        ) : (
          <span>已浏览全部照片</span>
        )}
        <a
          className="map-back-top"
          href={returnTo}
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
        >
          返回地球 ↑
        </a>
      </div>
    </>
  );
}

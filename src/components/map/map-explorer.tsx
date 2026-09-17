"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Component, useState, useTransition, type ReactNode } from "react";
import { mapHref, placeLabel, type MapPlace } from "@/lib/photo-map";
import type { MapPhotoPage } from "@/lib/gallery";
import { MapPhotoStream } from "./map-photo-stream";

const PhotoGlobe = dynamic(() => import("./photo-globe"), {
  ssr: false,
  loading: () => <div className="map-globe map-globe-message">正在准备地球…</div>,
});

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="map-globe map-globe-message">
        此设备暂时无法显示 3D 地球。
        <br />
        你仍可使用地点列表浏览全部照片。
      </div>
    ) : (
      this.props.children
    );
  }
}

export function MapExplorer({
  places,
  selectedId,
  initialPage,
  view,
  invalidPlace,
}: {
  places: MapPlace[];
  selectedId: string | null;
  initialPage: MapPhotoPage;
  view: number;
  invalidPlace: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const selected = places.find((place) => place.id === selectedId);
  const filtered = places.filter((place) =>
    `${place.name} ${placeLabel(place)}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const select = (id: string | null) => {
    if (id === selectedId && !invalidPlace) return;
    startTransition(() => router.push(mapHref(id), { scroll: false }));
  };

  return (
    <>
      <section className="map-explorer" aria-label="探索拍摄地点" aria-busy={pending}>
        <GlobeBoundary>
          <PhotoGlobe places={places} selectedId={selectedId} onSelect={select} />
        </GlobeBoundary>
        <aside className="map-places">
          <div className="map-places-heading">
            <span className="label">拍摄地点</span>
            <span>{places.length.toLocaleString("zh-CN")}</span>
          </div>
          <label className="map-search-label" htmlFor="map-search">
            搜索地点
          </label>
          <input
            id="map-search"
            type="search"
            className="map-search"
            placeholder="搜索城市 / 地区"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="map-place map-place-all"
            aria-pressed={!selectedId && !invalidPlace}
            onClick={() => select(null)}
          >
            <span>全部足迹</span>
            <span>{places.reduce((sum, place) => sum + place.photoCount, 0)} 张</span>
          </button>
          <ul className="map-place-list">
            {filtered.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="map-place"
                  aria-pressed={place.id === selectedId}
                  onClick={() => select(place.id)}
                >
                  <span>
                    <strong>{place.name}</strong>
                    <small>{placeLabel(place)}</small>
                  </span>
                  <span>{place.photoCount} 张</span>
                </button>
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p className="map-place-empty">
              {places.length
                ? "没有找到匹配的拍摄地点。"
                : "足迹会在带有位置的照片发布后出现在这里。"}
            </p>
          )}
        </aside>
      </section>
      <div className="map-attribution">
        底图{" "}
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
          Natural Earth
        </a>{" "}
        · 地点 ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </div>
      <section className="map-results" aria-label="地点照片" aria-busy={pending}>
        <header className="map-results-heading">
          <div>
            <span className="label">Photo Archive</span>
            <h2>
              {invalidPlace ? "地点暂不可用" : (selected?.name ?? "全部足迹")}
              <span>{initialPage.total.toLocaleString("zh-CN")} 张照片</span>
            </h2>
          </div>
          {(selected || invalidPlace) && (
            <button type="button" className="map-clear" onClick={() => select(null)}>
              清除筛选 ↗
            </button>
          )}
        </header>
        <div className="map-selection-status" role="status">
          {pending
            ? "正在载入地点照片…"
            : selected
              ? `正在浏览${selected.name}的照片`
              : "探索每一处留下影像的地方"}
        </div>
        {invalidPlace ? (
          <p className="map-place-empty">此地点不存在或暂无公开照片，请选择其他地点。</p>
        ) : (
          <MapPhotoStream
            key={`${selectedId ?? "all"}:${view}`}
            placeId={selectedId}
            initialPage={initialPage}
          />
        )}
      </section>
    </>
  );
}

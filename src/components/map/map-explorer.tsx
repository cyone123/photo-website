"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Component, useState, useTransition, type ReactNode } from "react";
import { mapHref, placeLabel, countryName, mapCountries, type MapPlace } from "@/lib/photo-map";
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
        此设备暂时无法显示地球。你仍可使用列表浏览照片。
      </div>
    ) : (
      this.props.children
    );
  }
}

export function MapExplorer({
  places,
  selectedId,
  country,
  initialPage,
  view,
  invalidPlace,
}: {
  places: MapPlace[];
  selectedId: string | null;
  country: string | null;
  initialPage: MapPhotoPage;
  view: number;
  invalidPlace: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const selected = places.find((place) => place.id === selectedId);
  const countries = mapCountries(places);
  const matches = (text: string) =>
    text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const filtered = places.filter(
    (place) =>
      (!country || place.countryCode.toUpperCase() === country) &&
      matches(`${place.name} ${placeLabel(place)} ${countryName(place.countryCode.toUpperCase())}`),
  );
  const navigate = (id: string | null, code: string | null) => {
    if (id === selectedId && code === country && !invalidPlace) return;
    startTransition(() => router.push(mapHref(id, 1, code), { scroll: false }));
  };
  const select = (id: string) => {
    const place = places.find((entry) => entry.id === id);
    if (place) navigate(id, place.countryCode.toUpperCase());
  };
  const selectCountry = (code: string) => navigate(null, code);
  const title = invalidPlace
    ? "地点暂不可用"
    : (selected?.name ?? (country ? countryName(country) : "全部足迹"));

  return (
    <>
      <nav className="map-breadcrumb" aria-label="足迹筛选路径">
        <button
          type="button"
          onClick={() => navigate(null, null)}
          aria-current={!country && !selected ? "page" : undefined}
        >
          全部足迹
        </button>
        {country && (
          <>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => selectCountry(country)}
              aria-current={!selected ? "page" : undefined}
            >
              {countryName(country)}
            </button>
          </>
        )}
        {selected && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{selected.name}</span>
          </>
        )}
      </nav>
      <section className="map-explorer" aria-label="探索拍摄地点" aria-busy={pending}>
        <GlobeBoundary>
          <PhotoGlobe
            places={places}
            selectedId={selectedId}
            country={country}
            onSelect={select}
            onCountrySelect={selectCountry}
          />
        </GlobeBoundary>
        <aside className="map-places">
          <div className="map-places-heading">
            <span className="label">{country ? countryName(country) : "世界足迹"}</span>
            <span>{filtered.length} 个地点</span>
          </div>
          <label className="map-search-label" htmlFor="map-search">
            搜索国家 / 地点
          </label>
          <input
            id="map-search"
            type="search"
            className="map-search"
            placeholder="搜索国家、城市或地区"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="map-place map-place-all"
            aria-pressed={!country && !selectedId}
            onClick={() => navigate(null, null)}
          >
            <span>全部足迹</span>
            <span>{places.reduce((sum, place) => sum + place.photoCount, 0)} 张</span>
          </button>
          <ul className="map-place-list">
            {!country &&
              countries
                .filter((entry) => matches(`${entry.name} ${entry.code}`))
                .map((entry) => (
                  <li key={entry.code}>
                    <button
                      type="button"
                      className="map-place map-country"
                      onClick={() => selectCountry(entry.code)}
                    >
                      <span>
                        <strong>{entry.name}</strong>
                        <small>国家 / 地区 →</small>
                      </span>
                      <span>{entry.photoCount} 张</span>
                    </button>
                  </li>
                ))}
            {country && (
              <li>
                <button
                  type="button"
                  className="map-place map-country"
                  aria-pressed={!selectedId}
                  onClick={() => selectCountry(country)}
                >
                  <span>{countryName(country)}全部照片</span>
                  <span>
                    {countries.find((entry) => entry.code === country)?.photoCount ?? 0} 张
                  </span>
                </button>
              </li>
            )}
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
              {search ? "没有找到匹配的拍摄地点。" : "这里还没有公开的拍摄足迹。"}
            </p>
          )}
        </aside>
      </section>
      <div className="map-attribution">
        拍摄地点 ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </div>
      <section className="map-results" aria-label="地点照片" aria-busy={pending}>
        <header className="map-results-heading">
          <div>
            <span className="label">Photo Archive</span>
            <h2>
              {title}
              <span>{initialPage.total.toLocaleString("zh-CN")} 张照片</span>
            </h2>
          </div>
          {(country || selected || invalidPlace) && (
            <button type="button" className="map-clear" onClick={() => navigate(null, null)}>
              清除筛选 ↗
            </button>
          )}
        </header>
        <div className="map-selection-status" role="status">
          {pending ? "正在载入照片…" : `正在浏览${title}`}
        </div>
        {invalidPlace ? (
          <p className="map-place-empty">此筛选不存在或地点不属于所选国家，请选择其他地点。</p>
        ) : (
          <MapPhotoStream
            key={`${country ?? "all"}:${selectedId ?? "all"}:${view}`}
            placeId={selectedId}
            country={country}
            initialPage={initialPage}
          />
        )}
      </section>
    </>
  );
}

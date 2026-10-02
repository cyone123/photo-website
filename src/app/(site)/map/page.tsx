import type { Metadata } from "next";
import { z } from "zod";
import { getMapPlaces, getMapPhotoPage } from "@/lib/gallery";
import { MAP_PAGE_SIZE, mapViewPages, normalizeCountry, mapCountries } from "@/lib/photo-map";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = {
  title: "足迹",
  description: "转动地球，沿着拍摄足迹探索每一个城市的影像。",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string; view?: string; country?: string }>;
}) {
  const query = await searchParams;
  const places = await getMapPlaces();
  const requestedCountry = normalizeCountry(query.country);
  const selectedId =
    query.place &&
    z.uuid().safeParse(query.place).success &&
    places.some(
      (place) =>
        place.id === query.place &&
        (!requestedCountry || place.countryCode.toUpperCase() === requestedCountry),
    )
      ? query.place
      : null;
  const country =
    requestedCountry ??
    normalizeCountry(places.find((place) => place.id === selectedId)?.countryCode);
  const invalidPlace = Boolean(
    (query.place && !selectedId) || (query.country && !requestedCountry),
  );
  const view = mapViewPages(query.view);
  const page = invalidPlace
    ? { photos: [], total: 0, nextOffset: null }
    : await getMapPhotoPage(selectedId, 0, MAP_PAGE_SIZE * view, country);
  return (
    <main className="page-frame page-frame-main map-page">
      <header className="page-head map-page-head">
        <div>
          <span className="label">Places / 光的坐标</span>
          <h1>足迹</h1>
          <p>转动地球，重访每一个被镜头记住的地方。</p>
        </div>
        <div className="map-stats">
          <div>
            <strong>{mapCountries(places).length}</strong>
            <span>国家 / 地区</span>
          </div>
          <div>
            <strong>{places.length.toLocaleString("zh-CN")}</strong>
            <span>拍摄地点</span>
          </div>
          <div>
            <strong>
              {places.reduce((sum, place) => sum + place.photoCount, 0).toLocaleString("zh-CN")}
            </strong>
            <span>有地点的照片</span>
          </div>
        </div>
      </header>
      <MapExplorer
        places={places}
        selectedId={selectedId}
        country={country}
        initialPage={page}
        view={view}
        invalidPlace={invalidPlace}
      />
    </main>
  );
}

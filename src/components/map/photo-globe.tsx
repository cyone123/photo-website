"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type ExpressionSpecification,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { countryName, mapCountries, normalizeCountry, type MapPlace } from "@/lib/photo-map";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const emptyCollection = { type: "FeatureCollection" as const, features: [] };
const countryCode: ExpressionSpecification = ["get", "iso_3166_1"];

type Props = {
  places: MapPlace[];
  selectedId: string | null;
  country: string | null;
  onSelect: (id: string) => void;
  onCountrySelect: (code: string) => void;
};

export default function PhotoGlobe(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { places, selectedId, country } = props;

  useEffect(() => {
    latest.current = props;
  }, [props]);

  useEffect(() => {
    if (!container.current || !TOKEN?.startsWith("pk.")) return;
    let instance: MapboxMap;
    let disposed = false;
    let loaded = false;
    try {
      instance = new mapboxgl.Map({
        container: container.current,
        accessToken: TOKEN,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        language: "zh-Hans",
        worldview: "US",
        center: [110, 20],
        zoom: 1.25,
        minZoom: 0.6,
        maxZoom: 15,
        attributionControl: true,
      });
    } catch {
      // Defer state updates; initialization can fail on devices without WebGL.
      queueMicrotask(() => {
        if (!disposed) setFailed(true);
      });
      return () => {
        disposed = true;
      };
    }
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: true,
      className: "map-photo-popup",
    });
    const timeout = window.setTimeout(() => {
      if (!loaded && !disposed) setFailed(true);
    }, 25000);
    instance.on("error", (event) => {
      // Never log SDK errors: request URLs may include the public token.
      const status = (event.error as Error & { status?: number }).status;
      if (
        !loaded ||
        status === 401 ||
        status === 403 ||
        ("sourceId" in event && event.sourceId === "footprint-countries")
      )
        setFailed(true);
    });
    instance.on("webglcontextlost", () => setFailed(true));
    instance.on("load", () => {
      if (disposed) return;
      loaded = true;
      clearTimeout(timeout);
      instance.setFog({
        color: "#172535",
        "high-color": "#152a48",
        "space-color": "#080b10",
        "star-intensity": 0.15,
      });
      const layers = instance.getStyle().layers;
      const before = layers.find((layer) => layer.type === "symbol")?.id;
      instance.addSource("footprint-countries", {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1",
      });
      // Match the default Dark v11 worldview and exclude overlapping disputed polygons.
      const filter: ExpressionSpecification = [
        "all",
        ["==", ["get", "disputed"], "false"],
        ["any", ["==", ["get", "worldview"], "all"], ["in", "US", ["get", "worldview"]]],
      ];
      instance.addLayer(
        {
          id: "footprint-countries",
          type: "fill",
          source: "footprint-countries",
          "source-layer": "country_boundaries",
          filter,
          paint: { "fill-color": "#338bcc", "fill-opacity": 0.01 },
        },
        before,
      );
      instance.addLayer(
        {
          id: "footprint-country-outline",
          type: "line",
          source: "footprint-countries",
          "source-layer": "country_boundaries",
          filter,
          paint: { "line-color": "#6ab8f0", "line-width": 1.3, "line-opacity": 0 },
        },
        before,
      );
      instance.addSource("footprint-places", {
        type: "geojson",
        data: emptyCollection,
        cluster: true,
        clusterRadius: 36,
        clusterMaxZoom: 10,
        clusterProperties: { photos: ["+", ["get", "photoCount"]] },
      });
      instance.addLayer({
        id: "footprint-clusters",
        type: "circle",
        source: "footprint-places",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": 18,
          "circle-color": "#246aa0",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#aad9ff",
        },
      });
      instance.addLayer({
        id: "footprint-cluster-count",
        type: "symbol",
        source: "footprint-places",
        filter: ["has", "point_count"],
        layout: { "text-field": ["to-string", ["get", "photos"]], "text-size": 12 },
        paint: { "text-color": "#ffffff" },
      });
      instance.addLayer({
        id: "footprint-points",
        type: "circle",
        source: "footprint-places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
          "circle-color": "#ffffff",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#287caf",
        },
      });
      instance.on("click", (event) => {
        const features = instance.queryRenderedFeatures(event.point, {
          layers: ["footprint-points", "footprint-clusters", "footprint-countries"],
        });
        const point = features.find((feature) => feature.layer?.id === "footprint-points");
        const cluster = features.find((feature) => feature.layer?.id === "footprint-clusters");
        if (point?.properties?.id) {
          latest.current.onSelect(String(point.properties.id));
          return;
        }
        if (cluster && cluster.geometry.type === "Point") {
          const coordinates = cluster.geometry.coordinates as [number, number];
          (instance.getSource("footprint-places") as GeoJSONSource).getClusterExpansionZoom(
            Number(cluster.properties?.cluster_id),
            (error, zoom) => {
              if (!error && zoom != null && !disposed)
                instance.easeTo({ center: coordinates, zoom, duration: 650 });
            },
          );
          return;
        }
        const code = normalizeCountry(
          features.find((feature) => feature.layer?.id === "footprint-countries")?.properties
            ?.iso_3166_1,
        );
        if (code) {
          latest.current.onCountrySelect(code);
          if (!latest.current.places.some((place) => place.countryCode.toUpperCase() === code))
            instance.flyTo({ center: event.lngLat, zoom: 3.5 });
        }
      });
      instance.on("mousemove", (event) => {
        if (instance.isMoving()) return;
        const features = instance.queryRenderedFeatures(event.point, {
          layers: ["footprint-points", "footprint-clusters", "footprint-countries"],
        });
        const point = features.find((feature) => feature.layer?.id === "footprint-points");
        const cluster = features.find((feature) => feature.layer?.id === "footprint-clusters");
        const code = normalizeCountry(
          features.find((feature) => feature.layer?.id === "footprint-countries")?.properties
            ?.iso_3166_1,
        );
        instance.getCanvas().style.cursor = features.length ? "pointer" : "";
        const label = point
          ? `${point.properties?.name} · ${point.properties?.photoCount} 张照片`
          : cluster
            ? `${cluster.properties?.photos} 张照片 · 点击展开`
            : code
              ? `${countryName(code)} · ${mapCountries(latest.current.places).find((entry) => entry.code === code)?.photoCount ?? 0} 张照片`
              : null;
        if (label) popup.setLngLat(event.lngLat).setText(label).addTo(instance);
        else popup.remove();
      });
      setFailed(false);
      setReady(true);
    });
    const leave = () => popup.remove();
    instance.getCanvas().addEventListener("mouseleave", leave);
    instance.on("movestart", leave);
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      resize.disconnect();
      popup.remove();
      instance.remove();
      map.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const countries = mapCountries(places).map((entry) => entry.code);
    instance.setPaintProperty("footprint-countries", "fill-opacity", [
      "case",
      ["==", countryCode, country ?? ""],
      0.5,
      ["in", countryCode, ["literal", countries]],
      0.25,
      0.01,
    ]);
    instance.setPaintProperty("footprint-country-outline", "line-opacity", [
      "case",
      ["==", countryCode, country ?? ""],
      0.9,
      0,
    ]);
    const visible = places.filter(
      (place) => !country || place.countryCode.toUpperCase() === country,
    );
    (instance.getSource("footprint-places") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: visible.map((place) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
        properties: { id: place.id, name: place.name, photoCount: place.photoCount },
      })),
    });
    instance.setPaintProperty("footprint-points", "circle-radius", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      10,
      7,
    ]);
    const selected = places.find((place) => place.id === selectedId);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850;
    if (selected)
      instance.flyTo({ center: [selected.longitude, selected.latitude], zoom: 8, duration });
    else if (country && visible.length) {
      // Unwrap around the first point so trips crossing the date line stay together.
      const anchor = visible[0].longitude;
      const bounds = new mapboxgl.LngLatBounds();
      for (const place of visible)
        bounds.extend([anchor + ((place.longitude - anchor + 540) % 360) - 180, place.latitude]);
      instance.fitBounds(bounds, { padding: 65, maxZoom: 4.5, duration });
    } else if (!country) instance.flyTo({ center: [110, 20], zoom: 1.25, duration });
  }, [ready, places, selectedId, country]);

  const missingToken = !TOKEN?.startsWith("pk.");
  return (
    <div className="map-globe mapbox-globe">
      <div ref={container} className="mapbox-container" aria-label="全球旅行足迹交互地图" />
      {(missingToken || failed || !ready) && (
        <div className="map-globe-overlay" role="status">
          <p>{missingToken ? "地图暂未启用" : failed ? "地图暂时无法加载" : "正在载入全球地图…"}</p>
          {(missingToken || failed) && <p>你仍可使用国家和地点列表浏览照片。</p>}
          {failed && !missingToken && (
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setReady(false);
                setAttempt((value) => value + 1);
              }}
            >
              重试地图
            </button>
          )}
        </div>
      )}
      {ready && !failed && <div className="map-globe-hint">拖动探索世界 · 点击国家或拍摄地点</div>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import type { MapPlace } from "@/lib/photo-map";

export default function PhotoGlobe({
  places,
  selectedId,
  onSelect,
}: {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 520 });
  const [land, setLand] = useState<object[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [material] = useState(() => new MeshPhongMaterial({ color: "#080c12", shininess: 8 }));
  const selected = places.find((place) => place.id === selectedId);
  const focus = selected ?? places[0];

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      }),
    );
    observer.observe(node);
    const controller = new AbortController();
    fetch("/map/land.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("地图加载失败");
        return response.json();
      })
      .then((data) => setLand(data.features))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    return () => {
      observer.disconnect();
      controller.abort();
      motion.removeEventListener("change", updateMotion);
    };
  }, []);

  useEffect(() => {
    if (!ready || !globe.current) return;
    const instance = globe.current;
    instance.pointOfView(
      { lat: focus?.latitude ?? 25, lng: focus?.longitude ?? 110, altitude: selected ? 1.5 : 2.15 },
      reducedMotion ? 0 : 850,
    );
  }, [ready, focus?.latitude, focus?.longitude, selected, reducedMotion]);

  useEffect(() => {
    if (!ready || failed || !globe.current || !container.current) return;
    const instance = globe.current;
    const controls = instance.controls();
    controls.enablePan = false;
    controls.minDistance = 160;
    controls.maxDistance = 450;
    controls.autoRotate = false;
    controls.enableDamping = !reducedMotion;
    instance.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    let visible = true;
    const update = () => {
      if (document.hidden || !visible) instance.pauseAnimation();
      else instance.resumeAnimation();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(container.current);
    document.addEventListener("visibilitychange", update);
    const canvas = instance.renderer().domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", lost);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [ready, reducedMotion, failed]);

  return (
    <div className="map-globe" ref={container} aria-label="拍摄足迹地球，亦可使用地点列表选择">
      {failed ? (
        <div className="map-globe-message">地球暂时无法显示，请使用地点列表浏览照片。</div>
      ) : size.width > 0 ? (
        <Globe
          ref={globe}
          width={size.width}
          height={size.height}
          backgroundColor="#000000"
          globeMaterial={material}
          showAtmosphere
          atmosphereColor="#1c69d4"
          atmosphereAltitude={0.12}
          animateIn={false}
          polygonsData={land}
          polygonCapColor={() => "#202b3c"}
          polygonSideColor={() => "#202b3c"}
          polygonStrokeColor={() => "#44536a"}
          polygonAltitude={0.002}
          polygonsTransitionDuration={0}
          pointsData={places}
          pointLat="latitude"
          pointLng="longitude"
          pointAltitude={0.012}
          pointRadius={(point) => ((point as MapPlace).id === selectedId ? 1 : 0.75)}
          pointColor={() => "#ffffff"}
          pointsTransitionDuration={0}
          pointLabel={(point) => {
            const place = point as MapPlace;
            // The globe library treats tooltip strings as HTML; use textContent instead.
            const label = document.createElement("span");
            label.textContent = `${place.name} · ${place.photoCount} 张照片`;
            return label.innerHTML;
          }}
          onPointClick={(point) => onSelect((point as MapPlace).id)}
          ringsData={selected && !reducedMotion ? [selected] : []}
          ringLat="latitude"
          ringLng="longitude"
          ringColor={() => "#1c69d4"}
          ringMaxRadius={2}
          ringPropagationSpeed={reducedMotion ? 0 : 1}
          ringRepeatPeriod={reducedMotion ? 0 : 1800}
          onGlobeReady={() => setReady(true)}
        />
      ) : (
        <div className="map-globe-message">正在准备地球…</div>
      )}
      {!failed && <span className="map-globe-hint">拖动旋转 · 缩放探索 · 点击光点</span>}
    </div>
  );
}

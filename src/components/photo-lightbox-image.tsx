"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LightboxPhoto } from "./photo-lightbox-types";

type Point = { x: number; y: number };
type Zoom = Point & { scale: number };
const INITIAL_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };
const MAX_SCALE = 5;

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PhotoLightboxImage({
  photo,
  transitionDirection,
  onPrevious,
  onNext,
  children,
}: {
  photo: LightboxPhoto;
  transitionDirection: "initial" | "previous" | "next";
  onPrevious: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef(INITIAL_ZOOM);
  const pointers = useRef(new Map<number, Point>());
  const swipeStart = useRef<Point | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dragging, setDragging] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const sourceSet = photo.sources.map((source) => `${source.url} ${source.width}w`).join(", ");
  const sizes = `(max-width: 640px) ${Math.ceil(100 * zoom.scale)}vw, calc(${Math.ceil(100 * zoom.scale)}vw - ${168 * zoom.scale}px)`;

  const updateZoom = useCallback((next: Zoom) => {
    const stage = stageRef.current;
    const image = imageRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(1, next.scale));
    let x = 0;
    let y = 0;

    if (scale > 1 && stage && image?.naturalWidth && image.naturalHeight) {
      const fit = Math.min(
        image.clientWidth / image.naturalWidth,
        image.clientHeight / image.naturalHeight,
      );
      const maxX = Math.max(0, (image.naturalWidth * fit * scale - stage.clientWidth) / 2);
      const maxY = Math.max(0, (image.naturalHeight * fit * scale - stage.clientHeight) / 2);
      x = Math.min(maxX, Math.max(-maxX, next.x));
      y = Math.min(maxY, Math.max(-maxY, next.y));
    }

    zoomRef.current = { scale, x, y };
    setZoom(zoomRef.current);
  }, []);

  const zoomAt = useCallback(
    (requestedScale: number, anchor: Point, movement: Point = { x: 0, y: 0 }) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const current = zoomRef.current;
      const scale = Math.min(MAX_SCALE, Math.max(1, requestedScale));
      const ratio = scale / current.scale;
      const x = anchor.x - rect.left - rect.width / 2;
      const y = anchor.y - rect.top - rect.height / 2;
      updateZoom({
        scale,
        x: x - (x - current.x) * ratio + movement.x,
        y: y - (y - current.y) * ratio + movement.y,
      });
    },
    [updateZoom],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (pointers.current.size > 0) return;
      swipeStart.current = null;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage!.clientHeight : 1);
      zoomAt(zoomRef.current.scale * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002), {
        x: event.clientX,
        y: event.clientY,
      });
    }

    // React wheel listeners are passive; cancel native scrolling with a native listener.
    stage.addEventListener("wheel", handleWheel, { passive: false });
    const observer = new ResizeObserver(() => updateZoom(zoomRef.current));
    observer.observe(stage);
    return () => {
      stage.removeEventListener("wheel", handleWheel);
      observer.disconnect();
    };
  }, [updateZoom, zoomAt]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, a")) return;
    event.preventDefault();
    // Start dragging from the visible transform, even midway through a wheel transition.
    if (pointers.current.size === 0 && imageRef.current) {
      const transform = new DOMMatrixReadOnly(getComputedStyle(imageRef.current).transform);
      updateZoom({ scale: transform.a, x: transform.e, y: transform.f });
    }
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    swipeStart.current =
      pointers.current.size === 1 && event.pointerType === "touch" && zoomRef.current.scale === 1
        ? point
        : null;
    setDragging(zoomRef.current.scale > 1);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const before = Array.from(pointers.current.values());
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    const after = Array.from(pointers.current.values());

    if (before.length >= 2) {
      swipeStart.current = null;
      const oldCenter = midpoint(before[0], before[1]);
      const newCenter = midpoint(after[0], after[1]);
      const oldDistance = distance(before[0], before[1]);
      if (oldDistance > 0) {
        zoomAt((zoomRef.current.scale * distance(after[0], after[1])) / oldDistance, oldCenter, {
          x: newCenter.x - oldCenter.x,
          y: newCenter.y - oldCenter.y,
        });
      }
    } else if (zoomRef.current.scale > 1) {
      swipeStart.current = null;
      updateZoom({
        ...zoomRef.current,
        x: zoomRef.current.x + point.x - previous.x,
        y: zoomRef.current.y + point.y - previous.y,
      });
    }
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    if (!pointers.current.delete(event.pointerId)) return;
    const start = swipeStart.current;
    swipeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(pointers.current.size > 0 && zoomRef.current.scale > 1);
    setInteracting(pointers.current.size > 0);
    if (cancelled || !start || pointers.current.size || zoomRef.current.scale !== 1) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0) onPrevious();
      else onNext();
    }
  }

  return (
    <div
      ref={stageRef}
      className="photo-lightbox-stage"
      data-zoomed={zoom.scale > 1 || undefined}
      data-dragging={dragging || undefined}
      data-interacting={interacting || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onLostPointerCapture={(event) => finishPointer(event, true)}
    >
      {photo.fallbackUrl ? (
        <picture className={`photo-lightbox-picture photo-lightbox-picture-${transitionDirection}`}>
          {sourceSet ? <source type="image/avif" srcSet={sourceSet} sizes={sizes} /> : null}
          <img
            ref={imageRef}
            src={photo.fallbackUrl}
            srcSet={sourceSet}
            sizes={sizes}
            alt={photo.title}
            decoding="async"
            draggable={false}
            onLoad={() => updateZoom(zoomRef.current)}
            style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
          />
        </picture>
      ) : (
        <div className="photo-lightbox-missing">暂无可用图片</div>
      )}
      {children}
    </div>
  );
}

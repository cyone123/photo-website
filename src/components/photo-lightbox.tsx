"use client";

/* eslint-disable @next/next/no-img-element -- R2 responsive variants are selected directly with srcset inside the fullscreen viewer. */

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LightboxPhoto } from "./photo-lightbox-types";

type PhotoLightboxProps = {
  photos: LightboxPhoto[];
  activeIndex: number | null;
  onActiveIndexChange: (index: number | null) => void;
};

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function PhotoLightbox({ photos, activeIndex, onActiveIndexChange }: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const photo = activeIndex === null ? null : photos[activeIndex];
  const canNavigate = photos.length > 1;

  const close = useCallback(() => {
    onActiveIndexChange(null);
  }, [onActiveIndexChange]);

  const showPrevious = useCallback(() => {
    if (!canNavigate || activeIndex === null) {
      return;
    }

    onActiveIndexChange((activeIndex - 1 + photos.length) % photos.length);
  }, [activeIndex, canNavigate, onActiveIndexChange, photos.length]);

  const showNext = useCallback(() => {
    if (!canNavigate || activeIndex === null) {
      return;
    }

    onActiveIndexChange((activeIndex + 1) % photos.length);
  }, [activeIndex, canNavigate, onActiveIndexChange, photos.length]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (activeIndex !== null && !dialog.open) {
      dialog.showModal();
    } else if (activeIndex === null && dialog.open) {
      dialog.close();
    }
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null || photos.length < 2) {
      return;
    }

    const adjacentIndexes = [
      (activeIndex - 1 + photos.length) % photos.length,
      (activeIndex + 1) % photos.length,
    ];

    for (const index of new Set(adjacentIndexes)) {
      const adjacentPhoto = photos[index];

      if (!adjacentPhoto?.fallbackUrl) {
        continue;
      }

      const image = new Image();
      image.src = adjacentPhoto.fallbackUrl;
      image.srcset = adjacentPhoto.sources
        .map((source) => `${source.url} ${source.width}w`)
        .join(", ");
      image.sizes = "100vw";
    }
  }, [activeIndex, photos]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    touchStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;

    if (!start || event.pointerType !== "touch") {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX > 0) {
      showPrevious();
    } else {
      showNext();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="photo-lightbox"
      aria-label="全屏照片查看器"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      {photo ? (
        <div className="photo-lightbox-shell">
          <header className="photo-lightbox-header">
            <div className="photo-lightbox-heading">
              <span className="photo-lightbox-count">
                {String((activeIndex ?? 0) + 1).padStart(2, "0")} /{" "}
                {String(photos.length).padStart(2, "0")}
              </span>
              <strong>{photo.title}</strong>
            </div>
            <button
              className="photo-lightbox-icon"
              type="button"
              onClick={close}
              aria-label="关闭全屏查看"
            >
              <CloseIcon />
            </button>
          </header>

          <div
            className="photo-lightbox-stage"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            {photo.fallbackUrl ? (
              <img
                key={photo.id}
                src={photo.fallbackUrl}
                srcSet={photo.sources.map((source) => `${source.url} ${source.width}w`).join(", ")}
                sizes="100vw"
                alt={photo.title}
                decoding="async"
              />
            ) : (
              <div className="photo-lightbox-missing">暂无可用图片</div>
            )}

            {canNavigate ? (
              <>
                <button
                  className="photo-lightbox-nav photo-lightbox-nav-previous"
                  type="button"
                  onClick={showPrevious}
                  aria-label="查看上一张照片"
                >
                  <ArrowIcon direction="left" />
                </button>
                <button
                  className="photo-lightbox-nav photo-lightbox-nav-next"
                  type="button"
                  onClick={showNext}
                  aria-label="查看下一张照片"
                >
                  <ArrowIcon direction="right" />
                </button>
              </>
            ) : null}
          </div>

          <footer className="photo-lightbox-footer">
            <div className="photo-lightbox-meta">
              <span>{photo.dateLabel}</span>
              <span>{photo.dimensionsLabel}</span>
              {photo.cameraLabel ? <span>{photo.cameraLabel}</span> : null}
            </div>
            <div className="photo-lightbox-actions">
              {photo.description ? <p>{photo.description}</p> : null}
              <Link href={photo.detailHref} onClick={close}>
                查看照片信息 →
              </Link>
            </div>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}

export function PhotoLightboxGallery({
  photos,
  children,
}: {
  photos: LightboxPhoto[];
  children: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      <div
        className="photo-grid"
        onClickCapture={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }

          const target = event.target as HTMLElement;
          const trigger = target.closest<HTMLElement>("[data-lightbox-index]");

          if (!trigger) {
            return;
          }

          const index = Number(trigger.dataset.lightboxIndex);

          if (!Number.isInteger(index) || !photos[index]?.fallbackUrl) {
            return;
          }

          event.preventDefault();
          setActiveIndex(index);
        }}
      >
        {children}
      </div>
      <PhotoLightbox
        photos={photos}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
      />
    </>
  );
}

export function PhotoLightboxStage({
  photos,
  initialIndex,
  children,
}: {
  photos: LightboxPhoto[];
  initialIndex: number;
  children: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      <button
        className="photo-stage-open"
        type="button"
        onClick={() => setActiveIndex(initialIndex)}
        aria-label="全屏查看照片"
      >
        {children}
        <span className="photo-stage-open-label">全屏查看</span>
      </button>
      <PhotoLightbox
        photos={photos}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
      />
    </>
  );
}

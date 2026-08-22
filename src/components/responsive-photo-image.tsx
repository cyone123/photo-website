"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { decode } from "blurhash";
import type { GalleryPhoto } from "@/lib/gallery";

type ResponsivePhotoImageProps = {
  photo: GalleryPhoto;
  alt: string;
  sizes: string;
  preferredWidth?: number;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  objectPosition?: string;
};

const BASE83 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

function decode83(value: string) {
  let result = 0;

  for (const character of value) {
    result = result * 83 + BASE83.indexOf(character);
  }

  return result;
}

function blurhashAverageColor(hash: string) {
  if (hash.length < 6) {
    return "#0d0d0d";
  }

  const value = decode83(hash.slice(2, 6));
  const red = value >> 16;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgb(${red} ${green} ${blue})`;
}

function BlurhashCanvas({ hash, hidden }: { hash: string; hidden: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    try {
      const width = 32;
      const height = 32;
      const pixels = decode(hash, width, height, 1);
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
    } catch {
      // The average color remains as a safe fallback for legacy or invalid hashes.
    }
  }, [hash]);

  return (
    <canvas
      ref={canvasRef}
      className={`photo-blurhash${hidden ? " photo-blurhash-hidden" : ""}`}
      style={{ backgroundColor: blurhashAverageColor(hash) }}
      aria-hidden="true"
    />
  );
}

export function ResponsivePhotoImage({
  photo,
  alt,
  sizes,
  preferredWidth = 960,
  loading = "lazy",
  fetchPriority = "auto",
  objectPosition,
}: ResponsivePhotoImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const avifVariants = photo.variants
    .filter(
      (variant): variant is typeof variant & { url: string } =>
        variant.format === "avif" && Boolean(variant.url),
    )
    .sort((left, right) => left.width - right.width);
  const fallback =
    avifVariants.find((variant) => variant.width >= preferredWidth) ?? avifVariants.at(-1);

  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  if (!fallback) {
    return null;
  }

  const imageStyle = objectPosition ? ({ objectPosition } satisfies CSSProperties) : undefined;

  return (
    <>
      {photo.blurhash ? <BlurhashCanvas hash={photo.blurhash} hidden={loaded} /> : null}
      <picture className="responsive-photo-picture">
        <img
          ref={imageRef}
          className={
            photo.blurhash
              ? `progressive-photo${loaded ? " progressive-photo-loaded" : ""}`
              : undefined
          }
          src={fallback.url}
          srcSet={avifVariants.map((variant) => `${variant.url} ${variant.width}w`).join(", ")}
          sizes={sizes}
          width={photo.width}
          height={photo.height}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          style={imageStyle}
          onLoad={() => setLoaded(true)}
        />
      </picture>
    </>
  );
}

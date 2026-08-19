import type { CSSProperties } from "react";

const palettes = [
  ["#c8d3c4", "#8b9f8c", "#e9dfc8"],
  ["#d7c0ac", "#9a6d57", "#eee5d7"],
  ["#b7c9d4", "#637f8d", "#e3d5c8"],
  ["#d5c7d9", "#89718c", "#eee3d1"],
  ["#d6d0b7", "#928956", "#e6d7c0"],
];

export function PhotoPlaceholder({
  index = 0,
  compact = false,
}: {
  index?: number;
  compact?: boolean;
}) {
  const palette = palettes[Math.abs(index) % palettes.length];

  return (
    <div
      className={`photo-placeholder${compact ? " photo-placeholder-compact" : ""}`}
      style={
        {
          "--placeholder-one": palette[0],
          "--placeholder-two": palette[1],
          "--placeholder-three": palette[2],
        } as CSSProperties
      }
    >
      <span className="placeholder-glyph">◎</span>
      <span className="placeholder-caption">IMAGE / {String(index + 1).padStart(2, "0")}</span>
    </div>
  );
}

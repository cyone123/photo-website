import type { CSSProperties } from "react";

const palettes = [
  ["#16181d", "#0a0b0e", "#1c2027"],
  ["#1a1714", "#0c0a09", "#221d18"],
  ["#141a1c", "#090b0c", "#1a2225"],
  ["#181419", "#0b090c", "#201a24"],
  ["#171a14", "#0a0c09", "#1e231a"],
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

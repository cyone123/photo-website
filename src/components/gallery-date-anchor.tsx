import type { GalleryDate } from "@/lib/gallery";
import { PHOTO_TIME_ZONE, toPhotoDate } from "@/lib/photo-date";

export type GalleryMonth = {
  key: string;
  label: string;
};

export function getGalleryMonth(value: GalleryDate): GalleryMonth {
  if (!value) {
    return { key: "undated", label: "日期未记录" };
  }

  const date = toPhotoDate(value);

  if (!date) {
    return { key: "undated", label: "日期未记录" };
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    timeZone: PHOTO_TIME_ZONE,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return {
    key: `${year}-${month}`,
    label: `${year} / ${month}`,
  };
}

export function GalleryDateAnchor({ month }: { month: GalleryMonth }) {
  return (
    <div className="gallery-date-anchor" aria-label={month.label}>
      <span>{month.label}</span>
    </div>
  );
}

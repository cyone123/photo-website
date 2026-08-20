import type { GalleryDate } from "@/lib/gallery";

const PHOTO_TIME_ZONE = "Asia/Shanghai";

export type GalleryMonth = {
  key: string;
  label: string;
};

export function getGalleryMonth(value: GalleryDate): GalleryMonth {
  if (!value) {
    return { key: "undated", label: "日期未记录" };
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
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

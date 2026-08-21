import { formatPhotoDate, type GalleryPhoto } from "@/lib/gallery";

function display(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function exposureTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const seconds = Number(value);

  if (!Number.isFinite(seconds)) {
    return value;
  }

  return seconds < 1 ? `1/${Math.round(1 / seconds)}s` : `${seconds}s`;
}

function formatLocation(city: string | null, district: string | null) {
  const parts = [city, district].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function PhotoDetails({ photo }: { photo: GalleryPhoto }) {
  const camera = [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ");
  const specs = [
    { label: "日期", value: formatPhotoDate(photo.takenAt) },
    { label: "地点", value: formatLocation(photo.locationCity, photo.locationDistrict) },
    { label: "相机", value: display(camera) },
    { label: "镜头", value: display(photo.lensModel) },
    {
      label: "参数",
      value: `${display(photo.aperture ? `f/${photo.aperture}` : null)} · ${exposureTime(photo.exposureTimeSeconds)} · ISO ${display(photo.iso)}`,
    },
    { label: "焦距", value: photo.focalLengthMm ? `${photo.focalLengthMm}mm` : "—" },
    { label: "尺寸", value: `${photo.width} × ${photo.height}` },
  ];

  return (
    <dl className="spec-grid">
      {specs.map((spec) => (
        <div className="spec-cell" key={spec.label}>
          <dt>{spec.label}</dt>
          <dd>{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}

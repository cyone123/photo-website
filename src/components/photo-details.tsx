import { formatPhotoDate, type GalleryPhoto } from "@/lib/gallery";

function display(value: string | number | null | undefined, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
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

export function PhotoDetails({ photo }: { photo: GalleryPhoto }) {
  const camera = [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ");

  return (
    <aside className="photo-details">
      <div className="photo-detail-intro">
        <span className="eyebrow">PHOTO / DETAILS</span>
        <h1>{photo.title ?? "未命名照片"}</h1>
        <p>{photo.description ?? "一张被保存下来的片刻。"}</p>
      </div>

      <dl className="exif-list">
        <div>
          <dt>拍摄日期</dt>
          <dd>{formatPhotoDate(photo.takenAt)}</dd>
        </div>
        <div>
          <dt>相机</dt>
          <dd>{display(camera)}</dd>
        </div>
        <div>
          <dt>镜头</dt>
          <dd>{display(photo.lensModel)}</dd>
        </div>
        <div>
          <dt>参数</dt>
          <dd>
            {display(photo.aperture ? `f/${photo.aperture}` : null)} ·{" "}
            {exposureTime(photo.exposureTimeSeconds)} · ISO {display(photo.iso)}
          </dd>
        </div>
        <div>
          <dt>焦距</dt>
          <dd>{photo.focalLengthMm ? `${photo.focalLengthMm}mm` : "—"}</dd>
        </div>
        <div>
          <dt>尺寸</dt>
          <dd>
            {photo.width} × {photo.height}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

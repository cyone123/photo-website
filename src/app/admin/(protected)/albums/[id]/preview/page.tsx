import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminAlbumById } from "@/server/admin/admin-gallery";

export default async function AdminAlbumPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getAdminAlbumById(id);

  if (!album) {
    notFound();
  }

  const readyPhotos = album.photos.filter((photo) => photo.status === "READY");

  return (
    <div className="admin-preview-page">
      <header className="admin-preview-toolbar">
        <div>
          <span className={`admin-status admin-status-${album.status.toLowerCase()}`}>
            {album.status === "PUBLISHED" ? "已发布" : "草稿预览"}
          </span>
          <strong>{album.title}</strong>
        </div>
        <Link className="admin-button admin-button-secondary" href={`/admin/albums/${album.id}`}>
          返回编辑
        </Link>
      </header>

      <section className="admin-preview-content">
        <header>
          <span className="label">
            Album Preview / {String(readyPhotos.length).padStart(2, "0")}
          </span>
          <h1>{album.title}</h1>
          {album.description ? <p>{album.description}</p> : null}
        </header>
        {album.shootingContext ? (
          <aside>
            <span className="label">Shooting Context</span>
            <p>{album.shootingContext}</p>
          </aside>
        ) : null}
        <div className="admin-preview-grid">
          {readyPhotos.map((photo) => (
            <article key={photo.id}>
              <div
                style={
                  photo.previewUrl
                    ? ({
                        backgroundImage: `url("${photo.previewUrl}")`,
                        aspectRatio: `${photo.width} / ${photo.height}`,
                      } as CSSProperties)
                    : ({ aspectRatio: `${photo.width} / ${photo.height}` } as CSSProperties)
                }
              />
              {photo.title ? <h2>{photo.title}</h2> : null}
            </article>
          ))}
        </div>
        {readyPhotos.length === 0 ? <p className="admin-inline-empty">暂无 READY 照片。</p> : null}
      </section>
    </div>
  );
}

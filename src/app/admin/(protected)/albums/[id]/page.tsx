import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAlbumForm } from "@/components/admin/admin-album-form";
import { AdminPublicationControls } from "@/components/admin/admin-publication-controls";
import { albumHref } from "@/lib/routes";
import { getAdminAlbumById } from "@/server/admin/admin-gallery";

export default async function EditAdminAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await getAdminAlbumById(id);

  if (!album) {
    notFound();
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-breadcrumb" href="/admin/albums">
            ← 相册管理
          </Link>
          <span className="label">Album Editor</span>
          <div className="admin-title-line">
            <h1>{album.title}</h1>
            <span className={`admin-status admin-status-${album.status.toLowerCase()}`}>
              {album.status === "PUBLISHED" ? "已发布" : "草稿"}
            </span>
          </div>
          <p>/{album.slug}</p>
        </div>
        <div className="admin-head-actions">
          <Link
            className="admin-button admin-button-secondary"
            href={`/admin/albums/${id}/preview`}
          >
            预览
          </Link>
          {album.status === "PUBLISHED" ? (
            <Link className="admin-button admin-button-secondary" href={albumHref(album.slug)}>
              公开页面 ↗
            </Link>
          ) : null}
        </div>
      </header>

      <div className="admin-editor-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="label">Metadata</span>
              <h2>相册信息</h2>
            </div>
          </div>
          <AdminAlbumForm
            values={{
              id: album.id,
              title: album.title,
              slug: album.slug,
              description: album.description ?? "",
              shootingContext: album.shootingContext ?? "",
              status: album.status,
            }}
          />
        </section>

        <aside className="admin-editor-sidebar">
          <section className="admin-panel">
            <span className="label">Publication</span>
            <h2>{album.status === "PUBLISHED" ? "公开可见" : "尚未发布"}</h2>
            <p>
              {album.status === "PUBLISHED"
                ? "取消发布后，公开相册链接将立即不可见。"
                : "发布前必须至少有一张 READY 照片；无封面时自动使用第一张。"}
            </p>
            <AdminPublicationControls id={album.id} status={album.status} />
          </section>

          <section className="admin-panel admin-album-health">
            <span className="label">Photo Status</span>
            <dl>
              <div>
                <dt>READY</dt>
                <dd>{album.ready}</dd>
              </div>
              <div>
                <dt>PROCESSING</dt>
                <dd>{album.processing}</dd>
              </div>
              <div>
                <dt>FAILED</dt>
                <dd>{album.failed}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="admin-panel admin-photo-section">
        <div className="admin-panel-head">
          <div>
            <span className="label">Photos / {String(album.photos.length).padStart(2, "0")}</span>
            <h2>相册照片</h2>
          </div>
          <Link
            className="admin-button admin-button-secondary"
            href={`/admin/uploads?albumId=${album.id}`}
          >
            上传照片
          </Link>
        </div>
        {album.photos.length > 0 ? (
          <div className="admin-photo-grid">
            {album.photos.map((photo, index) => (
              <article className="admin-photo-tile" key={photo.id}>
                <div
                  className="admin-photo-preview"
                  style={
                    photo.previewUrl
                      ? ({
                          backgroundImage: `url("${photo.previewUrl}")`,
                          aspectRatio: `${photo.width} / ${photo.height}`,
                        } as CSSProperties)
                      : ({ aspectRatio: `${photo.width} / ${photo.height}` } as CSSProperties)
                  }
                >
                  {!photo.previewUrl ? <span>NO PREVIEW</span> : null}
                  <i>{String(index + 1).padStart(2, "0")}</i>
                </div>
                <div>
                  <strong>{photo.title ?? "未命名照片"}</strong>
                  <span
                    className={`admin-photo-status admin-photo-status-${photo.status.toLowerCase()}`}
                  >
                    {photo.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-inline-empty">
            <p>这个相册还没有照片。</p>
            <span>可以从后台直传原图，也可以继续使用 `pnpm photo import`。</span>
          </div>
        )}
      </section>
    </div>
  );
}

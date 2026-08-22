import type { CSSProperties } from "react";
import Link from "next/link";
import { getAdminAlbums } from "@/server/admin/admin-gallery";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AdminAlbumsPage() {
  const albumList = await getAdminAlbums();

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <span className="label">Albums / {String(albumList.length).padStart(2, "0")}</span>
          <h1>相册管理</h1>
          <p>草稿不会出现在公开网站，发布操作会立即刷新画廊缓存。</p>
        </div>
        <Link className="admin-button admin-button-primary" href="/admin/albums/new">
          新建相册
        </Link>
      </header>

      {albumList.length > 0 ? (
        <div className="admin-album-list">
          {albumList.map((album) => (
            <article className="admin-album-row" key={album.id}>
              <div
                className="admin-album-cover"
                role="img"
                aria-label={`${album.title}封面`}
                style={
                  album.coverUrl
                    ? ({ backgroundImage: `url("${album.coverUrl}")` } as CSSProperties)
                    : undefined
                }
              >
                {!album.coverUrl ? <span>NO COVER</span> : null}
              </div>
              <div className="admin-album-row-copy">
                <div>
                  <span className={`admin-status admin-status-${album.status.toLowerCase()}`}>
                    {album.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </span>
                  <span className="admin-album-slug">/{album.slug}</span>
                </div>
                <h2>{album.title}</h2>
                <p>{album.description ?? "暂无简介"}</p>
                <div className="admin-count-line">
                  <span>{album.ready} READY</span>
                  <span>{album.processing} PROCESSING</span>
                  <span>{album.failed} FAILED</span>
                  <span>更新于 {formatDate(album.updatedAt)}</span>
                </div>
              </div>
              <div className="admin-album-row-actions">
                <Link href={`/admin/albums/${album.id}`}>编辑</Link>
                <Link href={`/admin/albums/${album.id}/preview`}>预览</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="admin-empty-state">
          <span className="label">Empty</span>
          <h2>还没有相册</h2>
          <p>先建立一个草稿相册，再通过 CLI 或后续上传功能添加照片。</p>
          <Link className="admin-button admin-button-primary" href="/admin/albums/new">
            创建第一个相册
          </Link>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { getAdminDashboardStats } from "@/server/admin/admin-gallery";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <span className="label">Overview</span>
          <h1>仪表盘</h1>
          <p>相册发布状态与照片处理状态概览。</p>
        </div>
        <Link className="admin-button admin-button-primary" href="/admin/albums/new">
          新建相册
        </Link>
      </header>

      <section className="admin-stat-grid" aria-label="内容统计">
        <article className="admin-stat-card">
          <span>相册总数</span>
          <strong>{stats.albums.total}</strong>
          <small>
            {stats.albums.published} 已发布 / {stats.albums.draft} 草稿
          </small>
        </article>
        <article className="admin-stat-card">
          <span>可用照片</span>
          <strong>{stats.photos.ready}</strong>
          <small>READY</small>
        </article>
        <article className="admin-stat-card">
          <span>处理中</span>
          <strong>{stats.photos.processing}</strong>
          <small>PROCESSING</small>
        </article>
        <article className="admin-stat-card admin-stat-card-alert">
          <span>处理失败</span>
          <strong>{stats.photos.failed}</strong>
          <small>FAILED</small>
        </article>
      </section>

      <section className="admin-panel admin-dashboard-links">
        <div>
          <span className="label">Content</span>
          <h2>管理内容</h2>
        </div>
        <Link href="/admin/albums">
          <strong>相册管理</strong>
          <span>创建草稿、编辑信息、发布或取消发布 →</span>
        </Link>
        <Link href="/admin/uploads">
          <strong>上传任务</strong>
          <span>照片直传将在阶段 4 接入 →</span>
        </Link>
      </section>
    </div>
  );
}

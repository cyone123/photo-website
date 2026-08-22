import Link from "next/link";

export default function AdminUploadsPage() {
  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <span className="label">Uploads</span>
          <h1>上传任务</h1>
          <p>这里将显示浏览器直传 R2 后的上传与处理状态。</p>
        </div>
      </header>
      <section className="admin-empty-state">
        <span className="label">Stage 04</span>
        <h2>浏览器直传尚未接入</h2>
        <p>阶段 1 的共用处理管线已经就绪；下一阶段将增加上传任务表和 R2 Presigned URL。</p>
        <Link className="admin-button admin-button-secondary" href="/admin/albums">
          返回相册管理
        </Link>
      </section>
    </div>
  );
}

import Link from "next/link";
import { AdminAlbumForm } from "@/components/admin/admin-album-form";

export default function NewAdminAlbumPage() {
  return (
    <div className="admin-page admin-page-narrow">
      <header className="admin-page-head">
        <div>
          <Link className="admin-breadcrumb" href="/admin/albums">
            ← 相册管理
          </Link>
          <span className="label">New Album</span>
          <h1>新建相册</h1>
          <p>新相册默认保存为草稿，不会立即出现在公开网站。</p>
        </div>
      </header>
      <section className="admin-panel">
        <AdminAlbumForm />
      </section>
    </div>
  );
}

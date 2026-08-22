import { AdminUploadManager } from "@/components/admin/admin-upload-manager";
import { getAdminAlbums } from "@/server/admin/admin-gallery";
import { getAdminUploadTasks } from "@/server/admin/upload-service";

export default async function AdminUploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ albumId?: string }>;
}) {
  const [{ albumId }, albums, tasks] = await Promise.all([
    searchParams,
    getAdminAlbums(),
    getAdminUploadTasks({ limit: 100 }),
  ]);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <span className="label">Upload Pipeline</span>
          <h1>上传任务</h1>
          <p>原图直传私有 R2；服务端随后解析 EXIF、去重并生成 AVIF 公开变体。</p>
        </div>
      </header>
      {albums.length > 0 ? (
        <AdminUploadManager
          albums={albums.map((album) => ({ id: album.id, title: album.title }))}
          initialTasks={tasks}
          initialAlbumId={albumId}
        />
      ) : (
        <section className="admin-empty-state">
          <span className="label">Album Required</span>
          <h2>请先创建相册</h2>
          <p>每个上传任务都必须关联一个目标相册。</p>
        </section>
      )}
    </div>
  );
}

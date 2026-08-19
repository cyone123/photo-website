import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "关于",
  description: "关于这个个人照片档案项目。",
};

export default function AboutPage() {
  return (
    <main className="page-frame page-frame-main">
      <header className="page-head">
        <span className="label">About</span>
        <h1>关于</h1>
      </header>

      <div className="about-copy">
        <p>
          光的档案是一个个人照片档案：照片从本地导入，按相册整理，只保留回看时仍愿意停留的画面。
        </p>
        <p>原图与展示版本分开保存；拍摄时间、机身、镜头等参数随照片一并记录。</p>
        <Link className="text-link" href="/albums">
          查看相册 <span className="text-link-arrow">→</span>
        </Link>
      </div>
    </main>
  );
}

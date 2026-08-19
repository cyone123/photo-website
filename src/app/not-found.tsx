import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-frame not-found-page">
      <span className="label">Archive / 404</span>
      <h1>没有找到这一页。</h1>
      <p>它可能还没有发布，或者这个地址已经被重新整理。</p>
      <Link className="text-link" href="/albums">
        返回相册 <span className="text-link-arrow">→</span>
      </Link>
    </main>
  );
}

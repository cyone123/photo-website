import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page-frame not-found-page">
        <span className="eyebrow">ARCHIVE / 404</span>
        <h1>这张照片暂时没有找到。</h1>
        <p>它可能还没有发布，或者这个地址已经被重新整理。</p>
        <Link className="text-link" href="/albums">
          返回相册 <span>↗</span>
        </Link>
      </main>
    </>
  );
}

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-frame site-footer-row">
        <span className="site-footer-brand">光的档案 / Photo Archive</span>
        <nav className="site-footer-nav" aria-label="页脚导航">
          <Link href="/">首页</Link>
          <Link href="/albums">相册</Link>
          <Link href="/about">关于</Link>
        </nav>
      </div>
    </footer>
  );
}

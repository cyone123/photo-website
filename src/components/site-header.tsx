import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="返回首页">
        <span className="site-brand-mark">◎</span>
        <span>
          <strong>光的档案</strong>
          <small>PERSONAL PHOTO ARCHIVE</small>
        </span>
      </Link>

      <nav className="site-nav" aria-label="主导航">
        <Link href="/">首页</Link>
        <Link href="/albums">相册</Link>
        <Link href="/about">关于</Link>
      </nav>

      <span className="site-header-note">记录发生过的事</span>
    </header>
  );
}

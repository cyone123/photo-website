import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-frame site-header-row">
        <Link className="site-brand" href="/" aria-label="返回首页">
          <span className="brand-stripe" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="site-brand-text">
            <strong>光的档案</strong>
            <small>Photo Archive</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          <Link href="/">首页</Link>
          <Link href="/albums">相册</Link>
          <Link href="/about">关于</Link>
        </nav>
      </div>
    </header>
  );
}

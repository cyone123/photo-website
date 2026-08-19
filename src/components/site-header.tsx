"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigationItems = [
  { href: "/", label: "首页" },
  { href: "/albums", label: "相册" },
  { href: "/about", label: "关于" },
];

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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

        <button
          className="site-nav-toggle"
          type="button"
          aria-label={menuOpen ? "关闭主导航" : "打开主导航"}
          aria-controls="site-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav className="site-nav" id="site-navigation" aria-label="主导航" data-open={menuOpen}>
          {navigationItems.map((item) => {
            const current = isCurrentPath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

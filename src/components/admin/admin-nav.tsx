"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "仪表盘", exact: true },
  { href: "/admin/albums", label: "相册管理" },
  { href: "/admin/uploads", label: "上传任务" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="后台导航">
      {links.map((link) => {
        const current = link.exact ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

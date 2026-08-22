import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdmin } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/server/auth/session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span className="brand-stripe" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>光的档案</strong>
            <small>Archive Console</small>
          </span>
        </Link>

        <AdminNav />

        <div className="admin-sidebar-footer">
          <span>{session.user.email}</span>
          <Link href="/">返回公开网站 ↗</Link>
          <form action={logoutAdmin}>
            <button type="submit">退出登录</button>
          </form>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}

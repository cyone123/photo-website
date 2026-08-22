import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "管理员登录",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  const { next } = await searchParams;

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel">
        <Link className="admin-login-brand" href="/">
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
        <header>
          <span className="label">Protected Area</span>
          <h1>管理后台</h1>
          <p>使用初始化的管理员账号登录。</p>
        </header>
        <AdminLoginForm nextPath={next} />
        <Link className="admin-back-link" href="/">
          ← 返回公开网站
        </Link>
      </section>
    </main>
  );
}

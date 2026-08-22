import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type AdminSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

function hasAdminRole(role: string | null | undefined) {
  return role
    ?.split(",")
    .map((value) => value.trim())
    .includes("admin");
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });

  return session && hasAdminRole(session.user.role) ? session : null;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

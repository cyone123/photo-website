import { eq } from "drizzle-orm";
import { loadProjectEnv } from "@/config/load-env";
import { readHiddenLine } from "./read-hidden-line";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("用法：pnpm admin:reset-password [--email 管理员邮箱]");
    console.log("邮箱默认读取 ADMIN_EMAIL；新密码通过终端隐藏输入（12–128 位）。");
    return;
  }

  if (args.length > 0 && (args.length !== 2 || args[0] !== "--email" || !args[1])) {
    throw new Error("用法：pnpm admin:reset-password [--email 管理员邮箱]");
  }

  loadProjectEnv();
  const { readAdminInitEnv } = await import("@/config/env");
  const env = readAdminInitEnv();
  const email = (args[1] ?? env.ADMIN_EMAIL)?.trim().toLowerCase();

  if (!email) {
    throw new Error("请通过 --email 指定管理员邮箱，或配置 ADMIN_EMAIL。");
  }

  const [{ getDb }, { account, session, user }, { auth }] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("@/server/auth/auth"),
  ]);
  const db = getDb();
  const admin = await db.query.user.findFirst({ where: eq(user.email, email) });

  if (!admin || !admin.role?.split(",").includes("admin")) {
    throw new Error("未找到该邮箱对应的管理员账号。");
  }

  const context = await auth.$context;
  const credential = await context.internalAdapter.findCredentialAccount(admin.id);

  if (!credential) {
    throw new Error("该管理员没有邮箱密码登录记录，无法重置。");
  }

  console.log(`即将重置管理员 ${admin.email} 的密码，并注销该账号的现有会话。`);
  const password = await readHiddenLine("新密码（12–128 位）：");
  const confirmation = await readHiddenLine("再次输入新密码：");
  const { minPasswordLength, maxPasswordLength } = context.password.config;

  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new Error(`密码长度必须为 ${minPasswordLength}–${maxPasswordLength} 位。`);
  }

  if (password !== confirmation) {
    throw new Error("两次输入的密码不一致。");
  }

  const hashedPassword = await context.password.hash(password);

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(account.id, credential.id))
      .returning({ id: account.id });

    if (updated.length !== 1) {
      throw new Error("登录记录已变化，密码重置未完成，请重试。");
    }

    await tx.delete(session).where(eq(session.userId, admin.id));
  });

  console.log(`密码已重置：${admin.email}。请使用新密码登录 /admin/login。`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

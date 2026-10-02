import { count, eq } from "drizzle-orm";
import { loadProjectEnv } from "@/config/load-env";
import { readHiddenLine } from "./read-hidden-line";

function optionValue(args: string[], name: string) {
  const index = args.indexOf(name);

  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

async function main() {
  loadProjectEnv();

  const [{ readAdminInitEnv }, { getDb }, { user }, { auth }] = await Promise.all([
    import("@/config/env"),
    import("@/db/client"),
    import("@/db/schema"),
    import("@/server/auth/auth"),
  ]);
  const env = readAdminInitEnv();
  const args = process.argv.slice(2);
  const email = (optionValue(args, "--email") ?? env.ADMIN_EMAIL)?.trim().toLowerCase();
  const name = optionValue(args, "--name")?.trim() || "Admin";

  if (!email) {
    throw new Error("Provide --email or configure ADMIN_EMAIL.");
  }

  const [existingCount] = await getDb().select({ value: count() }).from(user);

  if (Number(existingCount?.value ?? 0) > 0) {
    throw new Error("An authentication user already exists; administrator initialization stopped.");
  }

  const password = await readHiddenLine("管理员密码（至少 12 位）：");
  const confirmation = await readHiddenLine("再次输入密码：");

  if (password.length < 12) {
    throw new Error("Administrator password must contain at least 12 characters.");
  }

  if (password !== confirmation) {
    throw new Error("The two passwords do not match.");
  }

  await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role: "admin",
    },
  });

  const created = await getDb().query.user.findFirst({ where: eq(user.email, email) });

  if (!created || !created.role?.split(",").includes("admin")) {
    throw new Error("Administrator creation did not complete successfully.");
  }

  console.log(`Administrator created: ${created.email}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

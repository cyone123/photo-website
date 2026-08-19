import path from "node:path";
import { config } from "dotenv";

let loaded = false;

export function loadProjectEnv() {
  if (loaded) {
    return;
  }

  const projectRoot = process.cwd();

  // Match Next.js precedence: .env.local wins over .env.
  config({ path: path.join(projectRoot, ".env.local") });
  config({ path: path.join(projectRoot, ".env") });
  loaded = true;
}

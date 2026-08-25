import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
  }

  // The editor performs multi-row updates that must be atomic. The HTTP
  // driver cannot open interactive transactions, while the serverless pool
  // supports Drizzle's transaction API and still works with Neon deployments.
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    allowExitOnIdle: true,
  });

  return drizzle(pool, { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

export function getDb() {
  database ??= createDatabase();
  return database;
}

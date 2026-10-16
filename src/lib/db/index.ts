// Database client. DATABASE_URL → node-postgres (Supabase or any Postgres).
// No DATABASE_URL → embedded PGlite (real Postgres compiled to WASM) persisted in ./.data/pglite,
// so `npm run dev` works with zero setup. Migrations run once per process on first use, and an
// empty embedded database is seeded with the demo workspace.

import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

const MIGRATIONS = path.join(process.cwd(), "drizzle");
export const EMBEDDED_DIR = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");

export function isEmbedded() {
  return !process.env.DATABASE_URL;
}

async function connect(): Promise<{ db: DB; close: () => Promise<void> }> {
  if (!isEmbedded()) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX) || 10 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return { db, close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(EMBEDDED_DIR), { recursive: true });
  const client = new PGlite(EMBEDDED_DIR);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  // Same query-builder API; the driver-specific result types are not used by the app.
  return { db: db as unknown as DB, close: () => client.close() };
}

const g = globalThis as unknown as { __phoonicaDb?: Promise<{ db: DB; close: () => Promise<void> }> };

async function init() {
  const conn = await connect();
  if (isEmbedded() && process.env.PHOONICA_NO_AUTOSEED !== "1") {
    const { seedIfEmpty } = await import("./seed");
    await seedIfEmpty(conn.db);
  }
  return conn;
}

export async function getDb(): Promise<DB> {
  // Cached on globalThis so Next.js dev HMR doesn't open a second PGlite instance on the same directory.
  g.__phoonicaDb ??= init().catch((e) => {
    g.__phoonicaDb = undefined;
    throw e;
  });
  return (await g.__phoonicaDb).db;
}

export async function closeDb() {
  if (g.__phoonicaDb) {
    const c = await g.__phoonicaDb;
    g.__phoonicaDb = undefined;
    await c.close();
  }
}

export { schema };

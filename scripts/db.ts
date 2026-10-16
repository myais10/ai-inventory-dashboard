// Database CLI: `npm run db -- <migrate|seed|reset|stats>`.
// Embedded PGlite is single-process — stop `npm run dev` before running this against .data/pglite.
import { rm } from "node:fs/promises";
import { count } from "drizzle-orm";
import { closeDb, EMBEDDED_DIR, getDb, isEmbedded, schema } from "../src/lib/db";
import { seedDemo, seedIfEmpty } from "../src/lib/db/seed";

process.env.PHOONICA_NO_AUTOSEED = "1";

async function stats() {
  const db = await getDb();
  for (const [name, t] of Object.entries({ leads: schema.leads, calls: schema.calls, activities: schema.activities, tasks: schema.tasks, deals: schema.deals, meetings: schema.meetings })) {
    const [{ n }] = await db.select({ n: count() }).from(t);
    console.log(`${name.padEnd(11)} ${n}`);
  }
}

async function main() {
  const cmd = process.argv[2] ?? "stats";
  if (cmd === "reset") {
    if (!isEmbedded()) throw new Error("reset only wipes the embedded dev database; drop your Postgres schema manually");
    await rm(EMBEDDED_DIR, { recursive: true, force: true });
    const t = Date.now();
    await seedDemo(await getDb());
    console.log(`Seeded demo workspace in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    await stats();
  } else if (cmd === "seed") {
    console.log((await seedIfEmpty(await getDb())) ? "Seeded demo workspace" : "Database already has data; use `reset`");
  } else if (cmd === "migrate") {
    await getDb();
    console.log("Migrations applied");
  } else await stats();
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});

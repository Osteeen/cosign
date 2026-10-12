// Applies drizzle/ migrations at deploy time. Unlike drizzle-kit, it prints the
// real error (never the connection string) and waits for a database that is
// still starting, which a freshly created hosted database often is.
//   DATABASE_URL=... node scripts/db/migrate.mjs
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const ATTEMPTS = 10;
for (let attempt = 1; ; attempt++) {
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query("select 1");
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    console.log("migrations applied");
    await pool.end();
    break;
  } catch (e) {
    await pool.end().catch(() => {});
    const detail = [e?.code, e?.message].filter(Boolean).join(" ").replaceAll(url, "<DATABASE_URL>");
    const transient = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "57P03"].includes(e?.code) || /timeout|starting up|not yet accepting/i.test(String(e?.message));
    if (!transient || attempt === ATTEMPTS) {
      console.error(`migration failed: ${detail}`);
      process.exit(1);
    }
    console.log(`database not ready (${e?.code ?? "error"}), retrying ${attempt}/${ATTEMPTS - 1}...`);
    await new Promise((r) => setTimeout(r, 6000));
  }
}

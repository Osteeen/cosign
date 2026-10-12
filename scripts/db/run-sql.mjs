// Runs a .sql file against DATABASE_URL with the pg driver (no psql needed,
// e.g. in a Railway deploy). Never prints the URL.
//   node scripts/db/run-sql.mjs scripts/db/seed-stores.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file || !process.env.DATABASE_URL) {
  console.error("usage: DATABASE_URL=... node scripts/db/run-sql.mjs <file.sql>");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(file, "utf8"));
  console.log(`ran ${file}`);
} finally {
  await client.end();
}

// Runs a command against the separate test database (cosign_test), never the
// dev one: DATABASE_URL from .env.local with its database name swapped. Refuses
// to run if the result is not a *_test database. Never prints the URL.
//   node --env-file=.env.local scripts/test/with-test-db.mjs <command> [args...]

import { spawnSync } from "node:child_process";

const base = process.env.DATABASE_URL;
if (!base) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const url = new URL(base);
url.pathname = "/cosign_test";
if (!/^\/[a-z0-9_]+_test$/.test(url.pathname)) {
  console.error("Refusing to run: not a *_test database");
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const run = (c, a) => spawnSync(c, a, { stdio: "inherit", env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test" } });

// Keep the test database's schema current, quietly.
const migrate = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "migrate"], {
  env: { ...process.env, DATABASE_URL: url.toString() },
  encoding: "utf8",
});
if (migrate.status !== 0) {
  console.error("Migrating the test database failed:\n" + (migrate.stderr || migrate.stdout).replaceAll(base, "<DATABASE_URL>"));
  process.exit(1);
}
process.exit(run(cmd, args).status ?? 1);

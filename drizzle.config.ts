import { defineConfig } from "drizzle-kit";

// Run with the env loaded, e.g. `node --env-file=.env.local node_modules/.bin/drizzle-kit migrate`,
// or via the db:* scripts. Never hard-code credentials here.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// One pool per server process; reused across requests and hot reloads.
const globalForDb = globalThis as unknown as { cosignPool?: Pool };
const pool = globalForDb.cosignPool ?? new Pool({ connectionString: url, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.cosignPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "file:./local.db";

const sqlitePath = databaseUrl.replace("file:", "");
const sqlite = new Database(sqlitePath);

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

// Re-export schema for convenience
export { schema };

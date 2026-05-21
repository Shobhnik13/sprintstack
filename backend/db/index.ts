import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.ts";

const client = postgres(
  process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5432/sprintstack_pm",
  { max: 20, idle_timeout: 30, connect_timeout: 10 },
);

export const db = drizzle(client, { schema });
export type DB = typeof db;

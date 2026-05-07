import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index.ts";

await migrate(db, { migrationsFolder: "./db/migrations" });
console.log("[migrate] done");
process.exit(0);

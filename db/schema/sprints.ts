import { pgTable, uuid, varchar, text, integer, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { projects } from "./projects.ts";

export const sprintStatusEnum = pgEnum("sprint_status", ["planning", "active", "completed"]);

export const sprints = pgTable("sprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  goal: text("goal"),
  status: sprintStatusEnum("status").notNull().default("planning"),
  start_date: date("start_date"),
  end_date: date("end_date"),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  velocity_points: integer("velocity_points"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Sprint = typeof sprints.$inferSelect;

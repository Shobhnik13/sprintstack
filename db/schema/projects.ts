import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { workspaces } from "./workspaces.ts";

export const statusCategoryEnum = pgEnum("status_category", ["todo", "in_progress", "done"]);

export const transitionActionTypeEnum = pgEnum("transition_action_type", [
  "assign_user",
  "set_field",
  "send_notification",
]);

export const transitionConditionTypeEnum = pgEnum("transition_condition_type", [
  "field_required",
  "field_value",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 10 }).notNull(), // e.g. "PROJ" — used in PROJ-123
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspace_id, t.key)],
);

export const workflowStatuses = pgTable("workflow_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6B7280"),
  position: integer("position").notNull(),
  category: statusCategoryEnum("category").notNull(),
});

export const workflowTransitions = pgTable("workflow_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // null from_status_id means the transition is allowed from any status
  from_status_id: uuid("from_status_id").references(() => workflowStatuses.id, {
    onDelete: "cascade",
  }),
  to_status_id: uuid("to_status_id")
    .notNull()
    .references(() => workflowStatuses.id, { onDelete: "cascade" }),
});

export const workflowTransitionActions = pgTable("workflow_transition_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  transition_id: uuid("transition_id")
    .notNull()
    .references(() => workflowTransitions.id, { onDelete: "cascade" }),
  action_type: transitionActionTypeEnum("action_type").notNull(),
  action_config: jsonb("action_config").notNull().default({}),
});

export const workflowTransitionConditions = pgTable("workflow_transition_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  transition_id: uuid("transition_id")
    .notNull()
    .references(() => workflowTransitions.id, { onDelete: "cascade" }),
  condition_type: transitionConditionTypeEnum("condition_type").notNull(),
  condition_config: jsonb("condition_config").notNull().default({}),
});

export type Project = typeof projects.$inferSelect;
export type WorkflowStatus = typeof workflowStatuses.$inferSelect;
export type WorkflowTransition = typeof workflowTransitions.$inferSelect;

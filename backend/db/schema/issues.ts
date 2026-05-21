import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  date,
  pgEnum,
  primaryKey,
  index,
  jsonb,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { projects } from "./projects.ts";
import { workflowStatuses } from "./projects.ts";
import { sprints } from "./sprints.ts";

export const issueTypeEnum = pgEnum("issue_type", ["epic", "story", "task", "bug", "subtask"]);
export const issuePriorityEnum = pgEnum("issue_priority", [
  "lowest",
  "low",
  "medium",
  "high",
  "critical",
]);
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "dropdown",
  "date",
]);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    issue_number: integer("issue_number").notNull(),
    type: issueTypeEnum("type").notNull().default("task"),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status_id: uuid("status_id")
      .notNull()
      .references(() => workflowStatuses.id),
    priority: issuePriorityEnum("priority").notNull().default("medium"),
    assignee_id: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    reporter_id: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    // Lazy self-reference to avoid circular import issues
    parent_id: uuid("parent_id").references((): AnyPgColumn => issues.id, { onDelete: "set null" }),
    sprint_id: uuid("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
    story_points: integer("story_points"),
    labels: text("labels").array(),
    version: integer("version").notNull().default(1),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("issues_project_status_idx").on(t.project_id, t.status_id),
    index("issues_project_sprint_idx").on(t.project_id, t.sprint_id),
    index("issues_assignee_idx").on(t.assignee_id),
    index("issues_parent_idx").on(t.parent_id),
  ],
);

export const issueWatchers = pgTable(
  "issue_watchers",
  {
    issue_id: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issue_id, t.user_id] })],
);

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  field_type: customFieldTypeEnum("field_type").notNull(),
  options: jsonb("options").$type<string[]>(),
  is_required: boolean("is_required").notNull().default(false),
});

export const issueCustomFieldValues = pgTable("issue_custom_field_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  issue_id: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  field_def_id: uuid("field_def_id")
    .notNull()
    .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
  value_text: text("value_text"),
  value_number: integer("value_number"),
  value_date: date("value_date"),
  value_option: text("value_option"),
});

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
export type IssueWatcher = typeof issueWatchers.$inferSelect;
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;

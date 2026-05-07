import { pgTable, uuid, text, timestamp, pgEnum, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { issues } from "./issues.ts";
import { projects } from "./projects.ts";

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  "issue_created",
  "issue_updated",
  "issue_moved",
  "comment_added",
  "sprint_started",
  "sprint_completed",
  "watcher_added",
  "transition_applied",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "assigned",
  "mentioned",
  "status_changed",
  "comment_added",
  "watcher_update",
]);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issue_id: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    author_id: uuid("author_id")
      .notNull()
      .references(() => users.id),
    parent_comment_id: uuid("parent_comment_id").references((): AnyPgColumn => comments.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    mentions: uuid("mentions").array().notNull().default([]),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("comments_issue_idx").on(t.issue_id, t.created_at)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    project_id: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    issue_id: uuid("issue_id").references(() => issues.id, { onDelete: "cascade" }),
    actor_id: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    event_type: activityEventTypeEnum("event_type").notNull(),
    old_value: text("old_value"), 
    new_value: text("new_value"), 
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_project_idx").on(t.project_id, t.created_at),
    index("activity_issue_idx").on(t.issue_id, t.created_at),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipient_id: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actor_id: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    issue_id: uuid("issue_id").references(() => issues.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    read_at: timestamp("read_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_recipient_idx").on(t.recipient_id, t.read_at, t.created_at)],
);

export type Comment = typeof comments.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

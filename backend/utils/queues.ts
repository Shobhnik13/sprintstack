import { Queue } from "bullmq";
import { redis } from "./redis.ts";

const connection = {
  host: redis.options.host ?? "localhost",
  port: redis.options.port ?? 6379,
};

export const notificationQueue = new Queue("notifications", { connection });
export const activityQueue = new Queue("activity-log", { connection });

export type NotificationJobData = {
  recipientId: string;
  actorId: string;
  issueId: string | null;
  projectId: string;
  type: "assigned" | "mentioned" | "status_changed" | "comment_added" | "watcher_update";
};

export type ActivityJobData = {
  projectId: string;
  issueId: string | null;
  actorId: string;
  eventType:
    | "issue_created"
    | "issue_updated"
    | "issue_moved"
    | "comment_added"
    | "sprint_started"
    | "sprint_completed"
    | "watcher_added"
    | "transition_applied";
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
};

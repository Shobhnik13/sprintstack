import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { activityLog, activityEventTypeEnum } from "../db/schema/comments.ts";
import { users } from "../db/schema/users.ts";
import { getActorRoleByProject } from "./workspace.service.ts";
import { encodeCursor, decodeCursor } from "../utils/pagination.ts";
import { AppError } from "../types/index.ts";

type EventType = (typeof activityEventTypeEnum.enumValues)[number];

export interface ActivityFilters {
  event_type?: EventType;
  actor_id?: string;
  issue_id?: string;
  cursor?: string;
  limit?: number;
}

export async function getProjectActivity(projectId: string, actorId: string, filters: ActivityFilters) {
  await getActorRoleByProject(projectId, actorId);

  const pageSize = Math.min(filters.limit ?? 20, 100);
  const decoded = filters.cursor ? decodeCursor(filters.cursor) : null;

  const conditions = [eq(activityLog.project_id, projectId)];

  if (filters.event_type) conditions.push(eq(activityLog.event_type, filters.event_type));
  if (filters.actor_id) conditions.push(eq(activityLog.actor_id, filters.actor_id));
  if (filters.issue_id) conditions.push(eq(activityLog.issue_id, filters.issue_id));
  if (decoded) {
    conditions.push(
      sql`(${activityLog.created_at}, ${activityLog.id}) < (${decoded.created_at}::timestamptz, ${decoded.id}::uuid)`,
    );
  }

  const rows = await db
    .select({
      id: activityLog.id,
      issue_id: activityLog.issue_id,
      event_type: activityLog.event_type,
      old_value: activityLog.old_value,
      new_value: activityLog.new_value,
      created_at: activityLog.created_at,
      actor_id: users.id,
      actor_email: users.email,
      actor_display_name: users.display_name,
      actor_avatar_url: users.avatar_url,
    })
    .from(activityLog)
    .innerJoin(users, eq(activityLog.actor_id, users.id))
    .where(and(...conditions))
    .orderBy(sql`${activityLog.created_at} DESC, ${activityLog.id} DESC`)
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = data.at(-1);

  return {
    activity: data,
    next_cursor:
      hasMore && lastRow
        ? encodeCursor({ created_at: lastRow.created_at.toISOString(), id: lastRow.id })
        : null,
  };
}

export async function writeActivity(input: {
  projectId: string;
  issueId?: string | null;
  actorId: string;
  eventType: EventType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}) {
  const [entry] = await db
    .insert(activityLog)
    .values({
      project_id: input.projectId,
      issue_id: input.issueId ?? null,
      actor_id: input.actorId,
      event_type: input.eventType,
      old_value: input.oldValue ? JSON.stringify(input.oldValue) : null,
      new_value: input.newValue ? JSON.stringify(input.newValue) : null,
    })
    .returning();

  return entry!;
}

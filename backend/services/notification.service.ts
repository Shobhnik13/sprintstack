import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { notifications } from "../db/schema/comments.ts";
import { users } from "../db/schema/users.ts";
import { issues } from "../db/schema/issues.ts";
import { encodeCursor, decodeCursor } from "../utils/pagination.ts";
import { AppError } from "../types/index.ts";

export async function listNotifications(userId: string, cursor?: string, limit = 20) {
  const pageSize = Math.min(limit, 100);
  const decoded = cursor ? decodeCursor(cursor) : null;

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      read_at: notifications.read_at,
      created_at: notifications.created_at,
      issue_id: notifications.issue_id,
      actor_id: users.id,
      actor_display_name: users.display_name,
      actor_avatar_url: users.avatar_url,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.actor_id, users.id))
    .where(
      and(
        eq(notifications.recipient_id, userId),
        decoded
          ? sql`(${notifications.created_at}, ${notifications.id}) < (${decoded.created_at}::timestamptz, ${decoded.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(sql`${notifications.created_at} DESC, ${notifications.id} DESC`)
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = data.at(-1);

  return {
    notifications: data,
    next_cursor:
      hasMore && lastRow
        ? encodeCursor({ created_at: lastRow.created_at.toISOString(), id: lastRow.id })
        : null,
  };
}

export async function markRead(notificationId: string, userId: string) {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification) throw new AppError(404, "notification_not_found");
  if (notification.recipient_id !== userId) throw new AppError(403, "not_your_notification");

  // Already read — return as-is (idempotent)
  if (notification.read_at) return notification;

  const [updated] = await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(eq(notifications.id, notificationId))
    .returning();

  return updated!;
}

export async function markAllRead(userId: string) {
  const result = await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(and(eq(notifications.recipient_id, userId), isNull(notifications.read_at)))
    .returning({ id: notifications.id });

  return { updated: result.length };
}

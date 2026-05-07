import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { comments } from "../db/schema/comments.ts";
import { issues, issueWatchers } from "../db/schema/issues.ts";
import { users } from "../db/schema/users.ts";
import { getActorRoleByProject } from "./workspace.service.ts";
import { notificationQueue, activityQueue } from "../utils/queues.ts";
import { publish } from "../ws/publisher.ts";
import { encodeCursor, decodeCursor } from "../utils/pagination.ts";
import { AppError } from "../types/index.ts";

// Extracts user IDs from @{uuid} patterns in body
function parseMentions(body: string): string[] {
  const matches = body.match(/@\{([0-9a-f-]{36})\}/gi) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -1)))];
}

async function getComment(commentId: string) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), isNull(comments.deleted_at)))
    .limit(1);
  if (!comment) throw new AppError(404, "comment_not_found");
  return comment;
}

export async function listComments(
  issueId: string,
  actorId: string,
  cursor?: string,
  limit = 20,
) {
  const [issue] = await db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");
  await getActorRoleByProject(issue.project_id, actorId);

  const pageSize = Math.min(limit, 100);
  const decoded = cursor ? decodeCursor(cursor) : null;

  const rows = await db
    .select({
      id: comments.id,
      issue_id: comments.issue_id,
      parent_comment_id: comments.parent_comment_id,
      body: comments.body,
      mentions: comments.mentions,
      created_at: comments.created_at,
      updated_at: comments.updated_at,
      author_id: users.id,
      author_email: users.email,
      author_display_name: users.display_name,
      author_avatar_url: users.avatar_url,
    })
    .from(comments)
    .innerJoin(users, eq(comments.author_id, users.id))
    .where(
      and(
        eq(comments.issue_id, issueId),
        isNull(comments.deleted_at),
        decoded
          ? sql`(${comments.created_at}, ${comments.id}) > (${decoded.created_at}::timestamptz, ${decoded.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(comments.created_at, comments.id)
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = data.at(-1);

  return {
    comments: data,
    next_cursor:
      hasMore && lastRow
        ? encodeCursor({ created_at: lastRow.created_at.toISOString(), id: lastRow.id })
        : null,
  };
}

export async function createComment(
  issueId: string,
  actorId: string,
  body: string,
  parentCommentId?: string,
) {
  const [issue] = await db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");
  await getActorRoleByProject(issue.project_id, actorId);

  if (parentCommentId) {
    const parent = await getComment(parentCommentId);
    if (parent.issue_id !== issueId) throw new AppError(400, "parent_comment_not_on_issue");
  }

  const mentions = parseMentions(body);

  const [comment] = await db
    .insert(comments)
    .values({ issue_id: issueId, author_id: actorId, body, mentions, parent_comment_id: parentCommentId })
    .returning();

  // Notify mentioned users
  for (const mentionedUserId of mentions) {
    if (mentionedUserId === actorId) continue;
    await notificationQueue.add("notification", {
      recipientId: mentionedUserId,
      actorId,
      issueId,
      projectId: issue.project_id,
      type: "mentioned",
    });
  }

  // Notify watchers (excluding actor and already-mentioned users)
  const mentionSet = new Set(mentions);
  const watchers = await db
    .select({ user_id: issueWatchers.user_id })
    .from(issueWatchers)
    .where(eq(issueWatchers.issue_id, issueId));

  for (const { user_id } of watchers) {
    if (user_id === actorId || mentionSet.has(user_id)) continue;
    await notificationQueue.add("notification", {
      recipientId: user_id,
      actorId,
      issueId,
      projectId: issue.project_id,
      type: "comment_added",
    });
  }

  await activityQueue.add("activity-log", {
    projectId: issue.project_id,
    issueId,
    actorId,
    eventType: "comment_added",
    oldValue: null,
    newValue: { comment_id: comment!.id },
  });

  await publish(`project:${issue.project_id}`, "comment_added", comment!, actorId);
  return comment!;
}

export async function updateComment(commentId: string, actorId: string, body: string) {
  const comment = await getComment(commentId);
  if (comment.author_id !== actorId) throw new AppError(403, "not_comment_author");

  const mentions = parseMentions(body);

  const [updated] = await db
    .update(comments)
    .set({ body, mentions, updated_at: new Date() })
    .where(eq(comments.id, commentId))
    .returning();

  return updated!;
}

export async function deleteComment(commentId: string, actorId: string) {
  const comment = await getComment(commentId);

  const [issue] = await db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(eq(issues.id, comment.issue_id))
    .limit(1);

  const isAuthor = comment.author_id === actorId;
  if (!isAuthor) {
    const role = await getActorRoleByProject(issue!.project_id, actorId);
    if (!["owner", "admin"].includes(role)) throw new AppError(403, "insufficient_role");
  }

  await db
    .update(comments)
    .set({ deleted_at: new Date() })
    .where(eq(comments.id, commentId));
}

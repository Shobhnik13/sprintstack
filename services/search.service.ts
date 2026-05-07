import { and, isNull, sql, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { issues } from "../db/schema/issues.ts";
import { projects } from "../db/schema/projects.ts";
import { workspaceMembers } from "../db/schema/workspaces.ts";
import { encodeCursor, decodeCursor } from "../utils/pagination.ts";

export interface SearchFilters {
  q?: string;
  project_id?: string;
  status_id?: string;
  assignee_id?: string;
  priority?: string;
  type?: string;
  cursor?: string;
  limit?: number;
}

export async function searchIssues(actorId: string, filters: SearchFilters) {
  const pageSize = Math.min(filters.limit ?? 20, 100);
  const decoded = filters.cursor ? decodeCursor(filters.cursor) : null;

  const conditions = [isNull(issues.deleted_at)];

  
  if (filters.project_id) {
    conditions.push(eq(issues.project_id, filters.project_id));
  } else {
    // only issues from projects in workspaces the user belongs to
    conditions.push(
      sql`${issues.project_id} IN (
        SELECT p.id FROM projects p
        INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE wm.user_id = ${actorId}
      )`,
    );
  }

  if (filters.status_id) conditions.push(eq(issues.status_id, filters.status_id));
  if (filters.assignee_id) conditions.push(eq(issues.assignee_id, filters.assignee_id));
  if (filters.priority) conditions.push(eq(issues.priority, filters.priority as typeof issues.priority._.data));
  if (filters.type) conditions.push(eq(issues.type, filters.type as typeof issues.type._.data));

  if (decoded) {
    conditions.push(
      sql`(${issues.created_at}, ${issues.id}) < (${decoded.created_at}::timestamptz, ${decoded.id}::uuid)`,
    );
  }

  
  const rows = filters.q
    ? await db
        .select({
          id: issues.id,
          project_id: issues.project_id,
          issue_number: issues.issue_number,
          type: issues.type,
          title: issues.title,
          description: issues.description,
          status_id: issues.status_id,
          priority: issues.priority,
          assignee_id: issues.assignee_id,
          reporter_id: issues.reporter_id,
          story_points: issues.story_points,
          labels: issues.labels,
          created_at: issues.created_at,
          updated_at: issues.updated_at,
          rank: sql<number>`ts_rank(
            to_tsvector('english', ${issues.title} || ' ' || COALESCE(${issues.description}, '')),
            websearch_to_tsquery('english', ${filters.q})
          )`.as("rank"),
        })
        .from(issues)
        .where(
          and(
            ...conditions,
            sql`to_tsvector('english', ${issues.title} || ' ' || COALESCE(${issues.description}, ''))
              @@ websearch_to_tsquery('english', ${filters.q})`,
          ),
        )
        .orderBy(sql`rank DESC`, issues.created_at, issues.id)
        .limit(pageSize + 1)
    : await db
        .select({
          id: issues.id,
          project_id: issues.project_id,
          issue_number: issues.issue_number,
          type: issues.type,
          title: issues.title,
          description: issues.description,
          status_id: issues.status_id,
          priority: issues.priority,
          assignee_id: issues.assignee_id,
          reporter_id: issues.reporter_id,
          story_points: issues.story_points,
          labels: issues.labels,
          created_at: issues.created_at,
          updated_at: issues.updated_at,
        })
        .from(issues)
        .where(and(...conditions))
        .orderBy(sql`${issues.created_at} DESC`, issues.id)
        .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = data.at(-1);

  return {
    issues: data,
    next_cursor:
      hasMore && lastRow
        ? encodeCursor({ created_at: lastRow.created_at.toISOString(), id: lastRow.id })
        : null,
  };
}

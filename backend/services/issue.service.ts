import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { issues, issueWatchers } from "../db/schema/issues.ts";
import { workflowStatuses } from "../db/schema/projects.ts";
import { users } from "../db/schema/users.ts";
import { getActorRoleByProject } from "./workspace.service.ts";
import { invalidateBoardCache } from "./project.service.ts";
import { activityQueue } from "../utils/queues.ts";
import { publish } from "../ws/publisher.ts";
import { AppError } from "../types/index.ts";

type IssueType = "epic" | "story" | "task" | "bug" | "subtask";
type IssuePriority = "lowest" | "low" | "medium" | "high" | "critical";

export interface CreateIssueInput {
  type?: IssueType;
  title: string;
  description?: string;
  priority?: IssuePriority;
  assignee_id?: string;
  parent_id?: string;
  story_points?: number;
  labels?: string[];
}

export interface UpdateIssueInput {
  version: number;
  type?: IssueType;
  title?: string;
  description?: string | null;
  priority?: IssuePriority;
  assignee_id?: string | null;
  parent_id?: string | null;
  story_points?: number | null;
  labels?: string[];
}

export async function createIssue(projectId: string, actorId: string, input: CreateIssueInput) {
  await getActorRoleByProject(projectId, actorId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`);

    const rows = await tx.execute<{ next: number }>(
      sql`SELECT COALESCE(MAX(issue_number), 0) + 1 AS next FROM issues WHERE project_id = ${projectId}`,
    );
    const next = rows[0]!.next;

    // Default to first 'todo' status of the project
    const [defaultStatus] = await tx
      .select({ id: workflowStatuses.id })
      .from(workflowStatuses)
      .where(and(eq(workflowStatuses.project_id, projectId), eq(workflowStatuses.category, "todo")))
      .orderBy(workflowStatuses.position)
      .limit(1);

    if (!defaultStatus) throw new AppError(400, "project_has_no_todo_status");

    const [issue] = await tx
      .insert(issues)
      .values({
        project_id: projectId,
        issue_number: next,
        reporter_id: actorId,
        status_id: defaultStatus.id,
        type: input.type ?? "task",
        title: input.title,
        description: input.description,
        priority: input.priority ?? "medium",
        assignee_id: input.assignee_id,
        parent_id: input.parent_id,
        story_points: input.story_points,
        labels: input.labels,
      })
      .returning();

    await activityQueue.add("activity-log", {
      projectId,
      issueId: issue!.id,
      actorId,
      eventType: "issue_created",
      oldValue: null,
      newValue: { title: issue!.title, status_id: issue!.status_id },
    });

    await invalidateBoardCache(projectId);
    await publish(`project:${projectId}`, "issue_created", issue!, actorId);
    return issue!;
  });
}

export async function getIssue(issueId: string, actorId: string) {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");

  await getActorRoleByProject(issue.project_id, actorId);

  const watchers = await db
    .select({
      user_id: issueWatchers.user_id,
      email: users.email,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
    })
    .from(issueWatchers)
    .innerJoin(users, eq(issueWatchers.user_id, users.id))
    .where(eq(issueWatchers.issue_id, issueId));

  return { ...issue, watchers };
}

export async function updateIssue(issueId: string, actorId: string, input: UpdateIssueInput) {
  const [current] = await db
    .select({ id: issues.id, project_id: issues.project_id, version: issues.version })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!current) throw new AppError(404, "issue_not_found");

  await getActorRoleByProject(current.project_id, actorId);

  const { version, ...fields } = input;

  const updated = await db
    .update(issues)
    .set({
      ...fields,
      version: sql`${issues.version} + 1`,
      updated_at: new Date(),
    })
    .where(and(eq(issues.id, issueId), eq(issues.version, version), isNull(issues.deleted_at)))
    .returning();

  if (updated.length === 0) {
    const [fresh] = await db.select({ version: issues.version }).from(issues).where(eq(issues.id, issueId)).limit(1);
    throw new AppError(409, "conflict", { currentVersion: fresh?.version });
  }

  await activityQueue.add("activity-log", {
    projectId: current.project_id,
    issueId,
    actorId,
    eventType: "issue_updated",
    oldValue: { version: current.version },
    newValue: fields,
  });

  await invalidateBoardCache(current.project_id);
  await publish(`project:${current.project_id}`, "issue_updated", updated[0]!, actorId);
  return updated[0]!;
}

export async function deleteIssue(issueId: string, actorId: string) {
  const [issue] = await db
    .select({ id: issues.id, project_id: issues.project_id, reporter_id: issues.reporter_id })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");

  const role = await getActorRoleByProject(issue.project_id, actorId);

  // Only reporter or admin+ can delete
  const isReporter = issue.reporter_id === actorId;
  const isAdmin = ["owner", "admin"].includes(role);
  if (!isReporter && !isAdmin) throw new AppError(403, "insufficient_role");

  await db
    .update(issues)
    .set({ deleted_at: new Date() })
    .where(eq(issues.id, issueId));

  await invalidateBoardCache(issue.project_id);
}

export async function addWatcher(issueId: string, actorId: string) {
  const [issue] = await db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");
  await getActorRoleByProject(issue.project_id, actorId);

  await db
    .insert(issueWatchers)
    .values({ issue_id: issueId, user_id: actorId })
    .onConflictDoNothing();

  await activityQueue.add("activity-log", {
    projectId: issue.project_id,
    issueId,
    actorId,
    eventType: "watcher_added",
    oldValue: null,
    newValue: { user_id: actorId },
  });
}

export async function removeWatcher(issueId: string, actorId: string) {
  await db
    .delete(issueWatchers)
    .where(and(eq(issueWatchers.issue_id, issueId), eq(issueWatchers.user_id, actorId)));
}

export async function listWatchers(issueId: string, actorId: string) {
  const [issue] = await db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");
  await getActorRoleByProject(issue.project_id, actorId);

  return db
    .select({
      user_id: issueWatchers.user_id,
      email: users.email,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
    })
    .from(issueWatchers)
    .innerJoin(users, eq(issueWatchers.user_id, users.id))
    .where(eq(issueWatchers.issue_id, issueId));
}

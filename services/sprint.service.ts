import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { sprints } from "../db/schema/sprints.ts";
import { issues } from "../db/schema/issues.ts";
import { workflowStatuses } from "../db/schema/projects.ts";
import { getActorRoleInWorkspace, getActorRoleByProject, requireMinRole } from "./workspace.service.ts";
import { projects } from "../db/schema/projects.ts";
import { activityQueue } from "../utils/queues.ts";
import { publish } from "../ws/publisher.ts";
import { AppError } from "../types/index.ts";

async function getSprint(sprintId: string) {
  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
  if (!sprint) throw new AppError(404, "sprint_not_found");
  return sprint;
}

export async function createSprint(
  projectId: string,
  actorId: string,
  name: string,
  goal?: string,
  startDate?: string,
  endDate?: string,
) {
  const role = await getActorRoleByProject(projectId, actorId);
  requireMinRole(role, "admin");

  const [sprint] = await db
    .insert(sprints)
    .values({ project_id: projectId, name, goal, start_date: startDate, end_date: endDate })
    .returning();

  return sprint!;
}

export async function listSprints(projectId: string, actorId: string) {
  await getActorRoleByProject(projectId, actorId);
  return db.select().from(sprints).where(eq(sprints.project_id, projectId)).orderBy(sprints.created_at);
}

export async function updateSprint(
  sprintId: string,
  actorId: string,
  fields: { name?: string; goal?: string; start_date?: string; end_date?: string },
) {
  const sprint = await getSprint(sprintId);
  if (sprint.status === "completed") throw new AppError(400, "cannot_modify_completed_sprint");

  const role = await getActorRoleByProject(sprint.project_id, actorId);
  requireMinRole(role, "admin");

  const [updated] = await db
    .update(sprints)
    .set(fields)
    .where(eq(sprints.id, sprintId))
    .returning();

  return updated!;
}

export async function startSprint(sprintId: string, actorId: string) {
  const sprint = await getSprint(sprintId);
  if (sprint.status !== "planning") throw new AppError(400, "sprint_not_in_planning");

  const role = await getActorRoleByProject(sprint.project_id, actorId);
  requireMinRole(role, "admin");

  const [active] = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(and(eq(sprints.project_id, sprint.project_id), eq(sprints.status, "active")))
    .limit(1);

  if (active) throw new AppError(409, "active_sprint_exists");

  const [updated] = await db
    .update(sprints)
    .set({ status: "active", start_date: sprint.start_date ?? new Date().toISOString().slice(0, 10) })
    .where(eq(sprints.id, sprintId))
    .returning();

  await activityQueue.add("activity-log", {
    projectId: sprint.project_id,
    issueId: null,
    actorId,
    eventType: "sprint_started",
    oldValue: { status: "planning" },
    newValue: { status: "active", sprint_id: sprintId },
  });

  await publish(`project:${sprint.project_id}`, "sprint_started", updated!, actorId);
  return updated!;
}

export async function completeSprint(
  sprintId: string,
  actorId: string,
  carryOverIssueIds: string[],
  nextSprintId?: string,
) {
  const sprint = await getSprint(sprintId);
  if (sprint.status !== "active") throw new AppError(400, "sprint_not_active");

  const role = await getActorRoleByProject(sprint.project_id, actorId);
  requireMinRole(role, "admin");

  if (nextSprintId) {
    const [nextSprint] = await db
      .select({ project_id: sprints.project_id, status: sprints.status })
      .from(sprints)
      .where(eq(sprints.id, nextSprintId))
      .limit(1);

    if (!nextSprint || nextSprint.project_id !== sprint.project_id) {
      throw new AppError(400, "invalid_next_sprint");
    }
    if (nextSprint.status === "completed") {
      throw new AppError(400, "next_sprint_already_completed");
    }
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM sprints WHERE id = ${sprintId} FOR UPDATE`);

    const sprintIssues = await tx
      .select({
        id: issues.id,
        status_id: issues.status_id,
        story_points: issues.story_points,
      })
      .from(issues)
      .where(and(eq(issues.sprint_id, sprintId), isNull(issues.deleted_at)));

    const statusIds = [...new Set(sprintIssues.map((i) => i.status_id))];
    const doneStatusIds = statusIds.length > 0
      ? (await tx
          .select({ id: workflowStatuses.id })
          .from(workflowStatuses)
          .where(
            and(
              sql`${workflowStatuses.id} = ANY(${sql.raw(`ARRAY[${statusIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
              eq(workflowStatuses.category, "done"),
            ),
          )
        ).map((s) => s.id)
      : [];

    const completedIssues = sprintIssues.filter((i) => doneStatusIds.includes(i.status_id));
    const incompleteIssues = sprintIssues.filter((i) => !doneStatusIds.includes(i.status_id));

    const incompleteIds = new Set(incompleteIssues.map((i) => i.id));
    for (const id of carryOverIssueIds) {
      if (!incompleteIds.has(id)) throw new AppError(400, "invalid_carry_over_issue", { issueId: id });
    }

    if (carryOverIssueIds.length > 0) {
      await tx
        .update(issues)
        .set({ sprint_id: nextSprintId ?? null })
        .where(inArray(issues.id, carryOverIssueIds));
    }

    const leftBehindIds = incompleteIssues
      .map((i) => i.id)
      .filter((id) => !carryOverIssueIds.includes(id));

    if (leftBehindIds.length > 0) {
      await tx
        .update(issues)
        .set({ sprint_id: null })
        .where(inArray(issues.id, leftBehindIds));
    }

    // Velocity = sum of story_points of completed issues
    const velocity = completedIssues.reduce((sum, i) => sum + (i.story_points ?? 0), 0);

    const [completed] = await tx
      .update(sprints)
      .set({
        status: "completed",
        velocity_points: velocity,
        completed_at: new Date(),
      })
      .where(eq(sprints.id, sprintId))
      .returning();

    await activityQueue.add("activity-log", {
      projectId: sprint.project_id,
      issueId: null,
      actorId,
      eventType: "sprint_completed",
      oldValue: { status: "active" },
      newValue: {
        status: "completed",
        velocity,
        completed_issues: completedIssues.length,
        incomplete_issues: incompleteIssues.length,
      },
    });

    await publish(`project:${sprint.project_id}`, "sprint_completed", completed!, actorId);
    return {
      sprint: completed!,
      summary: {
        completed_issues: completedIssues.length,
        incomplete_issues: incompleteIssues.length,
        carried_over: carryOverIssueIds.length,
        moved_to_backlog: leftBehindIds.length,
        velocity,
      },
    };
  });
}

export async function listIncompleteIssues(sprintId: string, actorId: string) {
  const sprint = await getSprint(sprintId);
  await getActorRoleByProject(sprint.project_id, actorId);

  const sprintIssues = await db
    .select({ id: issues.id, status_id: issues.status_id })
    .from(issues)
    .where(and(eq(issues.sprint_id, sprintId), isNull(issues.deleted_at)));

  if (sprintIssues.length === 0) return [];

  const statusIds = [...new Set(sprintIssues.map((i) => i.status_id))];
  const doneIds = (
    await db
      .select({ id: workflowStatuses.id })
      .from(workflowStatuses)
      .where(
        and(
          sql`${workflowStatuses.id} = ANY(${sql.raw(`ARRAY[${statusIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
          eq(workflowStatuses.category, "done"),
        ),
      )
  ).map((s) => s.id);

  const incompleteIds = sprintIssues.filter((i) => !doneIds.includes(i.status_id)).map((i) => i.id);
  if (incompleteIds.length === 0) return [];

  return db
    .select()
    .from(issues)
    .where(inArray(issues.id, incompleteIds));
}

export async function addIssueToSprint(sprintId: string, actorId: string, issueId: string) {
  const sprint = await getSprint(sprintId);
  if (sprint.status === "completed") throw new AppError(400, "cannot_add_to_completed_sprint");

  const role = await getActorRoleByProject(sprint.project_id, actorId);
  requireMinRole(role, "member");

  const [issue] = await db
    .select({ id: issues.id, project_id: issues.project_id })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deleted_at)))
    .limit(1);

  if (!issue) throw new AppError(404, "issue_not_found");
  if (issue.project_id !== sprint.project_id) throw new AppError(400, "issue_not_in_same_project");

  const [updated] = await db
    .update(issues)
    .set({ sprint_id: sprintId })
    .where(eq(issues.id, issueId))
    .returning({ id: issues.id, sprint_id: issues.sprint_id });

  await activityQueue.add("activity-log", {
    projectId: sprint.project_id,
    issueId,
    actorId,
    eventType: "issue_moved",
    oldValue: { sprint_id: null },
    newValue: { sprint_id: sprintId },
  });

  return updated!;
}

export async function removeIssueFromSprint(sprintId: string, actorId: string, issueId: string) {
  const sprint = await getSprint(sprintId);
  if (sprint.status === "completed") throw new AppError(400, "cannot_modify_completed_sprint");

  const role = await getActorRoleByProject(sprint.project_id, actorId);
  requireMinRole(role, "member");

  await db
    .update(issues)
    .set({ sprint_id: null })
    .where(and(eq(issues.id, issueId), eq(issues.sprint_id, sprintId)));
}

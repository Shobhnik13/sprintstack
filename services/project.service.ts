import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { projects, workflowStatuses, workflowTransitions } from "../db/schema/projects.ts";
import { issues } from "../db/schema/issues.ts";
import {
  getActorRoleInWorkspace,
  getActorRoleByProject,
  requireMinRole,
} from "./workspace.service.ts";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.ts";
import { AppError } from "../types/index.ts";

type StatusCategory = "todo" | "in_progress" | "done";

const DEFAULT_STATUSES: { name: string; color: string; position: number; category: StatusCategory }[] = [
  { name: "Todo", color: "#6B7280", position: 0, category: "todo" },
  { name: "In Progress", color: "#3B82F6", position: 1, category: "in_progress" },
  { name: "In Review", color: "#F59E0B", position: 2, category: "in_progress" },
  { name: "Done", color: "#10B981", position: 3, category: "done" },
];

const DEFAULT_TRANSITION_PAIRS = [
  [0, 1], // Todo → In Progress
  [1, 2], // In Progress → In Review
  [2, 3], // In Review → Done
  [2, 1], // In Review → In Progress (send back)
  [3, 1], // Done → In Progress (reopen)
];

export async function createProject(
  workspaceId: string,
  actorId: string,
  name: string,
  key: string,
  description?: string,
) {
  const actorRole = await getActorRoleInWorkspace(workspaceId, actorId);
  requireMinRole(actorRole, "admin");

  const upperKey = key.toUpperCase();

  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ workspace_id: workspaceId, key: upperKey, name, description, created_by: actorId })
      .returning();

    const insertedStatuses = await tx
      .insert(workflowStatuses)
      .values(DEFAULT_STATUSES.map((s) => ({ ...s, project_id: project!.id })))
      .returning();

    const transitions = DEFAULT_TRANSITION_PAIRS.map(([fi, ti]) => ({
      project_id: project!.id,
      from_status_id: insertedStatuses[fi!]!.id,
      to_status_id: insertedStatuses[ti!]!.id,
    }));

    await tx.insert(workflowTransitions).values(transitions);

    return { ...project!, statuses: insertedStatuses };
  });
}

export async function listProjects(workspaceId: string, actorId: string) {
  await getActorRoleInWorkspace(workspaceId, actorId);

  return db
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      description: projects.description,
      created_at: projects.created_at,
      updated_at: projects.updated_at,
    })
    .from(projects)
    .where(eq(projects.workspace_id, workspaceId));
}

export async function getProject(projectId: string, actorId: string) {
  await getActorRoleByProject(projectId, actorId);

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) throw new AppError(404, "project_not_found");

  const statuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.project_id, projectId))
    .orderBy(workflowStatuses.position);

  const transitions = await db
    .select()
    .from(workflowTransitions)
    .where(eq(workflowTransitions.project_id, projectId));

  return { ...project, workflow: { statuses, transitions } };
}

export async function getBoard(projectId: string, actorId: string) {
  await getActorRoleByProject(projectId, actorId);

  const cacheKey = `board:${projectId}`;
  const cached = await cacheGet<ReturnType<typeof buildBoard>>(cacheKey);
  if (cached) return cached;

  const result = await buildBoard(projectId);
  await cacheSet(cacheKey, result, 30);
  return result;
}

async function buildBoard(projectId: string) {
  const statuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.project_id, projectId))
    .orderBy(workflowStatuses.position);

  const projectIssues = await db
    .select()
    .from(issues)
    .where(and(eq(issues.project_id, projectId), isNull(issues.deleted_at)));

  const issuesByStatus = new Map<string, typeof projectIssues>();
  for (const status of statuses) issuesByStatus.set(status.id, []);
  for (const issue of projectIssues) issuesByStatus.get(issue.status_id)?.push(issue);

  return statuses.map((s) => ({ ...s, issues: issuesByStatus.get(s.id) ?? [] }));
}

export async function getWorkflow(projectId: string, actorId: string) {
  await getActorRoleByProject(projectId, actorId);

  const cacheKey = `workflow:${projectId}`;
  const cached = await cacheGet<{ statuses: unknown[]; transitions: unknown[] }>(cacheKey);
  if (cached) return cached;

  const statuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.project_id, projectId))
    .orderBy(workflowStatuses.position);

  const transitions = await db
    .select()
    .from(workflowTransitions)
    .where(eq(workflowTransitions.project_id, projectId));

  const result = { statuses, transitions };
  await cacheSet(cacheKey, result, 300); // 5 min
  return result;
}

export async function addStatus(
  projectId: string,
  actorId: string,
  name: string,
  color: string,
  category: StatusCategory,
) {
  const actorRole = await getActorRoleByProject(projectId, actorId);
  requireMinRole(actorRole, "admin");

  const existing = await db
    .select({ position: workflowStatuses.position })
    .from(workflowStatuses)
    .where(eq(workflowStatuses.project_id, projectId))
    .orderBy(workflowStatuses.position);

  const maxPosition = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) : -1;

  const [status] = await db
    .insert(workflowStatuses)
    .values({ project_id: projectId, name, color, position: maxPosition + 1, category })
    .returning();

  // Invalidate workflow cache
  await cacheDel(`workflow:${projectId}`);

  return status!;
}

export async function addTransition(
  projectId: string,
  actorId: string,
  toStatusId: string,
  fromStatusId?: string,
) {
  const actorRole = await getActorRoleByProject(projectId, actorId);
  requireMinRole(actorRole, "admin");

  const found = await db
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(eq(workflowStatuses.project_id, projectId));

  const foundIds = new Set(found.map((s) => s.id));
  const statusIds = [toStatusId, ...(fromStatusId ? [fromStatusId] : [])];
  for (const id of statusIds) {
    if (!foundIds.has(id)) throw new AppError(400, "status_not_in_project");
  }

  const [transition] = await db
    .insert(workflowTransitions)
    .values({ project_id: projectId, from_status_id: fromStatusId ?? null, to_status_id: toStatusId })
    .returning();

  // Invalidate workflow cache
  await cacheDel(`workflow:${projectId}`);

  return transition!;
}

// Called by issue service after any issue mutation to bust board cache
export async function invalidateBoardCache(projectId: string) {
  await cacheDel(`board:${projectId}`); 
}

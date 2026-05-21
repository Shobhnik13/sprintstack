import { eq, and } from "drizzle-orm";
import { db } from "../db/index.ts";
import { workspaces, workspaceMembers, workspaceRoleEnum } from "../db/schema/workspaces.ts";
import { projects } from "../db/schema/projects.ts";
import { users } from "../db/schema/users.ts";
import { AppError } from "../types/index.ts";

export type Role = (typeof workspaceRoleEnum.enumValues)[number];

export const ROLE_RANK: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export function requireMinRole(actual: Role, minimum: Role): void {
  if (ROLE_RANK[actual] < ROLE_RANK[minimum]) throw new AppError(403, "insufficient_role");
}

export async function getActorRoleInWorkspace(workspaceId: string, userId: string): Promise<Role> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, userId)))
    .limit(1);
  if (!row) throw new AppError(403, "not_a_member");
  return row.role;
}

export async function getActorRoleByProject(projectId: string, userId: string): Promise<Role> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(projects)
    .innerJoin(workspaceMembers, eq(projects.workspace_id, workspaceMembers.workspace_id))
    .where(and(eq(projects.id, projectId), eq(workspaceMembers.user_id, userId)))
    .limit(1);
  if (!row) throw new AppError(403, "not_a_member");
  return row.role;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createWorkspace(name: string, creatorId: string, slug?: string) {
  const resolvedSlug = slug ?? slugify(name);

  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, resolvedSlug))
    .limit(1);

  if (existing.length > 0) throw new AppError(409, "slug_taken");

  const [workspace] = await db
    .insert(workspaces)
    .values({ name, slug: resolvedSlug, created_by: creatorId })
    .returning();

  await db.insert(workspaceMembers).values({
    workspace_id: workspace!.id,
    user_id: creatorId,
    role: "owner",
  });

  return workspace!;
}

export async function listWorkspaces(userId: string) {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      created_at: workspaces.created_at,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspace_id, workspaces.id))
    .where(eq(workspaceMembers.user_id, userId));
}

export async function getWorkspace(workspaceId: string, userId: string) {
  await getActorRoleInWorkspace(workspaceId, userId);

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) throw new AppError(404, "workspace_not_found");

  const members = await db
    .select({
      user_id: workspaceMembers.user_id,
      role: workspaceMembers.role,
      joined_at: workspaceMembers.joined_at,
      email: users.email,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.user_id, users.id))
    .where(eq(workspaceMembers.workspace_id, workspaceId));

  return { ...workspace, members };
}

export async function addMember(workspaceId: string, actorId: string, email: string, role: Role) {
  const actorRole = await getActorRoleInWorkspace(workspaceId, actorId);
  requireMinRole(actorRole, "admin");
  if (role === "owner") throw new AppError(400, "cannot_assign_owner");

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser) throw new AppError(404, "user_not_found");

  const existing = await db
    .select({ user_id: workspaceMembers.user_id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, targetUser.id)))
    .limit(1);

  if (existing.length > 0) throw new AppError(409, "already_a_member");

  const [member] = await db
    .insert(workspaceMembers)
    .values({ workspace_id: workspaceId, user_id: targetUser.id, role })
    .returning();

  return member!;
}

export async function updateMemberRole(
  workspaceId: string,
  actorId: string,
  targetUserId: string,
  role: Role,
) {
  const actorRole = await getActorRoleInWorkspace(workspaceId, actorId);
  requireMinRole(actorRole, "admin");
  if (role === "owner") throw new AppError(400, "cannot_assign_owner");
  if (actorId === targetUserId) throw new AppError(400, "cannot_change_own_role");

  const [targetRow] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, targetUserId)))
    .limit(1);

  if (!targetRow) throw new AppError(404, "member_not_found");
  if (targetRow.role === "owner") throw new AppError(403, "cannot_modify_owner");

  const [updated] = await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, targetUserId)))
    .returning();

  return updated!;
}

export async function removeMember(workspaceId: string, actorId: string, targetUserId: string) {
  const actorRole = await getActorRoleInWorkspace(workspaceId, actorId);

  if (actorId === targetUserId) {
    if (actorRole === "owner") throw new AppError(400, "owner_must_transfer_before_leaving");
  } else {
    requireMinRole(actorRole, "admin");
    const [targetRow] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, targetUserId)))
      .limit(1);

    if (!targetRow) throw new AppError(404, "member_not_found");
    if (targetRow.role === "owner") throw new AppError(403, "cannot_remove_owner");
  }

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, targetUserId)));
}

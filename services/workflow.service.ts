import { eq, and, or, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { issues } from "../db/schema/issues.ts";
import {
  workflowTransitions,
  workflowTransitionConditions,
  workflowTransitionActions,
  workflowStatuses,
} from "../db/schema/projects.ts";
import { getActorRoleByProject } from "./workspace.service.ts";
import { invalidateBoardCache } from "./project.service.ts";
import { notificationQueue, activityQueue } from "../utils/queues.ts";
import { publish } from "../ws/publisher.ts";
import { AppError } from "../types/index.ts";

export async function transitionIssue(issueId: string, toStatusId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [issue] = await tx.execute<typeof issues.$inferSelect>(
      sql`SELECT * FROM issues WHERE id = ${issueId} AND deleted_at IS NULL FOR UPDATE`,
    );

    if (!issue) throw new AppError(404, "issue_not_found");

    await getActorRoleByProject(issue.project_id, actorId);

    const allowedTransitions = await tx
      .select({
        id: workflowTransitions.id,
        to_status_id: workflowTransitions.to_status_id,
        from_status_id: workflowTransitions.from_status_id,
      })
      .from(workflowTransitions)
      .where(
        and(
          eq(workflowTransitions.project_id, issue.project_id),
          or(
            eq(workflowTransitions.from_status_id, issue.status_id),
            isNull(workflowTransitions.from_status_id),
          ),
        ),
      );

    const matchedTransition = allowedTransitions.find((t) => t.to_status_id === toStatusId);

    if (!matchedTransition) {
      const allowedStatusIds = allowedTransitions.map((t) => t.to_status_id);
      const allowedStatuses =
        allowedStatusIds.length > 0
          ? await tx
              .select({ id: workflowStatuses.id, name: workflowStatuses.name })
              .from(workflowStatuses)
              .where(
                sql`${workflowStatuses.id} = ANY(${sql.raw(`ARRAY[${allowedStatusIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
              )
          : [];

      const [currentStatus] = await tx
        .select({ name: workflowStatuses.name })
        .from(workflowStatuses)
        .where(eq(workflowStatuses.id, issue.status_id))
        .limit(1);

      throw new AppError(422, "invalid_transition", {
        currentStatus: currentStatus?.name,
        allowedTransitions: allowedStatuses,
      });
    }

    const conditions = await tx
      .select()
      .from(workflowTransitionConditions)
      .where(eq(workflowTransitionConditions.transition_id, matchedTransition.id));

    for (const condition of conditions) {
      const config = condition.condition_config as Record<string, unknown>;
      const field = config["field"] as keyof typeof issue;

      if (condition.condition_type === "field_required") {
        if (issue[field] === null || issue[field] === undefined) {
          throw new AppError(422, "transition_condition_failed", {
            reason: `field_required`,
            field,
          });
        }
      } else if (condition.condition_type === "field_value") {
        if (issue[field] !== config["value"]) {
          throw new AppError(422, "transition_condition_failed", {
            reason: `field_value`,
            field,
            expected: config["value"],
            actual: issue[field],
          });
        }
      }
    }

    const updated = await tx
      .update(issues)
      .set({
        status_id: toStatusId,
        version: sql`${issues.version} + 1`,
        updated_at: new Date(),
      })
      .where(and(eq(issues.id, issueId), eq(issues.version, issue.version)))
      .returning();

    if (updated.length === 0) {
      throw new AppError(409, "conflict", { currentVersion: issue.version });
    }

    const updatedIssue = updated[0]!;

    const actions = await tx
      .select()
      .from(workflowTransitionActions)
      .where(eq(workflowTransitionActions.transition_id, matchedTransition.id));

    for (const action of actions) {
      const config = action.action_config as Record<string, unknown>;

      if (action.action_type === "assign_user") {
        await tx
          .update(issues)
          .set({ assignee_id: config["user_id"] as string })
          .where(eq(issues.id, issueId));
      } else if (action.action_type === "set_field") {
        await tx
          .update(issues)
          .set({ [config["field"] as string]: config["value"] })
          .where(eq(issues.id, issueId));
      } else if (action.action_type === "send_notification" && updatedIssue.assignee_id) {
        await notificationQueue.add("notification", {
          recipientId: updatedIssue.assignee_id,
          actorId,
          issueId,
          projectId: issue.project_id,
          type: "status_changed",
        });
      }
    }

    await activityQueue.add("activity-log", {
      projectId: issue.project_id,
      issueId,
      actorId,
      eventType: "transition_applied",
      oldValue: { status_id: issue.status_id },
      newValue: { status_id: toStatusId },
    });

    await invalidateBoardCache(issue.project_id);
    await publish(`project:${issue.project_id}`, "issue_updated", updatedIssue, actorId);
    return updatedIssue;
  });
}

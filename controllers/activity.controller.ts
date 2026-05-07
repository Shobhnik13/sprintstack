import type { Request, Response } from "express";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as activityService from "../services/activity.service.ts";

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);

export const getActivityFeed = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const q = req.query as Record<string, string>;

  const result = await activityService.getProjectActivity(p(req.params.id!), userId, {
    event_type: q["event_type"] as activityService.ActivityFilters["event_type"],
    actor_id: q["actor_id"],
    issue_id: q["issue_id"],
    cursor: q["cursor"],
    limit: q["limit"] ? Number(q["limit"]) : 20,
  });

  res.status(200).json(result);
});

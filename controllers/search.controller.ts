import type { Request, Response } from "express";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as searchService from "../services/search.service.ts";

export const search = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const q = req.query as Record<string, string>;

  const result = await searchService.searchIssues(userId, {
    q: q["q"],
    project_id: q["project_id"],
    status_id: q["status_id"],
    assignee_id: q["assignee_id"],
    priority: q["priority"],
    type: q["type"],
    cursor: q["cursor"],
    limit: q["limit"] ? Number(q["limit"]) : 20,
  });

  res.status(200).json(result);
});

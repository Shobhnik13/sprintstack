import type { Request, Response } from "express";
import { z } from "zod";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as sprintService from "../services/sprint.service.ts";

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);

export const createSprintSchema = z.object({
  name: z.string().min(1).max(255),
  goal: z.string().max(1000).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  goal: z.string().max(1000).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
});

export const completeSprintSchema = z.object({
  carry_over_issue_ids: z.array(z.string().uuid()).default([]),
  next_sprint_id: z.string().uuid().optional(),
});

export const addIssueSchema = z.object({
  issue_id: z.string().uuid(),
});

export const createSprint = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { name, goal, start_date, end_date } = req.body as z.infer<typeof createSprintSchema>;
  const sprint = await sprintService.createSprint(p(req.params.id!), userId, name, goal, start_date, end_date);
  res.status(201).json({ sprint });
});

export const listSprints = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const sprintList = await sprintService.listSprints(p(req.params.id!), userId);
  res.status(200).json({ sprints: sprintList });
});

export const updateSprint = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const fields = req.body as z.infer<typeof updateSprintSchema>;
  const sprint = await sprintService.updateSprint(p(req.params.id!), userId, fields);
  res.status(200).json({ sprint });
});

export const startSprint = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const sprint = await sprintService.startSprint(p(req.params.id!), userId);
  res.status(200).json({ sprint });
});

export const completeSprint = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { carry_over_issue_ids, next_sprint_id } = req.body as z.infer<typeof completeSprintSchema>;
  const result = await sprintService.completeSprint(p(req.params.id!), userId, carry_over_issue_ids, next_sprint_id);
  res.status(200).json(result);
});

export const listIncomplete = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const issueList = await sprintService.listIncompleteIssues(p(req.params.id!), userId);
  res.status(200).json({ issues: issueList });
});

export const addIssueToSprint = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { issue_id } = req.body as z.infer<typeof addIssueSchema>;
  const result = await sprintService.addIssueToSprint(p(req.params.id!), userId, issue_id);
  res.status(200).json(result);
});

export const removeIssueFromSprint = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  await sprintService.removeIssueFromSprint(p(req.params.id!), userId, p(req.params.issueId!));
  res.status(204).send();
});

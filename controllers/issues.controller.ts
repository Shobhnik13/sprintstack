import type { Request, Response } from "express";
import { z } from "zod";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as issueService from "../services/issue.service.ts";
import * as workflowService from "../services/workflow.service.ts";
import * as commentService from "../services/comment.service.ts";

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);

export const createIssueSchema = z.object({
  type: z.enum(["epic", "story", "task", "bug", "subtask"]).default("task"),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  priority: z.enum(["lowest", "low", "medium", "high", "critical"]).default("medium"),
  assignee_id: z.string().uuid().optional(),
  parent_id: z.string().uuid().optional(),
  story_points: z.number().int().min(0).max(100).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
});

export const updateIssueSchema = z.object({
  version: z.number().int().positive(),
  type: z.enum(["epic", "story", "task", "bug", "subtask"]).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(["lowest", "low", "medium", "high", "critical"]).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  story_points: z.number().int().min(0).max(100).nullable().optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
});

export const transitionSchema = z.object({
  to_status_id: z.string().uuid(),
});

export const createIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const input = req.body as z.infer<typeof createIssueSchema>;
  const issue = await issueService.createIssue(p(req.params.id!), userId, input);
  res.status(201).json({ issue });
});

export const getIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const issue = await issueService.getIssue(p(req.params.id!), userId);
  res.status(200).json({ issue });
});

export const updateIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const input = req.body as z.infer<typeof updateIssueSchema>;
  const issue = await issueService.updateIssue(p(req.params.id!), userId, input);
  res.status(200).json({ issue });
});

export const deleteIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  await issueService.deleteIssue(p(req.params.id!), userId);
  res.status(204).send();
});

export const transitionIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { to_status_id } = req.body as z.infer<typeof transitionSchema>;
  const issue = await workflowService.transitionIssue(p(req.params.id!), to_status_id, userId);
  res.status(200).json({ issue });
});

export const watchIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  await issueService.addWatcher(p(req.params.id!), userId);
  res.status(204).send();
});

export const unwatchIssue = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  await issueService.removeWatcher(p(req.params.id!), userId);
  res.status(204).send();
});

export const listWatchers = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const watchers = await issueService.listWatchers(p(req.params.id!), userId);
  res.status(200).json({ watchers });
});

export const addCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  parent_comment_id: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const listComments = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const cursor = req.query["cursor"] as string | undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 20;
  const result = await commentService.listComments(p(req.params.id!), userId, cursor, limit);
  res.status(200).json(result);
});

export const addComment = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { body, parent_comment_id } = req.body as z.infer<typeof addCommentSchema>;
  const comment = await commentService.createComment(p(req.params.id!), userId, body, parent_comment_id);
  res.status(201).json({ comment });
});

export const updateComment = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { body } = req.body as z.infer<typeof updateCommentSchema>;
  const comment = await commentService.updateComment(p(req.params.cid!), userId, body);
  res.status(200).json({ comment });
});

export const deleteComment = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  await commentService.deleteComment(p(req.params.cid!), userId);
  res.status(204).send();
});

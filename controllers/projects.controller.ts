import type { Request, Response } from "express";
import { z } from "zod";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as projectService from "../services/project.service.ts";
import { getPresenceMembers } from "../ws/presence.ts";

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "key must be uppercase letters and digits only"),
  description: z.string().max(1000).optional(),
});

export const addStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "color must be a hex value like #3B82F6")
    .default("#6B7280"),
  category: z.enum(["todo", "in_progress", "done"]),
});

export const addTransitionSchema = z.object({
  to_status_id: z.string().uuid(),
  from_status_id: z.string().uuid().optional(),
});

export const createProject = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { name, key, description } = req.body as z.infer<typeof createProjectSchema>;
  const project = await projectService.createProject(p(req.params.workspaceId!), userId, name, key, description);
  res.status(201).json({ project });
});

export const listProjects = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const projectList = await projectService.listProjects(p(req.params.workspaceId!), userId);
  res.status(200).json({ projects: projectList });
});

export const getProject = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const project = await projectService.getProject(p(req.params.id!), userId);
  res.status(200).json({ project });
});

export const getBoard = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const columns = await projectService.getBoard(p(req.params.id!), userId);
  res.status(200).json({ board: columns });
});

export const getWorkflow = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const workflow = await projectService.getWorkflow(p(req.params.id!), userId);
  res.status(200).json({ workflow });
});

export const addStatus = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { name, color, category } = req.body as z.infer<typeof addStatusSchema>;
  const status = await projectService.addStatus(p(req.params.id!), userId, name, color, category);
  res.status(201).json({ status });
});

export const addTransition = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { to_status_id, from_status_id } = req.body as z.infer<typeof addTransitionSchema>;
  const transition = await projectService.addTransition(p(req.params.id!), userId, to_status_id, from_status_id);
  res.status(201).json({ transition });
});

export const getPresence = asyncWrapper(async (req: Request, res: Response) => {
  const members = await getPresenceMembers(p(req.params.id!));
  res.status(200).json({ online_user_ids: members });
});

export { stub as addCustomField, stub as createIssue, stub as createSprint, stub as listSprints };

import type { NextFunction } from "express";
function stub(_req: Request, res: Response, _next: NextFunction): void {
  res.status(501).json({ error: "not_implemented" });
}

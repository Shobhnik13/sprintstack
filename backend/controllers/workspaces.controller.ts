import type { Request, Response } from "express";
import { z } from "zod";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as workspaceService from "../services/workspace.service.ts";

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export const createWorkspace = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { name, slug } = req.body as z.infer<typeof createWorkspaceSchema>;
  const workspace = await workspaceService.createWorkspace(name, userId, slug);
  res.status(201).json({ workspace });
});

export const listWorkspaces = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const workspaceList = await workspaceService.listWorkspaces(userId);
  res.status(200).json({ workspaces: workspaceList });
});

export const getWorkspace = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const workspace = await workspaceService.getWorkspace(p(req.params.id!), userId);
  res.status(200).json({ workspace });
});

export const addMember = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { email, role } = req.body as z.infer<typeof addMemberSchema>;
  const member = await workspaceService.addMember(p(req.params.id!), userId, email, role);
  res.status(201).json({ member });
});

export const updateMemberRole = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const { role } = req.body as z.infer<typeof updateMemberSchema>;
  const member = await workspaceService.updateMemberRole(
    p(req.params.id!),
    userId,
    p(req.params.userId!),
    role,
  );
  res.status(200).json({ member });
});

export const removeMember = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  await workspaceService.removeMember(p(req.params.id!), userId, p(req.params.userId!));
  res.status(204).send();
});

import type { Request, Response } from "express";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import { type AuthRequest } from "../types/index.ts";
import * as notificationService from "../services/notification.service.ts";

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0]! : v);

export const listNotifications = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const q = req.query as Record<string, string>;
  const result = await notificationService.listNotifications(
    userId,
    q["cursor"],
    q["limit"] ? Number(q["limit"]) : 20,
  );
  res.status(200).json(result);
});

export const markRead = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const notification = await notificationService.markRead(p(req.params.id!), userId);
  res.status(200).json({ notification });
});

export const markAllRead = asyncWrapper(async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).user;
  const result = await notificationService.markAllRead(userId);
  res.status(200).json(result);
});

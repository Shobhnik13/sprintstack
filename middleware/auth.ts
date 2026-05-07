import type { Response, NextFunction, RequestHandler } from "express";
import { verifyToken } from "../utils/jwt.ts";
import { AppError, type AuthRequest } from "../types/index.ts";

export const authenticate: RequestHandler = (req, _res, next): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : (req.cookies as Record<string, string> | undefined)?.["token"];

  if (!token) {
    next(new AppError(401, "unauthorized"));
    return;
  }
  try {
    const payload = verifyToken(token);
    (req as AuthRequest).user = { userId: payload.userId, email: payload.email };
    next();
  } catch {
    next(new AppError(401, "invalid_token"));
  }
};

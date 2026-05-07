import type { Request, Response, NextFunction } from "express";
import { AppError } from "../types/index.ts";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal_server_error" });
}

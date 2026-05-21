import type { Request, ParamsDictionary } from "express-serve-static-core";

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user: AuthenticatedUser;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code);
    this.name = "AppError";
  }
}

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncWrapper } from "../utils/asyncWrapper.ts";
import * as authService from "../services/auth.service.ts";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = asyncWrapper(async (req: Request, res: Response) => {
  const { email, password, display_name } = req.body as z.infer<typeof registerSchema>;
  const user = await authService.register(email, password, display_name);
  res.status(201).json({ user });
});

export const login = asyncWrapper(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const { token, user } = await authService.login(email, password);
  res.cookie("token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    })
    .status(200)
    .json({ user });
});

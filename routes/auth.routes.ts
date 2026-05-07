import { Router } from "express";
import { validate } from "../middleware/validate.ts";
import * as authController from "../controllers/auth.controller.ts";
import { registerSchema, loginSchema } from "../controllers/auth.controller.ts";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);

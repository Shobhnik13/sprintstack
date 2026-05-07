import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import * as c from "../controllers/users.controller.ts";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get("/me/notifications", c.listNotifications);
usersRouter.patch("/me/notifications/:id/read", c.markRead);
usersRouter.patch("/me/notifications/read-all", c.markAllRead);

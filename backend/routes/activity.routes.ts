import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import * as c from "../controllers/activity.controller.ts";

export const activityRouter = Router();

activityRouter.use(authenticate);
activityRouter.get("/:id/activity", c.getActivityFeed);

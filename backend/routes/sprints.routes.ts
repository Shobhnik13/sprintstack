import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import * as c from "../controllers/sprints.controller.ts";

export const sprintsRouter = Router();

sprintsRouter.use(authenticate);

sprintsRouter.patch("/:id", validate(c.updateSprintSchema), c.updateSprint);
sprintsRouter.post("/:id/start", c.startSprint);
sprintsRouter.post("/:id/complete", validate(c.completeSprintSchema), c.completeSprint);
sprintsRouter.get("/:id/incomplete", c.listIncomplete);
sprintsRouter.post("/:id/issues", validate(c.addIssueSchema), c.addIssueToSprint);
sprintsRouter.delete("/:id/issues/:issueId", c.removeIssueFromSprint);

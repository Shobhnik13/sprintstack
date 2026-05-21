import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import * as c from "../controllers/projects.controller.ts";
import { createIssue, createIssueSchema } from "../controllers/issues.controller.ts";
import { createSprint, listSprints, createSprintSchema } from "../controllers/sprints.controller.ts";

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get("/:id", c.getProject);
projectsRouter.get("/:id/board", c.getBoard);
projectsRouter.get("/:id/workflow", c.getWorkflow);
projectsRouter.get("/:id/presence", c.getPresence);
projectsRouter.post("/:id/workflow/statuses", validate(c.addStatusSchema), c.addStatus);
projectsRouter.post("/:id/workflow/transitions", validate(c.addTransitionSchema), c.addTransition);
projectsRouter.post("/:id/custom-fields", c.addCustomField);
projectsRouter.post("/:id/issues", validate(createIssueSchema), createIssue);
projectsRouter.post("/:id/sprints", validate(createSprintSchema), createSprint);
projectsRouter.get("/:id/sprints", listSprints);

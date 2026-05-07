import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import * as wc from "../controllers/workspaces.controller.ts";
import * as pc from "../controllers/projects.controller.ts";

export const workspacesRouter = Router();

workspacesRouter.use(authenticate);

workspacesRouter.post("/", validate(wc.createWorkspaceSchema), wc.createWorkspace);
workspacesRouter.get("/", wc.listWorkspaces);
workspacesRouter.get("/:id", wc.getWorkspace);
workspacesRouter.post("/:id/members", validate(wc.addMemberSchema), wc.addMember);
workspacesRouter.patch("/:id/members/:userId", validate(wc.updateMemberSchema), wc.updateMemberRole);
workspacesRouter.delete("/:id/members/:userId", wc.removeMember);

// Projects nested under workspace
workspacesRouter.post("/:workspaceId/projects", validate(pc.createProjectSchema), pc.createProject);
workspacesRouter.get("/:workspaceId/projects", pc.listProjects);

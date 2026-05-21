import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import * as c from "../controllers/issues.controller.ts";

export const issuesRouter = Router();

issuesRouter.use(authenticate);

issuesRouter.get("/:id", c.getIssue);
issuesRouter.patch("/:id", validate(c.updateIssueSchema), c.updateIssue);
issuesRouter.delete("/:id", c.deleteIssue);
issuesRouter.post("/:id/transitions", validate(c.transitionSchema), c.transitionIssue);
issuesRouter.get("/:id/comments", c.listComments);
issuesRouter.post("/:id/comments", validate(c.addCommentSchema), c.addComment);
issuesRouter.patch("/:id/comments/:cid", validate(c.updateCommentSchema), c.updateComment);
issuesRouter.delete("/:id/comments/:cid", c.deleteComment);
issuesRouter.post("/:id/watch", c.watchIssue);
issuesRouter.delete("/:id/watch", c.unwatchIssue);
issuesRouter.get("/:id/watchers", c.listWatchers);

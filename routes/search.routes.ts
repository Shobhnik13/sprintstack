import { Router } from "express";
import { authenticate } from "../middleware/auth.ts";
import * as c from "../controllers/search.controller.ts";

export const searchRouter = Router();

searchRouter.use(authenticate);
searchRouter.get("/", c.search);

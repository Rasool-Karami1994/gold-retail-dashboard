import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { courseRouter } from "./course.routes.js";
import { requireRole } from "../middleware/auth.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);

apiRouter.use("/courses", requireRole("admin"), courseRouter);

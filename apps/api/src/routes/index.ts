import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { courseRouter } from "./course.routes.js";

/** Every route in the app is mounted here, under /api/v1 (see app.ts). */
export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/courses", courseRouter);

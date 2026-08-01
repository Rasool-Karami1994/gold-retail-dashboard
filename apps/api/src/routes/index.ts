import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { courseRouter } from "./course.routes.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Versioned resource API, mounted at /api/v1.
 *
 * Health stays public -- load balancers and orchestrators poll it without
 * credentials, and a 401 there reads as "the service is down".
 *
 * Everything else in this group is staff-facing, so it is gated on the admin
 * role at the mount point rather than route by route. A new resource added
 * below inherits the guard instead of having to remember it.
 */
export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);

apiRouter.use("/courses", requireRole("admin"), courseRouter);

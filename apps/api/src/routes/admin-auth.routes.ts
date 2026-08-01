import { Router } from "express";
import * as controller from "../controllers/admin-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { adminLoginLimiter } from "../middleware/rate-limit.js";
import { requireAdmin } from "../middleware/auth.js";

/** Mounted at /api/admin/auth */
export const adminAuthRouter: Router = Router();

adminAuthRouter.post(
  "/login",
  adminLoginLimiter,
  validate(controller.loginSchema),
  asyncHandler(controller.login),
);

adminAuthRouter.post("/logout", asyncHandler(controller.logout));

/** Cheap "am I still signed in?" check for the admin shell on page load. */
adminAuthRouter.get("/me", requireAdmin, (_req, res) => {
  res.json({ admin: res.locals.auth });
});

import { Router } from "express";
import * as controller from "../controllers/admin-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { adminLoginLimiter } from "../middleware/rate-limit.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/admin/auth.
 *
 * login and logout are necessarily public -- guarding the door you use to get
 * a key locks everyone out. /me is the only member here that needs a session.
 */
export const adminAuthRouter: Router = Router();

adminAuthRouter.post(
  "/login",
  adminLoginLimiter,
  validate(controller.loginSchema),
  asyncHandler(controller.login),
);

adminAuthRouter.post("/logout", asyncHandler(controller.logout));

/** Cheap "am I still signed in?" check for the admin shell on page load. */
adminAuthRouter.get("/me", requireRole("admin"), (req, res) => {
  res.json({ admin: req.user });
});

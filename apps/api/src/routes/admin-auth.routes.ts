import { Router } from "express";
import * as controller from "../controllers/admin-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { adminLoginLimiter } from "../middleware/rate-limit.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { AdminModel } from "../models/admin.model.js";
import { env } from "../config/env.js";

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

/**
 * "Am I still signed in, and who am I?" -- called by the admin shell on load.
 *
 * Reads the record rather than echoing the token payload. The token carries
 * only `{ id, role }`, which is not enough to render a name, and echoing it
 * would also keep answering 200 for an admin whose account was deleted while
 * their week-long token was still valid.
 */
adminAuthRouter.get(
  "/me",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const admin = await AdminModel.findById(req.user?.id);
    if (!admin) throw new HttpError(401, "Authentication required");

    /**
     * `smsMock` rides along so the shell can warn that no real SMS is going
     * out. It is on this response rather than its own endpoint because the
     * shell already calls /me on load -- a banner is not worth a second request
     * on every page -- and admin-only because it describes how the deployment
     * is configured, which is nobody else's business.
     */
    /**
     * `insecureOtp` separates the two very different reasons SMS can be mocked.
     * On a developer's machine it is routine and a red banner every day is
     * noise that gets tuned out. In production it means one-time codes are
     * coming back in API responses and the customer login is effectively open,
     * which is worth shouting about. The severity is decided here because the
     * browser has no way to know which environment the API is running in.
     */
    res.json({
      admin,
      smsMock: env.smsIsMock,
      insecureOtp: env.smsIsMock && env.isProduction,
    });
  }),
);

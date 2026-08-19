import { Router } from "express";
import * as controller from "../controllers/admin-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { adminLoginLimiter } from "../middleware/rate-limit.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { AdminModel } from "../models/admin.model.js";
import { env } from "../config/env.js";

export const adminAuthRouter: Router = Router();

adminAuthRouter.post(
  "/login",
  adminLoginLimiter,
  validate(controller.loginSchema),
  asyncHandler(controller.login),
);

adminAuthRouter.post("/logout", asyncHandler(controller.logout));

adminAuthRouter.get(
  "/me",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const admin = await AdminModel.findById(req.user?.id);
    if (!admin) throw new HttpError(401, "Authentication required");

    res.json({
      admin,
      smsMock: env.smsIsMock,
      insecureOtp: env.smsIsMock && env.isProduction,
    });
  }),
);

import { Router } from "express";
import * as controller from "../controllers/customer-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { otpRequestLimiter } from "../middleware/rate-limit.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/customer/auth.
 *
 * The OTP endpoints cannot use `requireRole` at the route level: whether a
 * session is needed depends on `purpose`, which is only known once the body is
 * parsed ('register' is admin-only, 'login' is public). `authenticate` runs
 * app-wide and has already populated req.sessions, so the controller checks
 * `hasRole(req, "admin")` after validation.
 *
 * The rate limiter sits before validation so malformed floods are throttled
 * too; it reads req.body.mobile, which express.json() has already populated.
 */
export const customerAuthRouter: Router = Router();

customerAuthRouter.post(
  "/request-otp",
  otpRequestLimiter,
  validate(controller.requestOtpSchema),
  asyncHandler(controller.requestOtpHandler),
);

customerAuthRouter.post(
  "/verify-otp",
  validate(controller.verifyOtpSchema),
  asyncHandler(controller.verifyOtpHandler),
);

customerAuthRouter.post("/logout", asyncHandler(controller.logoutHandler));

customerAuthRouter.get("/me", requireRole("customer"), (req, res) => {
  res.json({ customer: req.user });
});

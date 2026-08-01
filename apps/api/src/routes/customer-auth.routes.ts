import { Router } from "express";
import * as controller from "../controllers/customer-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { otpRequestLimiter } from "../middleware/rate-limit.js";
import { attachAuthIfPresent, requireCustomer } from "../middleware/auth.js";

/** Mounted at /api/customer/auth */
export const customerAuthRouter: Router = Router();

/**
 * Middleware order matters here.
 *
 * `attachAuthIfPresent("admin")` runs first but does not reject -- whether an
 * admin session is *required* depends on `purpose`, which the controller checks
 * once the body is parsed ('register' is admin-only, 'login' is public).
 *
 * The rate limiter sits before validation so malformed floods are throttled
 * too, and it reads `req.body.mobile` directly -- express.json() has already
 * populated it by this point.
 */
customerAuthRouter.post(
  "/request-otp",
  attachAuthIfPresent("admin"),
  otpRequestLimiter,
  validate(controller.requestOtpSchema),
  asyncHandler(controller.requestOtpHandler),
);

customerAuthRouter.post(
  "/verify-otp",
  attachAuthIfPresent("admin"),
  validate(controller.verifyOtpSchema),
  asyncHandler(controller.verifyOtpHandler),
);

customerAuthRouter.post("/logout", asyncHandler(controller.logoutHandler));

customerAuthRouter.get("/me", requireCustomer, (_req, res) => {
  res.json({ customer: res.locals.auth });
});

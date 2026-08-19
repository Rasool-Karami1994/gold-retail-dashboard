import { Router } from "express";
import * as controller from "../controllers/customer-auth.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { otpRequestLimiter } from "../middleware/rate-limit.js";
import { requireRole } from "../middleware/auth.js";

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

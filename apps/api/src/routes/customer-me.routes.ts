import { Router } from "express";
import * as controller from "../controllers/customer-me.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

export const customerMeRouter: Router = Router();

customerMeRouter.use(requireRole("customer"));

customerMeRouter.get("/", asyncHandler(controller.getMe));

customerMeRouter.patch(
  "/",
  validate(controller.updateMeSchema),
  asyncHandler(controller.updateMe),
);

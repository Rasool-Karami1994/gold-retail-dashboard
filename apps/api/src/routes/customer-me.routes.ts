import { Router } from "express";
import * as controller from "../controllers/customer-me.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/customer/me -- the signed-in customer's own record.
 *
 * Customer-only, not admin-or-customer: an admin holds no customer session, so
 * "me" would have no meaning for them. Staff edit customers through
 * /api/admin/customers/:id instead.
 */
export const customerMeRouter: Router = Router();

customerMeRouter.use(requireRole("customer"));

customerMeRouter.get("/", asyncHandler(controller.getMe));

customerMeRouter.patch(
  "/",
  validate(controller.updateMeSchema),
  asyncHandler(controller.updateMe),
);

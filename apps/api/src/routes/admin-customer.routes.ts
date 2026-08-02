import { Router } from "express";
import * as controller from "../controllers/admin-customer.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/admin/customers.
 *
 * The whole group is admin-only, guarded at the mount point below so a route
 * added later inherits it rather than having to remember.
 */
export const adminCustomerRouter: Router = Router();

adminCustomerRouter.use(requireRole("admin"));

adminCustomerRouter.get(
  "/",
  validate(controller.listQuerySchema, "query"),
  asyncHandler(controller.list),
);

adminCustomerRouter.get(
  "/:id",
  // Paginates the customer's transaction history, not the customer.
  validate(controller.detailQuerySchema, "query"),
  asyncHandler(controller.getOne),
);

adminCustomerRouter.post(
  "/",
  validate(controller.createCustomerSchema),
  asyncHandler(controller.create),
);

adminCustomerRouter.patch(
  "/:id",
  validate(controller.updateCustomerSchema),
  asyncHandler(controller.update),
);

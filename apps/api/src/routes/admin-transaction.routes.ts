import { Router } from "express";
import * as controller from "../controllers/admin-transaction.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/admin/transactions. Admin-only, guarded at the mount point
 * so a route added later inherits it.
 */
export const adminTransactionRouter: Router = Router();

adminTransactionRouter.use(requireRole("admin"));

adminTransactionRouter.get(
  "/",
  validate(controller.listQuerySchema, "query"),
  asyncHandler(controller.list),
);

adminTransactionRouter.get("/:id", asyncHandler(controller.getOne));

adminTransactionRouter.post(
  "/",
  validate(controller.createTransactionSchema),
  asyncHandler(controller.create),
);

adminTransactionRouter.post(
  "/:id/payments",
  validate(controller.addPaymentSchema),
  asyncHandler(controller.createPayment),
);

import { Router } from "express";
import * as controller from "../controllers/customer-transaction.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/customer/transactions -- read-only.
 *
 * There is deliberately no create or payment route here: a customer cannot
 * ring up their own sale or declare themselves paid. Those live on the admin
 * side only.
 */
export const customerTransactionRouter: Router = Router();

customerTransactionRouter.use(requireRole("customer"));

customerTransactionRouter.get(
  "/",
  validate(controller.listQuerySchema, "query"),
  asyncHandler(controller.list),
);

customerTransactionRouter.get("/:id", asyncHandler(controller.getOne));

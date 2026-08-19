import { Router } from "express";
import * as controller from "../controllers/admin-customer.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

export const adminCustomerRouter: Router = Router();

adminCustomerRouter.use(requireRole("admin"));

adminCustomerRouter.get(
  "/",
  validate(controller.listQuerySchema, "query"),
  asyncHandler(controller.list),
);

adminCustomerRouter.get(
  "/:id",
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

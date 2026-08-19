import { Router } from "express";
import * as controller from "../controllers/admin-capital.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

export const adminShopSettingsRouter: Router = Router();

adminShopSettingsRouter.use(requireRole("admin"));

adminShopSettingsRouter.get("/", asyncHandler(controller.getShopSettings));

adminShopSettingsRouter.patch(
  "/",
  validate(controller.updateShopSettingsSchema),
  asyncHandler(controller.updateShopSettings),
);

export const adminGoldPriceRouter: Router = Router();

adminGoldPriceRouter.use(requireRole("admin"));

adminGoldPriceRouter.get("/", asyncHandler(controller.getGoldPrice));

adminGoldPriceRouter.post(
  "/",
  validate(controller.recordGoldPriceSchema),
  asyncHandler(controller.recordGoldPrice),
);

export const adminCapitalRouter: Router = Router();

adminCapitalRouter.use(requireRole("admin"));

adminCapitalRouter.get(
  "/",
  validate(controller.capitalQuerySchema, "query"),
  asyncHandler(controller.capital),
);

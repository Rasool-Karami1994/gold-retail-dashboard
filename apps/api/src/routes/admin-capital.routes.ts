import { Router } from "express";
import * as controller from "../controllers/admin-capital.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Capital measured in grams of gold. Three related resources, three routers,
 * each admin-only and guarded at its own mount point.
 *
 * They live in one file because they are one feature: the opening position and
 * the daily price exist to make the capital series computable, and splitting
 * them across three files would hide that.
 */

/** Mounted at /api/admin/shop-settings -- the singleton opening position. */
export const adminShopSettingsRouter: Router = Router();

adminShopSettingsRouter.use(requireRole("admin"));

adminShopSettingsRouter.get("/", asyncHandler(controller.getShopSettings));

// PATCH, not PUT or POST: there is one document at a known address, and the
// first write creates it. See the controller.
adminShopSettingsRouter.patch(
  "/",
  validate(controller.updateShopSettingsSchema),
  asyncHandler(controller.updateShopSettings),
);

/** Mounted at /api/admin/gold-prices -- the shop's daily mark. */
export const adminGoldPriceRouter: Router = Router();

adminGoldPriceRouter.use(requireRole("admin"));

adminGoldPriceRouter.get("/", asyncHandler(controller.getGoldPrice));

// POST rather than PUT even though it upserts: the client names a price, not a
// day, and the day it lands on is the server's decision.
adminGoldPriceRouter.post(
  "/",
  validate(controller.recordGoldPriceSchema),
  asyncHandler(controller.recordGoldPrice),
);

/** Mounted at /api/admin/capital -- read-only, recomputed on every request. */
export const adminCapitalRouter: Router = Router();

adminCapitalRouter.use(requireRole("admin"));

adminCapitalRouter.get(
  "/",
  validate(controller.capitalQuerySchema, "query"),
  asyncHandler(controller.capital),
);

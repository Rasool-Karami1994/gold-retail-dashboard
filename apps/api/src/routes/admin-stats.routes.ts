import { Router } from "express";
import * as controller from "../controllers/admin-stats.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Mounted at /api/admin/stats. Admin-only, guarded at the mount point.
 *
 * All read-only. The two debt-credit routes take no range: they are running
 * totals as of now, not flow through a period -- see stats.service.ts.
 */
export const adminStatsRouter: Router = Router();

adminStatsRouter.use(requireRole("admin"));

adminStatsRouter.get(
  "/volume",
  validate(controller.rangeQuerySchema, "query"),
  asyncHandler(controller.volume),
);

adminStatsRouter.get(
  "/amount",
  validate(controller.rangeQuerySchema, "query"),
  asyncHandler(controller.amount),
);

adminStatsRouter.get(
  "/debt-credit-amount",
  asyncHandler(controller.debtCreditAmount),
);

adminStatsRouter.get(
  "/debt-credit-grams",
  asyncHandler(controller.debtCreditGrams),
);

adminStatsRouter.get(
  "/open-transactions",
  validate(controller.openTransactionsQuerySchema, "query"),
  asyncHandler(controller.openTransactions),
);

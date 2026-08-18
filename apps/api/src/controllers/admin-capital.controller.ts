import type { Request, Response } from "express";
import { z } from "zod";
import * as capitalService from "../services/capital.service.js";
import { validated } from "../middleware/validate.js";
import { HttpError } from "../middleware/error-handler.js";

/**
 * Capital measured in grams of gold: the shop's opening position, its daily
 * gold price, and the series computed from both.
 *
 * Three resources, one controller, because none of them means anything without
 * the others -- the price exists to value the capital, and the capital cannot
 * be computed without the opening position.
 *
 * Range params are `from`/`to` here, matching /api/admin/stats rather than
 * /api/admin/transactions' `dateFrom`/`dateTo`. This is a statistics endpoint,
 * so it follows the statistics convention.
 */

/* -------------------------------------------------------------------------- */
/* Shop settings                                                              */
/* -------------------------------------------------------------------------- */

const grams = z.coerce
  .number()
  .nonnegative("Opening gold cannot be negative")
  .finite();

const toman = z.coerce
  .number()
  .nonnegative("Opening cash cannot be negative")
  .finite();

/**
 * Every field optional, and `.strict()` so a typo is a 400 rather than a silent
 * no-op. The service is what enforces "all three on the first write" -- it is
 * the only layer that knows whether the shop has been configured before.
 */
export const updateShopSettingsSchema = z
  .object({
    openingGoldGrams: grams.optional(),
    openingCashToman: toman.optional(),
    openingDate: z.coerce.date().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update",
  });

/** GET /api/admin/shop-settings */
export async function getShopSettings(_req: Request, res: Response) {
  res.json(await capitalService.getShopSettings());
}

/**
 * PATCH /api/admin/shop-settings
 *
 * Also the create: there is exactly one settings document, so there is no
 * collection to POST into and no id to create at.
 */
export async function updateShopSettings(_req: Request, res: Response) {
  const body = validated(res, updateShopSettingsSchema);
  res.json(await capitalService.updateShopSettings(body));
}

/* -------------------------------------------------------------------------- */
/* Daily gold price                                                           */
/* -------------------------------------------------------------------------- */

export const recordGoldPriceSchema = z
  .object({
    pricePerGram: z.coerce
      .number()
      .positive("Price per gram must be greater than zero")
      .finite(),
    /**
     * Defaults to today. Accepted so a price missed yesterday can still be
     * filled in -- the upsert is keyed on the day, so doing that corrects the
     * record rather than adding a second one.
     */
    date: z.coerce.date().optional(),
  })
  .strict();

/** GET /api/admin/gold-prices -- today's price and the most recent one. */
export async function getGoldPrice(_req: Request, res: Response) {
  res.json(await capitalService.getPriceContext());
}

/** POST /api/admin/gold-prices -- record or correct a day's price. */
export async function recordGoldPrice(req: Request, res: Response) {
  const body = validated(res, recordGoldPriceSchema);

  const recordedBy = req.user?.id;
  // requireRole("admin") guarantees this; the check keeps the type honest and
  // turns a middleware ordering mistake into a clear error rather than a cast.
  if (!recordedBy) throw new HttpError(401, "Authentication required");

  res.status(201).json(
    await capitalService.recordGoldPrice({ ...body, recordedBy }),
  );
}

/* -------------------------------------------------------------------------- */
/* The series                                                                 */
/* -------------------------------------------------------------------------- */

export const capitalQuerySchema = z
  .object({
    /**
     * Both optional: with neither, the service reports the shop's whole history
     * -- opening date to now -- which is the only range that needs no arguing
     * about. The UI always sends a pair from its date filter.
     */
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    /**
     * How finely to slice the range. The service may coarsen it when the range
     * is long enough to overflow the point cap, and reports back the one it
     * actually used.
     */
    granularity: z.enum(["day", "week", "month"]).default("day"),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["from"],
    message: "from must be on or before to",
  });

/** GET /api/admin/capital */
export async function capital(_req: Request, res: Response) {
  const query = validated(res, capitalQuerySchema);
  res.json(await capitalService.getCapitalSeries(query));
}

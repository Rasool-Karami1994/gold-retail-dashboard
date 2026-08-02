import type { Request, Response } from "express";
import { z } from "zod";
import * as statsService from "../services/stats.service.js";
import { validated } from "../middleware/validate.js";
import { TRANSACTION_TYPES } from "../models/transaction.model.js";

/**
 * Dashboard statistics.
 *
 * The frontend resolves its today/week/month/year/custom picker into explicit
 * dates and sends them as `from`/`to`; nothing here knows about presets.
 *
 * NOTE: these are `from`/`to`, while GET /api/admin/transactions takes
 * `dateFrom`/`dateTo`. Both were specified that way. Worth unifying if the
 * inconsistency starts costing more than the rename would.
 */

const rangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["from"],
    message: "from must be on or before to",
  });

export const rangeQuerySchema = rangeSchema;

export const openTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    type: z.enum(TRANSACTION_TYPES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["from"],
    message: "from must be on or before to",
  });

/** GET /api/admin/stats/volume */
export async function volume(_req: Request, res: Response) {
  res.json(await statsService.getVolume(validated(res, rangeSchema)));
}

/** GET /api/admin/stats/amount */
export async function amount(_req: Request, res: Response) {
  res.json(await statsService.getAmount(validated(res, rangeSchema)));
}

/**
 * GET /api/admin/stats/debt-credit-amount
 *
 * A running total as of now, so it takes no range. The schema still runs on
 * the query string, which means a caller who sends `?from=` gets a clear
 * no-op rather than silently filtered numbers.
 */
export async function debtCreditAmount(_req: Request, res: Response) {
  res.json(await statsService.getDebtCreditAmount());
}

/** GET /api/admin/stats/debt-credit-grams -- also a running total. */
export async function debtCreditGrams(_req: Request, res: Response) {
  res.json(await statsService.getDebtCreditGrams());
}

/** GET /api/admin/stats/open-transactions */
export async function openTransactions(_req: Request, res: Response) {
  const query = validated(res, openTransactionsQuerySchema);
  res.json(await statsService.listOpenTransactions(query));
}

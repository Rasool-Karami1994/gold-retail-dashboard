import type { Request, Response } from "express";
import { z } from "zod";
import * as transactionService from "../services/transaction.service.js";
import { validated } from "../middleware/validate.js";
import { HttpError } from "../middleware/error-handler.js";

/**
 * The signed-in customer's own transactions.
 *
 * Scope always comes from `req.user`, never from the request, so there is no
 * customer id for a caller to substitute. The filters below narrow within that
 * scope and cannot widen it.
 */

export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    /** Bounds on the gross deal value, `totalAmount`. */
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().nonnegative().optional(),
  })
  .refine(
    (query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
    { path: ["dateFrom"], message: "dateFrom must be on or before dateTo" },
  )
  .refine(
    (query) =>
      query.minAmount === undefined ||
      query.maxAmount === undefined ||
      query.minAmount <= query.maxAmount,
    { path: ["minAmount"], message: "minAmount must not exceed maxAmount" },
  );

function currentCustomerId(req: Request): string {
  const id = req.user?.id;
  // requireRole("customer") guarantees this; the check keeps the type honest
  // and turns a middleware ordering mistake into a clear error.
  if (!id) throw new HttpError(401, "Authentication required");
  return id;
}

/** GET /api/customer/transactions */
export async function list(req: Request, res: Response) {
  const query = validated(res, listQuerySchema);
  res.json(
    await transactionService.listTransactionsForCustomer(
      currentCustomerId(req),
      query,
    ),
  );
}

/** GET /api/customer/transactions/:id */
export async function getOne(req: Request, res: Response) {
  res.json(
    await transactionService.getCustomerTransaction(
      currentCustomerId(req),
      req.params.id as string,
    ),
  );
}

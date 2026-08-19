import type { Request, Response } from "express";
import { z } from "zod";
import * as statsService from "../services/stats.service.js";
import { validated } from "../middleware/validate.js";
import { TRANSACTION_TYPES } from "../models/transaction.model.js";

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

export async function volume(_req: Request, res: Response) {
  res.json(await statsService.getVolume(validated(res, rangeSchema)));
}

export async function amount(_req: Request, res: Response) {
  res.json(await statsService.getAmount(validated(res, rangeSchema)));
}

export async function debtCreditAmount(_req: Request, res: Response) {
  res.json(await statsService.getDebtCreditAmount());
}

export async function debtCreditGrams(_req: Request, res: Response) {
  res.json(await statsService.getDebtCreditGrams());
}

export async function openTransactions(_req: Request, res: Response) {
  const query = validated(res, openTransactionsQuerySchema);
  res.json(await statsService.listOpenTransactions(query));
}

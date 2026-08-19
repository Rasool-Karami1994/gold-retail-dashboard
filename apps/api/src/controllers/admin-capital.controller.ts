import type { Request, Response } from "express";
import { z } from "zod";
import * as capitalService from "../services/capital.service.js";
import { validated } from "../middleware/validate.js";
import { HttpError } from "../middleware/error-handler.js";

const grams = z.coerce
  .number()
  .nonnegative("Opening gold cannot be negative")
  .finite();

const toman = z.coerce
  .number()
  .nonnegative("Opening cash cannot be negative")
  .finite();

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

export async function getShopSettings(_req: Request, res: Response) {
  res.json(await capitalService.getShopSettings());
}

export async function updateShopSettings(_req: Request, res: Response) {
  const body = validated(res, updateShopSettingsSchema);
  res.json(await capitalService.updateShopSettings(body));
}

export const recordGoldPriceSchema = z
  .object({
    pricePerGram: z.coerce
      .number()
      .positive("Price per gram must be greater than zero")
      .finite(),
    date: z.coerce.date().optional(),
  })
  .strict();

export async function getGoldPrice(_req: Request, res: Response) {
  res.json(await capitalService.getPriceContext());
}

export async function recordGoldPrice(req: Request, res: Response) {
  const body = validated(res, recordGoldPriceSchema);

  const recordedBy = req.user?.id;
  if (!recordedBy) throw new HttpError(401, "Authentication required");

  res.status(201).json(
    await capitalService.recordGoldPrice({ ...body, recordedBy }),
  );
}

export const capitalQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    granularity: z.enum(["day", "week", "month"]).default("day"),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["from"],
    message: "from must be on or before to",
  });

export async function capital(_req: Request, res: Response) {
  const query = validated(res, capitalQuerySchema);
  res.json(await capitalService.getCapitalSeries(query));
}

import type { Request, Response } from "express";
import { z } from "zod";
import * as customerService from "../services/customer.service.js";
import { validated } from "../middleware/validate.js";
import { HttpError } from "../middleware/error-handler.js";

const nameField = z.string().trim().min(1).max(60);

export const updateMeSchema = z
  .object({
    firstName: nameField.optional(),
    lastName: nameField.optional(),
  })
  .strict("Only firstName and lastName can be changed; mobile is immutable")
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one of firstName or lastName",
  });

function currentCustomerId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new HttpError(401, "Authentication required");
  return id;
}

export async function getMe(req: Request, res: Response) {
  res.json(await customerService.getCustomerById(currentCustomerId(req)));
}

export async function updateMe(req: Request, res: Response) {
  const body = validated(res, updateMeSchema);
  res.json(
    await customerService.updateCustomerName(currentCustomerId(req), body),
  );
}

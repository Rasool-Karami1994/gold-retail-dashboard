import type { Request, Response } from "express";
import { z } from "zod";
import * as customerService from "../services/customer.service.js";
import { validated } from "../middleware/validate.js";
import { HttpError } from "../middleware/error-handler.js";

/**
 * The signed-in customer's own profile.
 *
 * The id always comes from `req.user`, never from the URL or the body, so
 * there is no id for a caller to tamper with -- a customer can only ever read
 * or write their own record.
 */

const nameField = z.string().trim().min(1).max(60);

/** Same shape as the admin edit: names only, mobile immutable. */
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
  // requireRole("customer") guarantees this; the check keeps the type honest
  // and turns a middleware ordering mistake into a clear error.
  if (!id) throw new HttpError(401, "Authentication required");
  return id;
}

/** GET /api/customer/me */
export async function getMe(req: Request, res: Response) {
  res.json(await customerService.getCustomerById(currentCustomerId(req)));
}

/** PATCH /api/customer/me */
export async function updateMe(req: Request, res: Response) {
  const body = validated(res, updateMeSchema);
  res.json(
    await customerService.updateCustomerName(currentCustomerId(req), body),
  );
}

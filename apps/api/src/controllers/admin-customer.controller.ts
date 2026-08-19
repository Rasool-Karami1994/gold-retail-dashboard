import type { Request, Response } from "express";
import { z } from "zod";
import * as customerService from "../services/customer.service.js";
import { validated } from "../middleware/validate.js";
import { MOBILE_PATTERN, normalizeMobile } from "../lib/mobile.js";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const detailQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const nameField = z.string().trim().min(1).max(60);

export const createCustomerSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  mobile: z
    .string()
    .transform(normalizeMobile)
    .refine((value) => MOBILE_PATTERN.test(value), {
      message: "Mobile must be a valid Iranian number (09XXXXXXXXX)",
    }),
});

export const updateCustomerSchema = z
  .object({
    firstName: nameField.optional(),
    lastName: nameField.optional(),
  })
  .strict("Only firstName and lastName can be changed; mobile is immutable")
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one of firstName or lastName",
  });

export async function list(_req: Request, res: Response) {
  const query = validated(res, listQuerySchema);
  res.json(await customerService.listCustomers(query));
}

export async function getOne(req: Request, res: Response) {
  const query = validated(res, detailQuerySchema);
  res.json(
    await customerService.getCustomerDetail(req.params.id as string, query),
  );
}

export async function create(_req: Request, res: Response) {
  const body = validated(res, createCustomerSchema);
  const customer = await customerService.createCustomer(body);
  res.status(201).json(customer);
}

export async function update(req: Request, res: Response) {
  const body = validated(res, updateCustomerSchema);
  res.json(
    await customerService.updateCustomerName(req.params.id as string, body),
  );
}

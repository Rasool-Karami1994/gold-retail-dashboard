import type { Request, Response } from "express";
import { z } from "zod";
import * as transactionService from "../services/transaction.service.js";
import {
  buildInvoiceSmsText,
  generateInvoicePdf,
  generateInvoicePdfInBackground,
} from "../services/invoice.js";
import { env } from "../config/env.js";
import { validated } from "../middleware/validate.js";
import { HttpError } from "../middleware/error-handler.js";
import {
  BANK_TYPES,
  GOLD_TYPES,
  PAYMENT_METHODS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from "../models/transaction.model.js";

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a 24-character object id");

const paymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    amount: z.number().nonnegative("Amount cannot be negative"),
    bankType: z.enum(BANK_TYPES).optional(),
    destinationCard: z
      .string()
      .trim()
      .regex(/^\d{16}$/, "Destination card must be 16 digits")
      .optional(),
    destinationIban: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^IR\d{24}$/, "Destination IBAN must be IR followed by 24 digits")
      .optional(),
    paidAt: z.coerce.date().optional(),
  })
  .superRefine((payment, ctx) => {
    if (payment.method === "bank" && !payment.bankType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankType"],
        message: "bankType is required for bank payments",
      });
    }
    if (payment.method === "cash" && payment.bankType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankType"],
        message: "bankType is not allowed on a cash payment",
      });
    }
    if (payment.method === "cash" && payment.destinationCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationCard"],
        message: "destinationCard is not allowed on a cash payment",
      });
    }
    if (payment.method === "cash" && payment.destinationIban) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationIban"],
        message: "destinationIban is not allowed on a cash payment",
      });
    }

    if (payment.bankType === "card-to-card" && payment.destinationIban) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationIban"],
        message: "card-to-card records a destinationCard, not an IBAN",
      });
    }
    if (payment.bankType && payment.bankType !== "card-to-card" && payment.destinationCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationCard"],
        message: `${payment.bankType} settles to an IBAN, so it records a destinationIban, not a card`,
      });
    }
  });

export const createTransactionSchema = z.object({
  customer: objectId,
  type: z.enum(TRANSACTION_TYPES),
  goldType: z.enum(GOLD_TYPES),
  goldWeightGrams: z.number().positive("Weight must be greater than zero"),
  dailyGoldPricePerGram: z
    .number()
    .nonnegative("Price per gram cannot be negative"),
  profitPercentage: z
    .number()
    .min(0, "Profit percentage cannot be negative")
    .max(100, "Profit percentage cannot exceed 100")
    .default(0),
  payments: z.array(paymentSchema).default([]),
  invoicePdfUrl: z.string().trim().url().nullish(),
});

export const addPaymentSchema = paymentSchema;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customerName: z.string().trim().min(1).optional(),
  customerMobile: z.string().trim().min(1).optional(),
  invoiceNumber: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
}).refine(
  (query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
  { path: ["dateFrom"], message: "dateFrom must be on or before dateTo" },
);

export async function create(req: Request, res: Response) {
  const body = validated(res, createTransactionSchema);

  const adminId = req.user?.id;
  if (!adminId) throw new HttpError(401, "Authentication required");

  const transaction = await transactionService.createTransaction(body, adminId);

  generateInvoicePdfInBackground(transaction.id as string);

  res.status(201).json(transaction);
}

export async function regenerateInvoice(req: Request, res: Response) {
  const notify = req.query.notify === "true";

  const result = await generateInvoicePdf(req.params.id as string, { notify });
  res.status(201).json(result);
}

export async function list(_req: Request, res: Response) {
  const query = validated(res, listQuerySchema);
  res.json(await transactionService.listTransactionsForAdmin(query));
}

export async function getOne(req: Request, res: Response) {
  const transaction = await transactionService.getTransactionDetail(
    req.params.id as string,
  );

  const devInvoiceMessage =
    env.smsIsMock && transaction.invoicePdfUrl
      ? buildInvoiceSmsText(
          transaction.invoiceNumber,
          transaction.totalAmount,
          transaction.invoicePdfUrl,
        )
      : undefined;

  res.json({
    ...transaction.toJSON(),
    ...(devInvoiceMessage ? { devInvoiceMessage } : {}),
  });
}

export async function createPayment(req: Request, res: Response) {
  const body = validated(res, addPaymentSchema);
  const transaction = await transactionService.addPayment(
    req.params.id as string,
    body,
  );
  res.status(201).json(transaction);
}

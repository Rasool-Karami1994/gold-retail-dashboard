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

/* ---- Shared field schemas ------------------------------------------------ */

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a 24-character object id");

/**
 * One instalment.
 *
 * `bankType` is required for bank payments and forbidden on cash ones. The
 * schema rejects the mismatch outright rather than leaning on the model's
 * silent strip, so a client sending card details on a cash row learns it was
 * wrong instead of watching the fields vanish.
 */
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
  });

/* ---- Schemas ------------------------------------------------------------- */

/**
 * `totalAmount`, `invoiceNumber` and `status` are absent on purpose -- all
 * three are derived by the model. Accepting them would let a client write a
 * total that disagrees with weight x price.
 */
export const createTransactionSchema = z.object({
  customer: objectId,
  type: z.enum(TRANSACTION_TYPES),
  goldType: z.enum(GOLD_TYPES),
  goldWeightGrams: z.number().positive("Weight must be greater than zero"),
  dailyGoldPricePerGram: z
    .number()
    .nonnegative("Price per gram cannot be negative"),
  // Absent and [] both mean "nothing paid yet".
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

/* ---- Handlers ------------------------------------------------------------ */

/** POST /api/admin/transactions */
export async function create(req: Request, res: Response) {
  const body = validated(res, createTransactionSchema);

  const adminId = req.user?.id;
  if (!adminId) throw new HttpError(401, "Authentication required");

  const transaction = await transactionService.createTransaction(body, adminId);

  // Started, not awaited. Chrome takes a second or more, and the sale is
  // already recorded -- making the cashier wait on a PDF, or failing the
  // create because rendering broke, would both be wrong. `invoicePdfUrl` is
  // null in this response and populated on the next read; use the regenerate
  // endpoint below if it never appears.
  generateInvoicePdfInBackground(transaction.id as string);

  res.status(201).json(transaction);
}

/**
 * POST /api/admin/transactions/:id/invoice
 *
 * Renders the PDF synchronously and returns its URL. Two uses: retrying a
 * background generation that failed, and re-rendering after payments were
 * added so the printed invoice matches the current balance.
 */
export async function regenerateInvoice(req: Request, res: Response) {
  // Opt-in, so re-rendering after a payment does not text the customer again.
  // Pass ?notify=true to resend the link, e.g. when the first send failed.
  const notify = req.query.notify === "true";

  const result = await generateInvoicePdf(req.params.id as string, { notify });
  res.status(201).json(result);
}

/** GET /api/admin/transactions */
export async function list(_req: Request, res: Response) {
  const query = validated(res, listQuerySchema);
  res.json(await transactionService.listTransactionsForAdmin(query));
}

/** GET /api/admin/transactions/:id */
export async function getOne(req: Request, res: Response) {
  const transaction = await transactionService.getTransactionDetail(
    req.params.id as string,
  );

  /**
   * The invoice SMS, for the admin to pass on by hand.
   *
   * It rides on this endpoint rather than on create because the PDF is rendered
   * in the BACKGROUND -- at create time there is no URL yet, so there would be
   * no link to hand over. The new-transaction screen already polls this route
   * waiting for `invoicePdfUrl`, so the message arrives exactly when the thing
   * it links to does.
   *
   * Omitted entirely under a real gateway: there the customer got the text, and
   * echoing it back would be noise at best.
   */
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

/** POST /api/admin/transactions/:id/payments */
export async function createPayment(req: Request, res: Response) {
  const body = validated(res, addPaymentSchema);
  const transaction = await transactionService.addPayment(
    req.params.id as string,
    body,
  );
  res.status(201).json(transaction);
}

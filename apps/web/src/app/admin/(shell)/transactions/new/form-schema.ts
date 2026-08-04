import { z } from "zod";
import { toLatinDigits } from "@/lib/mobile";
import { toNumber } from "@/lib/numbers";

/** Re-exported so this form's own modules keep one import path. */
export { toNumber };

/**
 * Validation for the new-transaction form.
 *
 * Split out of the component because the payment rows validate against the same
 * rules the submit does, and a second copy of "when is a bank payment complete"
 * is a second thing to get wrong.
 *
 * Everything numeric arrives from an <input> as a string, so each number goes
 * through `numeric()` first. That also accepts Persian digits and thousands
 * separators, which matter here: the cashier's keyboard produces ۴۲۰۰۰۰۰ and
 * people paste "4,200,000".
 */

function numeric(inner: z.ZodNumber) {
  return z.preprocess(toNumber, inner);
}

/**
 * A select that must be answered.
 *
 * An untouched <select> holds "", which is not a member of the enum. Mapping it
 * to undefined first turns "Invalid enum value" into the required message --
 * and, because `preprocess` accepts unknown input, lets the resolver's input
 * type match the string-shaped values react-hook-form actually holds.
 */
function requiredEnum<T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(values, { errorMap: () => ({ message }) }),
  );
}

/** 16 digits, however they were typed or pasted. */
export function normalizeCard(value: string): string {
  return toLatinDigits(value).replace(/[\s-]/g, "");
}

export const PAYMENT_METHODS = ["cash", "bank"] as const;
export const BANK_TYPES = ["paya", "card-to-card", "bridge"] as const;
export const TRANSACTION_TYPES = ["sell", "buy"] as const;
export const GOLD_TYPES = ["melted", "new", "second-hand"] as const;

export const paymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    amount: numeric(
      z
        .number({ invalid_type_error: "مبلغ را وارد کنید" })
        .positive("مبلغ باید بیشتر از صفر باشد"),
    ),
    // "" is what an untouched select holds; the refinement below decides
    // whether that is allowed for this row's method.
    bankType: z.union([z.enum(BANK_TYPES), z.literal("")]).optional(),
    destinationCard: z.string().trim().optional(),
  })
  .superRefine((payment, ctx) => {
    if (payment.method !== "bank") return;

    if (!payment.bankType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankType"],
        message: "نوع تراکنش بانکی را انتخاب کنید",
      });
      return;
    }

    const card = payment.destinationCard
      ? normalizeCard(payment.destinationCard)
      : "";

    /**
     * Required for card-to-card, optional for the other two.
     *
     * Paya and bridge transfers settle to an account by IBAN -- there is no
     * card in the transaction to record, so demanding one would block a
     * perfectly ordinary payment. A card-to-card transfer by definition has a
     * destination card, and it is the only trace of where the money went.
     */
    if (payment.bankType === "card-to-card" && !card) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationCard"],
        message: "شماره کارت مقصد را وارد کنید",
      });
      return;
    }

    if (card && !/^\d{16}$/.test(card)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationCard"],
        message: "شماره کارت باید ۱۶ رقم باشد",
      });
    }
  });

export const transactionSchema = z.object({
  type: requiredEnum(TRANSACTION_TYPES, "نوع معامله را انتخاب کنید"),
  goldType: requiredEnum(GOLD_TYPES, "نوع طلا را انتخاب کنید"),
  goldWeightGrams: numeric(
    z
      .number({ invalid_type_error: "وزن را وارد کنید" })
      .positive("وزن باید بیشتر از صفر باشد"),
  ),
  dailyGoldPricePerGram: numeric(
    z
      .number({ invalid_type_error: "قیمت روز طلا را وارد کنید" })
      .nonnegative("قیمت نمی‌تواند منفی باشد"),
  ),
  payments: z.array(paymentSchema),
});

/** What the schema produces once parsed -- numbers and narrowed unions. */
export type TransactionOutput = z.output<typeof transactionSchema>;

/**
 * What the FIELDS hold, which is not the same thing: selects start empty and
 * every number is a string until the resolver converts it.
 *
 * DERIVED from the schema rather than hand-written. react-hook-form types its
 * resolver as `Resolver<TFieldValues, _, TTransformedValues>`, so the field
 * type has to BE the schema's input type -- a parallel interface that merely
 * looks compatible does not typecheck, and papering over that with a cast is
 * how a field name silently stops matching the rule that validates it.
 */
export type TransactionFormValues = z.input<typeof transactionSchema>;
export type PaymentFormValues = TransactionFormValues["payments"][number];

export const emptyPayment: PaymentFormValues = {
  method: "cash",
  amount: "",
  bankType: "",
  destinationCard: "",
};

export const TYPE_LABELS: Record<(typeof TRANSACTION_TYPES)[number], string> = {
  sell: "فروش به مشتری",
  buy: "خرید از مشتری",
};

export const GOLD_TYPE_LABELS: Record<(typeof GOLD_TYPES)[number], string> = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست‌دوم",
};

export const BANK_TYPE_LABELS: Record<(typeof BANK_TYPES)[number], string> = {
  paya: "پایا",
  "card-to-card": "کارت به کارت",
  bridge: "پل",
};

export const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "نقدی",
  bank: "بانکی",
};

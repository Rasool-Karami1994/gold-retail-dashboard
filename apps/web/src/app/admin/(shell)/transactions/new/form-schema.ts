import { z } from "zod";
import { toLatinDigits } from "@/lib/mobile";
import { toNumber } from "@/lib/numbers";

export { toNumber };

function numeric(inner: z.ZodNumber): z.ZodType<number, z.ZodTypeDef, string> {
  return z.preprocess(toNumber, inner) as unknown as z.ZodType<
    number,
    z.ZodTypeDef,
    string
  >;
}

function requiredEnum<T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(values, { errorMap: () => ({ message }) }),
  );
}

export function normalizeCard(value: string): string {
  return toLatinDigits(value).replace(/[\s-]/g, "");
}

export const IBAN_PREFIX = "IR";

export function normalizeIban(value: string): string {
  const bare = toLatinDigits(value).replace(/[\s-]/g, "").toUpperCase();
  const digits = bare.startsWith(IBAN_PREFIX)
    ? bare.slice(IBAN_PREFIX.length)
    : bare;

  return digits === "" ? "" : `${IBAN_PREFIX}${digits}`;
}

export const PAYMENT_METHODS = ["cash", "bank"] as const;
export const BANK_TYPES = ["paya", "card-to-card", "bridge", "satna"] as const;

export function destinationKindFor(
  bankType: string | undefined | null,
): "card" | "iban" | null {
  if (bankType === "card-to-card") return "card";
  if (bankType === "paya" || bankType === "bridge" || bankType === "satna") {
    return "iban";
  }
  return null;
}

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
    bankType: z.union([z.enum(BANK_TYPES), z.literal("")]).optional(),
    destinationCard: z.string().trim().optional(),
    destinationIban: z.string().trim().optional(),
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

    if (destinationKindFor(payment.bankType) === "iban") {
      const iban = payment.destinationIban
        ? normalizeIban(payment.destinationIban)
        : "";

      if (iban && !/^IR\d{24}$/.test(iban)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destinationIban"],
          message: "شماره شبا باید IR و ۲۴ رقم باشد",
        });
      }
      return;
    }

    const card = payment.destinationCard
      ? normalizeCard(payment.destinationCard)
      : "";

    if (!card) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationCard"],
        message: "شماره کارت مقصد را وارد کنید",
      });
      return;
    }

    if (!/^\d{16}$/.test(card)) {
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
  profitPercentage: numeric(
    z
      .number({ invalid_type_error: "درصد سود را وارد کنید" })
      .min(0, "درصد سود نمی‌تواند منفی باشد")
      .max(100, "درصد سود نمی‌تواند بیشتر از ۱۰۰ باشد"),
  ),
  payments: z.array(paymentSchema),
});

export type TransactionOutput = z.output<typeof transactionSchema>;

export type TransactionFormValues = z.input<typeof transactionSchema>;
export type PaymentFormValues = TransactionFormValues["payments"][number];

export function computeTotals(input: {
  goldWeightGrams: unknown;
  dailyGoldPricePerGram: unknown;
  profitPercentage: unknown;
  type: unknown;
}): { baseAmount: number; profitAmount: number; totalAmount: number } {
  const grams = toNumber(input.goldWeightGrams);
  const perGram = toNumber(input.dailyGoldPricePerGram);
  const percent = toNumber(input.profitPercentage);

  if (!Number.isFinite(grams) || !Number.isFinite(perGram)) {
    return { baseAmount: 0, profitAmount: 0, totalAmount: 0 };
  }

  const baseAmount = Math.round(grams * perGram);
  const profitAmount = Math.round(
    baseAmount * ((Number.isFinite(percent) ? percent : 0) / 100),
  );

  return {
    baseAmount,
    profitAmount,
    totalAmount:
      input.type === "buy" ? baseAmount - profitAmount : baseAmount + profitAmount,
  };
}

export const emptyPayment: PaymentFormValues = {
  method: "cash",
  amount: "",
  bankType: "",
  destinationCard: "",
  destinationIban: IBAN_PREFIX,
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
  satna: "ساتنا",
};

export const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "نقدی",
  bank: "بانکی",
};

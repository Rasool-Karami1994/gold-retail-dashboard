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

/**
 * A number typed into a text field.
 *
 * The runtime behaviour is exactly `preprocess` -- `toNumber` first, then the
 * numeric rules. Only the static INPUT type is narrowed, from the `unknown`
 * that `preprocess` infers to the `string` these fields actually hold: every
 * default is `""` and every writer is an <input>. Left as `unknown`,
 * `TransactionFormValues` claims not to know, and anything reading a field
 * value back -- a controlled input, in particular -- has to cast at each site
 * to say what this says once.
 */
function numeric(inner: z.ZodNumber): z.ZodType<number, z.ZodTypeDef, string> {
  return z.preprocess(toNumber, inner) as unknown as z.ZodType<
    number,
    z.ZodTypeDef,
    string
  >;
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

/** What the Sheba field starts with, so only the digits have to be typed. */
export const IBAN_PREFIX = "IR";

/**
 * A Sheba, however it was typed or pasted.
 *
 * People copy these out of a banking app in every shape: spaced every four
 * characters, lowercase, sometimes without the IR because the app shows it
 * separately. Normalising all of that to a bare `IR` + 24 digits lets the
 * validator be strict without the field feeling hostile.
 *
 * A LONE "IR" NORMALISES TO EMPTY. The field is seeded with the prefix so the
 * user types digits and nothing else, which means an untouched field still has
 * content in it. Treating that as blank here is what keeps the field optional:
 * everything downstream tests the normalised value, so no caller has to know
 * the prefix was pre-filled.
 */
export function normalizeIban(value: string): string {
  const bare = toLatinDigits(value).replace(/[\s-]/g, "").toUpperCase();
  const digits = bare.startsWith(IBAN_PREFIX)
    ? bare.slice(IBAN_PREFIX.length)
    : bare;

  return digits === "" ? "" : `${IBAN_PREFIX}${digits}`;
}

export const PAYMENT_METHODS = ["cash", "bank"] as const;
export const BANK_TYPES = ["paya", "card-to-card", "bridge", "satna"] as const;

/**
 * Which destination each bank route records.
 *
 * A card-to-card transfer names a card. Paya, bridge and satna all settle to
 * an account and have no card involved. Everything that renders or validates
 * the field reads this rather than testing the bankType inline, so the form,
 * the schema and the payload builder cannot disagree about which a route uses.
 */
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
    // "" is what an untouched select holds; the refinement below decides
    // whether that is allowed for this row's method.
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

    /**
     * Paya, bridge and satna settle to an account, so they record a Sheba and
     * never a card. Validated here rather than left to the API: it rejects the wrong
     * one outright, and a 400 surfacing as a whole-form error is a worse way to
     * learn it than a message on the field.
     */
    if (destinationKindFor(payment.bankType) === "iban") {
      const iban = payment.destinationIban
        ? normalizeIban(payment.destinationIban)
        : "";

      // Optional, as the card was for these routes before: staff do not always
      // have the Sheba to hand at the counter, and blocking a recorded payment
      // over it would be worse than a blank destination.
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

    /**
     * Required for card-to-card, which is the only route that has one.
     *
     * A card-to-card transfer by definition has a destination card, and it is
     * the only trace of where the money went.
     */
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

/**
 * The deal's total, from its inputs.
 *
 * Mirrors the model's pre-validate hook exactly -- same order of operations,
 * same rounding at each step -- because this is what the cashier reads before
 * committing and the two disagreeing by a Toman is a support call. Change one,
 * change the other.
 */
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
    // The sign follows the direction of the deal: the shop's margin is added
    // to what a customer pays and withheld from what the shop hands over.
    totalAmount:
      input.type === "buy" ? baseAmount - profitAmount : baseAmount + profitAmount,
  };
}

export const emptyPayment: PaymentFormValues = {
  method: "cash",
  amount: "",
  bankType: "",
  destinationCard: "",
  // Seeded with the prefix, not blank -- see normalizeIban, which reads a lone
  // "IR" back as empty so the field stays optional.
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

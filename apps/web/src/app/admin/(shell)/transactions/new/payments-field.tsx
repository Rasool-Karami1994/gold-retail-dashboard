"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button, Input, Select } from "@/components/ui";
import { formatToman } from "@/lib/format";
import {
  BANK_TYPES,
  BANK_TYPE_LABELS,
  METHOD_LABELS,
  PAYMENT_METHODS,
  emptyPayment,
  toNumber,
  type TransactionFormValues,
} from "./form-schema";

/**
 * The instalments recorded against a transaction.
 *
 * A deal can be settled in one payment, several, or none at all -- an unpaid
 * invoice is the normal case for a shop that extends credit, which is why the
 * list starts empty and nothing here is required.
 *
 * Which fields a row shows depends on its own method, so each row watches only
 * its own `method` rather than the parent re-rendering every row on every
 * keystroke.
 */
export function PaymentsField() {
  const { control } = useFormContext<TransactionFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "payments" });

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">پرداخت‌ها</legend>

      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-fg-secondary">پرداخت‌ها</h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => append(emptyPayment)}
        >
          + افزودن پرداخت
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-fg-muted">
          پرداختی ثبت نشده است. فاکتور به صورت «باز» ثبت می‌شود.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => (
            // field.id, not the index: removing a middle row would otherwise
            // re-key the rows after it and hand them each other's state.
            <li key={field.id}>
              <PaymentRow index={index} onRemove={() => remove(index)} />
            </li>
          ))}
        </ol>
      )}
    </fieldset>
  );
}

function PaymentRow({
  index,
  onRemove,
}: {
  index: number;
  onRemove: () => void;
}) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<TransactionFormValues>();

  const method = useWatch({ control, name: `payments.${index}.method` });
  const bankType = useWatch({ control, name: `payments.${index}.bankType` });
  const rowErrors = errors.payments?.[index];

  const isBank = method === "bank";
  // Only card-to-card must carry a card number; paya and bridge settle by IBAN.
  const cardRequired = isBank && bankType === "card-to-card";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-sunken p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-fg-muted">
          پرداخت {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`حذف پرداخت ${index + 1}`}
          className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-danger/12 hover:text-danger"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="روش پرداخت"
          error={rowErrors?.method?.message}
          {...register(`payments.${index}.method`, {
            // Switching to cash clears the bank-only fields. The API rejects a
            // cash payment that carries a bankType outright, and leaving stale
            // values behind would make that rejection look like a mystery.
            onChange: (event) => {
              if (event.target.value === "cash") {
                setValue(`payments.${index}.bankType`, "");
                setValue(`payments.${index}.destinationCard`, "");
              }
            },
          })}
        >
          {PAYMENT_METHODS.map((value) => (
            <option key={value} value={value}>
              {METHOD_LABELS[value]}
            </option>
          ))}
        </Select>

        <Input
          label="مبلغ (تومان)"
          inputMode="numeric"
          dir="ltr"
          placeholder="0"
          error={rowErrors?.amount?.message}
          {...register(`payments.${index}.amount`)}
        />

        {isBank && (
          <>
            <Select
              label="نوع تراکنش بانکی"
              placeholder="انتخاب کنید"
              error={rowErrors?.bankType?.message}
              {...register(`payments.${index}.bankType`)}
            >
              {BANK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {BANK_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>

            <Input
              label="شماره کارت مقصد"
              inputMode="numeric"
              dir="ltr"
              placeholder="6037991234567890"
              hint={
                cardRequired
                  ? undefined
                  : "اختیاری — انتقال پایا و پل با شبا انجام می‌شود."
              }
              error={rowErrors?.destinationCard?.message}
              {...register(`payments.${index}.destinationCard`)}
            />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The sum of what has been entered so far, and what it leaves outstanding.
 *
 * Separate from the rows so that typing an amount re-renders this line rather
 * than the whole form.
 */
export function PaymentsSummary({ totalAmount }: { totalAmount: number }) {
  const { control } = useFormContext<TransactionFormValues>();
  const payments = useWatch({ control, name: "payments" });

  const paid = (payments ?? []).reduce((sum, payment) => {
    const amount = toNumber(payment?.amount);
    // NaN is a half-typed row, not a zero-value one; skip it rather than
    // poisoning the whole total.
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  // Clamped, matching the model: an overpayment settles the invoice, it does
  // not turn into a debt in the other direction. A refund is its own deal.
  const remaining = Math.max(0, totalAmount - paid);
  const overpaid = paid > totalAmount && totalAmount > 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3">
      <Row label="مبلغ کل" value={formatToman(totalAmount)} />
      <Row label="پرداخت‌شده" value={formatToman(paid)} />
      <Row
        label="مانده"
        value={formatToman(remaining)}
        tone={remaining > 0 ? "danger" : "success"}
        emphasis
      />

      {overpaid && (
        <p className="text-2xs text-warning">
          مبلغ پرداختی از مبلغ کل بیشتر است؛ فاکتور تسویه‌شده ثبت می‌شود.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
  emphasis?: boolean;
}) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-fg";

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span
        className={`tabular-nums ${toneClass} ${emphasis ? "font-bold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

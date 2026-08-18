"use client";

import * as React from "react";
import Link from "next/link";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CurrencyInput,
  PercentInput,
  Select,
  buttonStyles,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPercent, formatToman, formatTomanInWords } from "@/lib/format";
import {
  createTransaction,
  transactionKeys,
  type CreateTransactionInput,
  type TransactionDetail,
  type TransactionPaymentInput,
} from "@/lib/transactions-api";
import { customerKeys } from "@/lib/customers-api";
import { CustomerPicker, type SelectedCustomer } from "./customer-picker";
import { PaymentsField, PaymentsSummary } from "./payments-field";
import { SuccessPanel } from "./success-panel";
import {
  GOLD_TYPES,
  GOLD_TYPE_LABELS,
  TRANSACTION_TYPES,
  TYPE_LABELS,
  computeTotals,
  destinationKindFor,
  normalizeCard,
  normalizeIban,
  toNumber,
  transactionSchema,
  type TransactionFormValues,
  type TransactionOutput,
} from "./form-schema";

/**
 * Recording a deal at the counter.
 *
 * The customer comes first and gates everything else. Weight and price mean
 * nothing without someone to bill, and an invoice half-filled before anyone
 * checked whether the customer exists is an invoice that gets abandoned when
 * the answer is "no" -- so the rest of the form does not appear until a
 * customer is locked in.
 *
 * `totalAmount`, `invoiceNumber` and `status` are never sent. The model derives
 * all three, and the total on screen is a preview of that arithmetic rather
 * than a field: if a client could post a total, it could post one that
 * disagrees with weight x price.
 */

const TRANSACTIONS = "/admin/transactions";

function messageForCreate(error: unknown): string {
  const status = error instanceof ApiError ? error.status : null;

  switch (status) {
    case null:
      return "اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
    case 400:
      return "اطلاعات وارد شده معتبر نیست. مقادیر را بررسی کنید.";
    case 401:
    case 403:
      return "نشست شما منقضی شده است. دوباره وارد شوید.";
    // The picker resolved this customer moments ago, so a 404 means the record
    // was deleted in between.
    case 404:
      return "این مشتری دیگر در سیستم موجود نیست. مشتری را دوباره انتخاب کنید.";
    default:
      return "ثبت معامله انجام نشد. لطفاً دوباره تلاش کنید.";
  }
}

export function NewTransactionForm() {
  const queryClient = useQueryClient();

  const [customer, setCustomer] = React.useState<SelectedCustomer | null>(null);
  const [created, setCreated] = React.useState<TransactionDetail | null>(null);

  /**
   * Three generics, not one: the values the fields hold are strings and empty
   * selects, and the values the resolver hands `handleSubmit` are the parsed
   * numbers and narrowed unions. Declaring both is what lets the submit handler
   * receive `TransactionOutput` without a cast.
   */
  const form = useForm<TransactionFormValues, unknown, TransactionOutput>({
    resolver: zodResolver(transactionSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      type: "",
      goldType: "",
      goldWeightGrams: "",
      dailyGoldPricePerGram: "",
      // "0", not "": the margin is genuinely zero until someone says otherwise,
      // and a blank required number would fail validation on an untouched form.
      profitPercentage: "0",
      payments: [],
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const create = useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: (transaction) => {
      // The new invoice belongs in every cached list and on the customer's
      // profile, both of which are now one row short.
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      setCreated(transaction);
    },
  });

  const submit = handleSubmit((values) => {
    if (!customer) return;

    const payments: TransactionPaymentInput[] = values.payments.map((payment) => {
      if (payment.method === "cash") {
        // Deliberately omitted, not blanked: the API rejects a cash payment
        // that carries bankType or destinationCard at all.
        return { method: "cash", amount: payment.amount };
      }

      /**
       * Only the destination this route actually uses is sent.
       *
       * The form clears the other one on every change of bank type, so it
       * should already be blank -- but the API rejects a card on a paya row and
       * an IBAN on a card-to-card row rather than ignoring them, so selecting
       * by route here is what makes that impossible rather than unlikely.
       */
      const kind = destinationKindFor(payment.bankType);

      const card =
        kind === "card" && payment.destinationCard
          ? normalizeCard(payment.destinationCard)
          : "";
      const iban =
        kind === "iban" && payment.destinationIban
          ? normalizeIban(payment.destinationIban)
          : "";

      return {
        method: "bank",
        amount: payment.amount,
        // Guaranteed by the schema's refinement; the fallback keeps TypeScript
        // honest without a cast.
        bankType: payment.bankType || undefined,
        ...(card ? { destinationCard: card } : {}),
        ...(iban ? { destinationIban: iban } : {}),
      };
    });

    create.mutate({
      customer: customer.id,
      type: values.type,
      goldType: values.goldType,
      goldWeightGrams: values.goldWeightGrams,
      dailyGoldPricePerGram: values.dailyGoldPricePerGram,
      profitPercentage: values.profitPercentage,
      payments,
    });
  });

  if (created) {
    return <SuccessPanel transaction={created} />;
  }

  return (
    <FormProvider {...form}>
      <Card className="w-full max-w-3xl">
        <CardContent className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-fg-secondary">مشتری</h2>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </section>

          {customer && (
            <form noValidate onSubmit={submit} className="flex flex-col gap-6">
              <div className="h-px bg-border" />

              <section className="flex flex-col gap-4">
                <h2 className="text-sm font-bold text-fg-secondary">مشخصات معامله</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="نوع معامله"
                    placeholder="انتخاب کنید"
                    error={errors.type?.message}
                    {...register("type")}
                  >
                    {TRANSACTION_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {TYPE_LABELS[value]}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="نوع طلا"
                    placeholder="انتخاب کنید"
                    error={errors.goldType?.message}
                    {...register("goldType")}
                  >
                    {GOLD_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {GOLD_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </Select>

                  {/* Grams get the grouping but not the words: "۱ میلیون گرم"
                      is not a sentence anyone would say, and the decimal point
                      matters here in a way it does not for Toman. */}
                  <Controller
                    control={control}
                    name="goldWeightGrams"
                    render={({ field }) => (
                      <CurrencyInput
                        label="وزن (گرم)"
                        placeholder="0"
                        decimal
                        showWords={false}
                        error={errors.goldWeightGrams?.message}
                        {...field}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="dailyGoldPricePerGram"
                    render={({ field }) => (
                      <CurrencyInput
                        label="قیمت روز طلا (تومان بر گرم)"
                        placeholder="0"
                        error={errors.dailyGoldPricePerGram?.message}
                        {...field}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="profitPercentage"
                    render={({ field }) => (
                      <PercentInput
                        label="درصد سود"
                        placeholder="0"
                        error={errors.profitPercentage?.message}
                        {...field}
                      />
                    )}
                  />
                </div>

                <TotalPreview />
              </section>

              <div className="h-px bg-border" />

              <PaymentsField />

              <TotalledSummary />

              {create.error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
                >
                  {messageForCreate(create.error)}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  // Stays busy through isSuccess: the success panel has not
                  // painted yet, and a second click would record the sale twice.
                  loading={create.isPending || create.isSuccess}
                >
                  ثبت معامله
                </Button>
                <Link href={TRANSACTIONS} className={buttonStyles({ variant: "ghost" })}>
                  انصراف
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </FormProvider>
  );
}

/**
 * The total, and how it got there.
 *
 * The breakdown exists because the total alone stops being self-evident the
 * moment a margin is involved: base and total differ, and which way they differ
 * depends on the transaction type. Showing the three lines means a cashier can
 * see the sign flip when they change the type, rather than watching one number
 * move and having to work out why.
 */
function TotalPreview() {
  const { baseAmount, profitAmount, totalAmount, type, percent } =
    useWatchedTotals();

  const isBuy = type === "buy";
  const hasProfit = profitAmount > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-fg-muted">مبلغ کل (تومان)</span>
          <span className="text-2xs text-fg-disabled">
            محاسبه‌شده توسط سیستم
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-lg font-bold tabular-nums text-fg">
            {formatToman(totalAmount)}
          </span>
          {formatTomanInWords(totalAmount) && (
            <span className="text-2xs text-fg-muted">
              {formatTomanInWords(totalAmount)}
            </span>
          )}
        </div>
      </div>

      {(hasProfit || baseAmount > 0) && (
        <dl className="flex flex-col gap-1 border-t border-border pt-2 text-2xs">
          <BreakdownRow label="مبلغ پایه (وزن × قیمت روز)" value={baseAmount} />
          {hasProfit && (
            <BreakdownRow
              label={`${isBuy ? "کسر سود" : "سود"} (${percent})`}
              value={profitAmount}
              sign={isBuy ? "−" : "+"}
              tone={isBuy ? "text-danger" : "text-success"}
            />
          )}
          <BreakdownRow label="مبلغ کل" value={totalAmount} emphasis />
        </dl>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  sign,
  tone,
  emphasis,
}: {
  label: string;
  value: number;
  sign?: string;
  tone?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-fg-muted", emphasis && "font-medium text-fg-secondary")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums text-fg-secondary",
          tone,
          emphasis && "font-bold text-fg",
        )}
      >
        {sign ? `${sign} ` : ""}
        {formatToman(value)}
      </dd>
    </div>
  );
}

function TotalledSummary() {
  // The payments summary settles against the FINAL total, margin included --
  // that is the figure the customer owes.
  return <PaymentsSummary totalAmount={useWatchedTotals().totalAmount} />;
}

/**
 * The total and its parts, from the fields that produce them.
 *
 * Delegates the arithmetic to `computeTotals`, which the schema module owns and
 * which mirrors the model hook step for step -- showing one figure here and
 * storing another is a discrepancy the cashier has no way to explain.
 */
function useWatchedTotals() {
  const { control } = useFormContext<TransactionFormValues>();
  const goldWeightGrams = useWatch({ control, name: "goldWeightGrams" });
  const dailyGoldPricePerGram = useWatch({
    control,
    name: "dailyGoldPricePerGram",
  });
  const profitPercentage = useWatch({ control, name: "profitPercentage" });
  // Watched, not read once: the sign in the breakdown has to flip the instant
  // the type changes, without waiting for another keystroke.
  const type = useWatch({ control, name: "type" });

  const totals = computeTotals({
    goldWeightGrams,
    dailyGoldPricePerGram,
    profitPercentage,
    type,
  });

  return { ...totals, type, percent: formatPercent(toNumber(profitPercentage)) };
}

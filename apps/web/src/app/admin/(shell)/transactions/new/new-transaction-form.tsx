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
  Select,
  buttonStyles,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatToman } from "@/lib/format";
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

function TotalPreview() {
  const total = useWatchedTotal();

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-sunken px-4 py-3">
      <div className="flex flex-col">
        <span className="text-xs text-fg-muted">مبلغ کل (تومان)</span>
        <span className="text-2xs text-fg-disabled">
          وزن × قیمت روز — محاسبه‌شده توسط سیستم
        </span>
      </div>
      <span className="text-lg font-bold tabular-nums text-fg">
        {formatToman(total)}
      </span>
    </div>
  );
}

function TotalledSummary() {
  return <PaymentsSummary totalAmount={useWatchedTotal()} />;
}

/**
 * The total, from the two fields that produce it.
 *
 * Rounded to whole Toman to match the model, which does the same on write --
 * showing 11,068,750.0000001 here and storing a round number would be a
 * discrepancy the cashier has no way to explain.
 */
function useWatchedTotal(): number {
  const { control } = useFormContext<TransactionFormValues>();
  const weight = useWatch({ control, name: "goldWeightGrams" });
  const price = useWatch({ control, name: "dailyGoldPricePerGram" });

  const grams = toNumber(weight);
  const perGram = toNumber(price);

  if (!Number.isFinite(grams) || !Number.isFinite(perGram)) return 0;
  return Math.round(grams * perGram);
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Button,
  Card,
  CardContent,
  CurrencyInput,
  ErrorState,
  Input,
  PageHeader,
  Select,
  StatCard,
  buttonStyles,
  formatJalali,
  toast,
} from "@/components/ui";
import { PaymentsList } from "@/components/transactions/payments-list";
import { ApiError } from "@/lib/api";
import { customerKeys } from "@/lib/customers-api";
import {
  formatGrams,
  formatPercent,
  formatToman,
  formatTomanInWords,
} from "@/lib/format";
import { toNumber } from "@/lib/numbers";
import {
  addPayment,
  fetchTransaction,
  transactionKeys,
  type TransactionDetail,
} from "@/lib/transactions-api";
import {
  BANK_TYPES,
  BANK_TYPE_LABELS,
  IBAN_PREFIX,
  METHOD_LABELS,
  PAYMENT_METHODS,
  destinationKindFor,
  normalizeCard,
  normalizeIban,
  paymentSchema,
} from "../../new/form-schema";

const TRANSACTIONS = "/admin/transactions";

const TYPE_LABELS = { sell: "فروش به مشتری", buy: "خرید از مشتری" } as const;

const GOLD_TYPE_LABELS = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست‌دوم",
} as const;

const SETTLEMENT_TOLERANCE = 0.5;

export function AddPaymentScreen({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detailHref = `${TRANSACTIONS}/${id}`;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => fetchTransaction(id),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const settledHere = React.useRef(false);
  const bounced = React.useRef(false);

  React.useEffect(() => {
    if (data?.status !== "settled" || settledHere.current || bounced.current) {
      return;
    }
    bounced.current = true;
    toast.info("این فاکتور تسویه شده است.", {
      id: `settled-${id}`,
      description: "پرداخت تازه‌ای برای آن ثبت نمی‌شود.",
      duration: 8000,
    });

    const timer = window.setTimeout(() => router.replace(detailHref), 50);
    return () => {
      window.clearTimeout(timer);
      bounced.current = false;
    };
  }, [data?.status, router, detailHref, id]);

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ErrorState
            variant="bare"
            message={
              notFound
                ? "این فاکتور پیدا نشد. ممکن است حذف شده باشد یا نشانی اشتباه باشد."
                : "اطلاعات فاکتور بارگذاری نشد."
            }
            onRetry={notFound ? undefined : () => refetch()}
          />
          <Link
            href={TRANSACTIONS}
            className={buttonStyles({ variant: "secondary" })}
          >
            بازگشت به فهرست فاکتورها
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (data?.status === "settled" && !settledHere.current) return null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "فاکتورها", href: TRANSACTIONS },
          { label: data?.invoiceNumber ?? "…", href: detailHref },
          { label: "ثبت پرداخت" },
        ]}
        eyebrow="فاکتورها"
        title="ثبت پرداخت"
        description={
          data ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono" dir="ltr">
                {data.invoiceNumber}
              </span>
              <span aria-hidden="true" className="text-fg-disabled">
                ·
              </span>
              <span>{formatJalali(new Date(data.createdAt), "YYYY/MM/DD")}</span>
            </span>
          ) : (
            <span className="block h-4 w-56 animate-pulse rounded bg-surface-raised" />
          )
        }
        actions={
          <Link href={detailHref} className={buttonStyles({ variant: "ghost" })}>
            بازگشت به فاکتور
          </Link>
        }
      />

      {isPending || !data ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Figures transaction={data} />
          <LockedDeal transaction={data} />
          <PaymentsList
            payments={data.payments}
            title="پرداخت‌های ثبت‌شده"
            emptyMessage="هنوز پرداختی ثبت نشده است."
          />
          <NewPaymentForm
            transaction={data}
            onRecorded={(updated) => {
              queryClient.setQueryData(transactionKeys.detail(id), updated);
              queryClient.invalidateQueries({ queryKey: transactionKeys.all });
              queryClient.invalidateQueries({ queryKey: customerKeys.all });
              queryClient.invalidateQueries({ queryKey: ["stats"] });

              if (updated.status === "settled") {
                settledHere.current = true;
                return;
              }

              toast.success("پرداخت ثبت شد.", {
                description: `مانده: ${formatToman(updated.remainingAmount)} تومان`,
              });
            }}
          />
        </>
      )}
    </>
  );
}

function Figures({ transaction }: { transaction: TransactionDetail }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <StatCard
        title="مبلغ کل"
        value={transaction.totalAmount}
        format={formatToman}
        unit="تومان"
        hint={formatTomanInWords(transaction.totalAmount)}
      />
      <StatCard
        title="پرداخت‌شده"
        value={transaction.paidAmount}
        format={formatToman}
        unit="تومان"
        tone="success"
        hint={formatTomanInWords(transaction.paidAmount)}
      />
      <StatCard
        title="مانده"
        value={transaction.remainingAmount}
        format={formatToman}
        unit="تومان"
        tone={transaction.remainingAmount > 0 ? "danger" : "success"}
        hint={formatTomanInWords(transaction.remainingAmount)}
      />
    </section>
  );
}

function LockedDeal({ transaction }: { transaction: TransactionDetail }) {
  const customerName = transaction.customer
    ? `${transaction.customer.firstName} ${transaction.customer.lastName}`.trim()
    : "حذف‌شده";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-bold text-fg-secondary">مشخصات معامله</h2>
          <span className="flex items-center gap-1.5 text-2xs text-fg-muted">
            <LockIcon />
            قابل ویرایش نیست
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Locked label="مشتری" value={customerName} />
          <Locked
            label="شماره موبایل"
            value={transaction.customer?.mobile ?? "—"}
            dir="ltr"
          />
          <Locked label="نوع معامله" value={TYPE_LABELS[transaction.type]} />
          <Locked label="نوع طلا" value={GOLD_TYPE_LABELS[transaction.goldType]} />
          <Locked
            label="وزن (گرم)"
            value={formatGrams(transaction.goldWeightGrams)}
            dir="ltr"
          />
          <Locked
            label="قیمت روز طلا (تومان بر گرم)"
            value={formatToman(transaction.dailyGoldPricePerGram)}
            dir="ltr"
          />
          <Locked
            label="درصد سود"
            value={formatPercent(transaction.profitPercentage)}
            dir="ltr"
          />
          {transaction.profitAmount > 0 && (
            <Locked
              label={`${transaction.type === "buy" ? "کسر سود" : "سود"} (تومان)`}
              value={`${transaction.type === "buy" ? "−" : "+"} ${formatToman(
                transaction.profitAmount,
              )}`}
              dir="ltr"
            />
          )}
          <Locked
            label="مبلغ کل (تومان)"
            value={formatToman(transaction.totalAmount)}
            dir="ltr"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Locked({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <Input
      label={label}
      value={value}
      dir={dir}
      disabled
      readOnly
      className="cursor-not-allowed text-fg-secondary"
      endAdornment={<LockIcon />}
    />
  );
}

type PaymentFields = {
  method: "" | "cash" | "bank";
  amount: string;
  bankType: "" | "paya" | "card-to-card" | "bridge" | "satna";
  destinationCard: string;
  destinationIban: string;
};

const EMPTY: PaymentFields = {
  method: "cash",
  amount: "",
  bankType: "",
  destinationCard: "",
  destinationIban: "",
};

function NewPaymentForm({
  transaction,
  onRecorded,
}: {
  transaction: TransactionDetail;
  onRecorded: (updated: TransactionDetail) => void;
}) {
  const router = useRouter();
  const remaining = transaction.remainingAmount;
  const detailHref = `${TRANSACTIONS}/${transaction.id}`;

  const [settled, setSettled] = React.useState<TransactionDetail | null>(null);

  const schema = React.useMemo(
    () =>
      paymentSchema.superRefine((payment, ctx) => {
        const amount = toNumber(payment.amount);
        if (!Number.isFinite(amount)) return;

        if (amount > remaining + SETTLEMENT_TOLERANCE) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["amount"],
            message: `بیشتر از مانده است. حداکثر ${formatToman(remaining)} تومان`,
          });
        }
      }),
    [remaining],
  );

  const form = useForm<PaymentFields>({
    resolver: zodResolver(schema) as never,
    defaultValues: EMPTY,
    mode: "onSubmit",
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = form;

  const method = watch("method");
  const bankType = watch("bankType");
  const amount = watch("amount");

  const isBank = method === "bank";
  const destination = isBank ? destinationKindFor(bankType) : null;

  const typed = toNumber(amount);
  const willSettle =
    Number.isFinite(typed) && typed > 0 && remaining - typed <= SETTLEMENT_TOLERANCE;

  const record = useMutation({
    mutationFn: (values: PaymentFields) => {
      const kind = destinationKindFor(values.bankType);
      const card =
        kind === "card" && values.destinationCard
          ? normalizeCard(values.destinationCard)
          : "";
      const iban =
        kind === "iban" && values.destinationIban
          ? normalizeIban(values.destinationIban)
          : "";

      return addPayment(
        transaction.id,
        values.method === "cash"
          ? { method: "cash", amount: toNumber(values.amount) }
          : {
              method: "bank",
              amount: toNumber(values.amount),
              bankType: values.bankType || undefined,
              ...(card ? { destinationCard: card } : {}),
              ...(iban ? { destinationIban: iban } : {}),
            },
      );
    },
    onSuccess: (updated) => {
      onRecorded(updated);

      if (updated.status === "settled") {
        setSettled(updated);
        return;
      }

      reset(EMPTY);
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) return;

      if (err.status === 400 && typeof err.body?.remainingAmount === "number") {
        setError("amount", {
          message: `مانده تغییر کرده است. حداکثر ${formatToman(
            err.body.remainingAmount,
          )} تومان`,
        });
        return;
      }

      if (err.status === 409) {
        toast.info("این فاکتور در این فاصله تسویه شده است.");
        router.replace(detailHref);
      }
    },
  });

  if (settled) return <SettledPanel transaction={settled} />;

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={handleSubmit((values) => record.mutate(values))}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-bold text-fg-secondary">پرداخت جدید</h2>
            <span className="text-2xs text-fg-muted">
              مانده: {formatToman(remaining)} تومان
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="روش پرداخت"
              error={errors.method?.message}
              {...register("method", {
                onChange: (event) => {
                  if (event.target.value === "cash") {
                    setValue("bankType", "");
                    setValue("destinationCard", "");
                    setValue("destinationIban", "");
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

            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <CurrencyInput
                  label="مبلغ (تومان)"
                  placeholder="0"
                  error={errors.amount?.message}
                  {...field}
                />
              )}
            />

            {isBank && (
              <>
                <Select
                  label="نوع تراکنش بانکی"
                  placeholder="انتخاب کنید"
                  error={errors.bankType?.message}
                  {...register("bankType", {
                    onChange: (event) => {
                      const kind = destinationKindFor(event.target.value);
                      if (kind !== "card") setValue("destinationCard", "");
                      setValue(
                        "destinationIban",
                        kind === "iban" ? IBAN_PREFIX : "",
                      );
                    },
                  })}
                >
                  {BANK_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {BANK_TYPE_LABELS[value]}
                    </option>
                  ))}
                </Select>

                {destination === "iban" ? (
                  <Input
                    label="شماره شبا مقصد"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="IR854752136958475213658742"
                    error={errors.destinationIban?.message}
                    {...register("destinationIban")}
                  />
                ) : (
                  <Input
                    label="شماره کارت مقصد"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="6037991234567890"
                    error={errors.destinationCard?.message}
                    {...register("destinationCard")}
                  />
                )}
              </>
            )}
          </div>

          {willSettle && (
            <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
              با این پرداخت، فاکتور تسویه می‌شود.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button type="submit" loading={record.isPending}>
              ثبت پرداخت
            </Button>
            <Link href={detailHref} className={buttonStyles({ variant: "ghost" })}>
              انصراف
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SettledPanel({ transaction }: { transaction: TransactionDetail }) {
  const router = useRouter();
  const detailHref = `${TRANSACTIONS}/${transaction.id}`;

  React.useEffect(() => {
    const timer = setTimeout(() => router.replace(detailHref), 2500);
    return () => clearTimeout(timer);
  }, [router, detailHref]);

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-success/12 text-success"
          >
            <CheckIcon />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-bold text-fg">فاکتور تسویه شد</h2>
            <p className="text-sm text-fg-muted">
              مبلغ {formatToman(transaction.totalAmount)} تومان به طور کامل پرداخت
              شده است.
            </p>
          </div>
        </div>

        <p className="text-xs text-fg-muted">
          در حال بازگشت به صفحه‌ی فاکتور…
        </p>

        <Link href={detailHref} className={buttonStyles({ variant: "secondary" })}>
          مشاهده‌ی فاکتور
        </Link>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-32 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-surface-raised" />
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  DataTable,
  PageHeader,
  buttonStyles,
  formatJalali,
  type Column,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatGrams, formatToman } from "@/lib/format";
import {
  fetchMyTransaction,
  myTransactionKeys,
  type TransactionDetail as TransactionDetailData,
  type TransactionPayment,
} from "@/lib/transactions-api";
import { CUSTOMER_TRANSACTIONS } from "../../routes";

/**
 * One of the customer's own invoices, read-only.
 *
 * The admin's version of this screen can re-render the PDF and will grow an
 * add-payment form; this one deliberately cannot do either. Both of those
 * endpoints are admin-only at the API, so offering the buttons would be
 * offering 403s. What remains is everything a customer needs: what the deal
 * was, what is outstanding, and what they have paid so far.
 */

const TYPE_LABELS = { sell: "خرید از فروشگاه", buy: "فروش به فروشگاه" } as const;

const GOLD_TYPE_LABELS = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست‌دوم",
} as const;

const METHOD_LABELS = { cash: "نقدی", bank: "بانکی" } as const;

const BANK_TYPE_LABELS = {
  paya: "پایا",
  "card-to-card": "کارت به کارت",
  bridge: "پل",
  satna: "ساتنا",
} as const;

/**
 * The balance, from the CUSTOMER's side of the counter.
 *
 * Same `balanceDirection` the admin screen reads, worded for the person who
 * owes or is owed rather than about them.
 */
const BALANCE_LABELS = {
  "customer-owes-shop": "شما به فروشگاه بدهکار هستید",
  "shop-owes-customer": "فروشگاه به شما بدهکار است",
  none: "تسویه شده",
} as const;

export function MyTransactionDetail({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: myTransactionKeys.detail(id),
    queryFn: () => fetchMyTransaction(id),
    // 404 covers both "no such invoice" and "not yours" -- the API answers the
    // same way for each on purpose. Either way it will stay a 404.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "معاملات من", href: CUSTOMER_TRANSACTIONS },
          { label: data?.invoiceNumber ?? "…" },
        ]}
        eyebrow="حساب کاربری"
        title={
          data ? (
            <span className="font-mono" dir="ltr">
              {data.invoiceNumber}
            </span>
          ) : (
            <span className="block h-8 w-64 animate-pulse rounded bg-surface-raised" />
          )
        }
        description={
          data ? (
            formatJalali(new Date(data.createdAt), "YYYY/MM/DD HH:mm")
          ) : (
            <span className="block h-4 w-40 animate-pulse rounded bg-surface-raised" />
          )
        }
        actions={
          data?.invoicePdfUrl ? (
            <a
              href={data.invoicePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "secondary" })}
            >
              <DownloadIcon />
              دریافت فاکتور
            </a>
          ) : null
        }
      />

      {isPending || !data ? (
        <LoadingSkeleton />
      ) : (
        <>
          <BalanceBanner transaction={data} />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="flex flex-col gap-4">
                <h2 className="text-sm font-bold text-fg-secondary">مشخصات معامله</h2>

                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Field label="نوع معامله">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-2xs",
                        data.type === "sell"
                          ? "bg-warning/12 text-warning"
                          : "bg-success/12 text-success",
                      )}
                    >
                      {TYPE_LABELS[data.type]}
                    </span>
                  </Field>

                  <Field label="نوع طلا">{GOLD_TYPE_LABELS[data.goldType]}</Field>

                  <Field label="وزن">
                    <span className="tabular-nums">
                      {formatGrams(data.goldWeightGrams)} گرم
                    </span>
                  </Field>

                  <Field label="قیمت روز طلا">
                    <span className="tabular-nums">
                      {formatToman(data.dailyGoldPricePerGram)} تومان بر گرم
                    </span>
                  </Field>
                </dl>
              </CardContent>
            </Card>

            <Card variant="raised">
              <CardContent className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-fg-secondary">مبالغ</h2>

                <Amount label="مبلغ کل" value={data.totalAmount} />
                <Amount label="پرداخت‌شده" value={data.paidAmount} />
                <div className="h-px bg-border" />
                <Amount
                  label="مانده"
                  value={data.remainingAmount}
                  tone={data.status === "settled" ? "success" : "danger"}
                  emphasis
                />
              </CardContent>
            </Card>
          </div>

          <PaymentsList payments={data.payments} />
        </>
      )}
    </>
  );
}

function BalanceBanner({ transaction }: { transaction: TransactionDetailData }) {
  const settled = transaction.status === "settled";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3",
        settled ? "border-success/40 bg-success/8" : "border-danger/40 bg-danger/8",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            settled ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
          )}
        >
          {settled ? <CheckIcon /> : <ClockIcon />}
        </span>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-fg">
            {settled ? "تسویه‌شده" : "باز"}
          </span>
          <span className="text-xs text-fg-muted">
            {BALANCE_LABELS[transaction.balanceDirection]}
          </span>
        </div>
      </div>

      {!settled && (
        <span className="text-lg font-bold tabular-nums text-danger">
          {formatToman(transaction.remainingAmount)}{" "}
          <span className="text-xs font-normal text-fg-muted">تومان</span>
        </span>
      )}
    </div>
  );
}

function PaymentsList({ payments }: { payments: TransactionPayment[] }) {
  const columns = React.useMemo<Column<TransactionPayment>[]>(
    () => [
      {
        id: "paidAt",
        header: "تاریخ",
        cell: (row) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatJalali(new Date(row.paidAt), "YYYY/MM/DD HH:mm")}
          </span>
        ),
        width: "11rem",
      },
      {
        id: "method",
        header: "روش",
        cell: (row) => (
          <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-2xs text-fg-secondary">
            {METHOD_LABELS[row.method]}
          </span>
        ),
        width: "6rem",
      },
      {
        id: "bankType",
        header: "نوع تراکنش",
        cell: (row) =>
          row.bankType ? (
            BANK_TYPE_LABELS[row.bankType]
          ) : (
            <span className="text-fg-muted">—</span>
          ),
        width: "8rem",
      },
      {
        id: "amount",
        header: "مبلغ (تومان)",
        cell: (row) => (
          <span className="font-medium text-fg">{formatToman(row.amount)}</span>
        ),
        align: "end",
        width: "10rem",
      },
    ],
    [],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-bold text-fg-secondary">پرداخت‌ها</h2>
        {payments.length > 0 && (
          <p className="text-xs text-fg-muted">
            مجموع {formatToman(payments.reduce((sum, p) => sum + p.amount, 0))} تومان
          </p>
        )}
      </div>

      {/*
        The destination card is deliberately absent, unlike the admin's copy of
        this table. It is the SHOP's receiving card, not the customer's, and it
        is of no use to them -- printing someone else's card number on a page
        because the field happens to be in the response is not a good default.
      */}
      <DataTable
        data={payments}
        columns={columns}
        rowKey={(row, index) => `${row.paidAt}-${index}`}
        paginated={false}
        emptyMessage="پرداختی برای این فاکتور ثبت نشده است."
        caption="فهرست پرداخت‌های فاکتور"
      />
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg-secondary">{children}</dd>
    </div>
  );
}

function Amount({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "text-lg font-bold" : "text-sm",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          !tone && "text-fg",
        )}
      >
        {formatToman(value)}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-16 animate-pulse rounded-lg bg-surface-raised" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-48 animate-pulse rounded-lg bg-surface-raised lg:col-span-2" />
        <div className="h-48 animate-pulse rounded-lg bg-surface-raised" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-bold text-fg">
          {notFound ? "فاکتور پیدا نشد" : "اطلاعات فاکتور بارگذاری نشد"}
        </h1>
        <p className="text-sm text-fg-muted">
          {notFound
            ? "این فاکتور در حساب شما وجود ندارد."
            : "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Link
            href={CUSTOMER_TRANSACTIONS}
            className={buttonStyles({ variant: "secondary" })}
          >
            بازگشت به معاملات من
          </Link>
          {!notFound && (
            <button type="button" onClick={onRetry} className={buttonStyles()}>
              تلاش دوباره
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DownloadIcon() {
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
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-5"
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

function ClockIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

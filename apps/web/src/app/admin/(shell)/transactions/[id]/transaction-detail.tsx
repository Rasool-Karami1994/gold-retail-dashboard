"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
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
  fetchTransaction,
  regenerateInvoice,
  transactionKeys,
  type TransactionDetail as TransactionDetailData,
  type TransactionPayment,
} from "@/lib/transactions-api";

const TRANSACTIONS = "/admin/transactions";

const TYPE_LABELS = { sell: "فروش به مشتری", buy: "خرید از مشتری" } as const;

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
} as const;

/**
 * Which way an open balance points, in words.
 *
 * This is the one fact about a transaction that cannot be read off the numbers
 * alone: the same non-zero remainder means the customer owes the shop on a
 * 'sell' and the shop owes the customer on a 'buy'. The model resolves it into
 * `balanceDirection` precisely so no screen has to re-derive it -- see the
 * header comment in transaction.model.ts.
 */
const BALANCE_LABELS = {
  "customer-owes-shop": "مشتری به فروشگاه بدهکار است",
  "shop-owes-customer": "فروشگاه به مشتری بدهکار است",
  none: "تسویه شده",
} as const;

export function TransactionDetail({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => fetchTransaction(id),
    // A bad id is a 404 and will stay one; retrying only delays the message.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "فاکتورها", href: TRANSACTIONS },
          { label: data?.invoiceNumber ?? "…" },
        ]}
        eyebrow="فاکتورها"
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
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{formatJalali(new Date(data.createdAt), "YYYY/MM/DD HH:mm")}</span>
              {data.createdBy && (
                <>
                  <span aria-hidden="true" className="text-fg-disabled">
                    ·
                  </span>
                  <span>ثبت‌شده توسط {data.createdBy.username}</span>
                </>
              )}
            </span>
          ) : (
            <span className="block h-4 w-56 animate-pulse rounded bg-surface-raised" />
          )
        }
        actions={data ? <InvoiceAction transaction={data} /> : null}
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

                  <Field label="مشتری">
                    {data.customer ? (
                      <Link
                        href={`/admin/customers/${data.customer.id}`}
                        className="text-link hover:underline"
                      >
                        {`${data.customer.firstName} ${data.customer.lastName}`.trim()}
                      </Link>
                    ) : (
                      <span className="text-fg-muted">حذف‌شده</span>
                    )}
                  </Field>

                  <Field label="شماره موبایل">
                    {data.customer ? (
                      <span className="font-mono text-xs" dir="ltr">
                        {data.customer.mobile}
                      </span>
                    ) : (
                      <span className="text-fg-muted">—</span>
                    )}
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

/**
 * The PDF, or the button that makes one.
 *
 * Declared at module level, not nested inside TransactionDetail: a component
 * defined during render is a new type on every render, so React would unmount
 * and remount this one each time the parent re-rendered -- throwing away the
 * `isPending` of a render that is still running.
 */
function InvoiceAction({ transaction }: { transaction: TransactionDetailData }) {
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () => regenerateInvoice(transaction.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.detail(transaction.id),
      });
    },
  });

  if (transaction.invoicePdfUrl) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={transaction.invoicePdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant: "secondary" })}
        >
          <DownloadIcon />
          فاکتور PDF
        </a>

        {/*
          Re-rendering matters after a payment is recorded: the printed invoice
          still shows the old balance. `notify` is left off, so this does not
          text the customer a second link.
        */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={generate.isPending}
          onClick={() => generate.mutate()}
        >
          ساخت دوباره
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        loading={generate.isPending}
        onClick={() => generate.mutate()}
      >
        ساخت فاکتور PDF
      </Button>
      {generate.isError && (
        <span className="text-2xs text-danger">ساخت فاکتور انجام نشد.</span>
      )}
    </div>
  );
}

/**
 * The headline: is anything still owed, and by whom.
 *
 * Above the numbers rather than beside them, because it is the question a
 * settled-or-not glance is actually asking.
 */
function BalanceBanner({ transaction }: { transaction: TransactionDetailData }) {
  const settled = transaction.status === "settled";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3",
        settled
          ? "border-success/40 bg-success/8"
          : "border-danger/40 bg-danger/8",
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
        id: "destination",
        // One column for both, because a row only ever has one: card-to-card
        // records a card, paya and bridge record a Sheba. Two columns would be
        // half empty whichever route the shop uses most.
        header: "مقصد",
        cell: (row) => {
          const value = row.destinationCard ?? row.destinationIban;
          if (!value) return <span className="text-fg-muted">—</span>;

          return (
            <span className="flex flex-col gap-0.5">
              <span className="text-2xs text-fg-muted">
                {row.destinationCard ? "کارت" : "شبا"}
              </span>
              <span className="font-mono text-xs" dir="ltr">
                {value}
              </span>
            </span>
          );
        },
        width: "14rem",
        hideOnMobile: true,
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

      <DataTable
        data={payments}
        columns={columns}
        // Payments are a handful per invoice and arrive whole with it, so there
        // is nothing to page through.
        rowKey={(row, index) => `${row.paidAt}-${index}`}
        paginated={false}
        emptyMessage="پرداختی برای این فاکتور ثبت نشده است."
        caption="فهرست پرداخت‌های فاکتور"
      />
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
        <div className="h-56 animate-pulse rounded-lg bg-surface-raised lg:col-span-2" />
        <div className="h-56 animate-pulse rounded-lg bg-surface-raised" />
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
            ? "این فاکتور حذف شده یا نشانی اشتباه است."
            : "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Link href={TRANSACTIONS} className={buttonStyles({ variant: "secondary" })}>
            بازگشت به فهرست فاکتورها
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

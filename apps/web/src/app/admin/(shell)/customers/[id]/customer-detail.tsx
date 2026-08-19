"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  PageHeader,
  buttonStyles,
  formatJalali,
} from "@/components/ui";
import {
  TransactionsTable,
  type TransactionColumnId,
} from "@/components/transactions/transactions-table";
import { ApiError } from "@/lib/api";
import { customerKeys, fetchCustomerDetail } from "@/lib/customers-api";
import { formatNumber, formatToman } from "@/lib/format";
import { CUSTOMERS } from "../routes";

const PAGE_SIZE = 10;

const HISTORY_COLUMNS: TransactionColumnId[] = [
  "invoiceNumber",
  "date",
  "type",
  "goldType",
  "weight",
  "totalAmount",
  "paidAmount",
  "remainingAmount",
  "status",
];

export function CustomerDetail({ id }: { id: string }) {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [id]);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: customerKeys.detail(id, page, PAGE_SIZE),
    queryFn: () => fetchCustomerDetail(id, { page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const customer = data?.customer;
  const totals = data?.totals;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "مشتریان", href: CUSTOMERS },
          { label: customer?.fullName ?? "…" },
        ]}
        eyebrow="مشتریان"
        title={
          customer ? (
            customer.fullName
          ) : (
            <span className="block h-8 w-56 animate-pulse rounded bg-surface-raised" />
          )
        }
        description={
          customer ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-fg-secondary" dir="ltr">
                {customer.mobile}
              </span>
              <span aria-hidden="true" className="text-fg-disabled">
                ·
              </span>
              <span>عضو از {formatJalali(new Date(customer.createdAt))}</span>
            </span>
          ) : (
            <span className="block h-4 w-44 animate-pulse rounded bg-surface-raised" />
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="تعداد معاملات"
          value={totals ? formatNumber(totals.transactionCount) : null}
          icon={
            <Icon>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6M8 13h8M8 17h5" />
            </Icon>
          }
        />
        <StatTile
          label="مجموع فروش به مشتری (تومان)"
          value={totals ? formatToman(totals.totalPurchased) : null}
          tone="warning"
          icon={
            <Icon>
              <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </Icon>
          }
        />
        <StatTile
          label="مجموع خرید از مشتری (تومان)"
          value={totals ? formatToman(totals.totalSold) : null}
          tone="success"
          icon={
            <Icon>
              <path d="M3 6h18l-1.5 12a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2Z" />
              <path d="M8 6V5a4 4 0 0 1 8 0v1" />
            </Icon>
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-bold text-fg-secondary">
            تاریخچه‌ی معاملات
          </h2>
          {data && (
            <p className="text-xs text-fg-muted">
              {formatNumber(data.pagination.total)} فاکتور
            </p>
          )}
        </div>

        <TransactionsTable
          data={data?.transactions ?? []}
          columns={HISTORY_COLUMNS}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          totalRows={data?.pagination.total ?? 0}
          loading={isPending}
          emptyMessage="این مشتری هنوز معامله‌ای ندارد."
          caption="تاریخچه‌ی معاملات مشتری"
          className={isFetching && !isPending ? "opacity-60 transition-opacity" : undefined}
        />
      </section>
    </>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  tone?: "primary" | "success" | "warning";
}) {
  const toneClass = {
    primary: "bg-primary-500/12 text-primary-400",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
  }[tone];

  return (
    <Card variant="raised">
      <CardContent className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={`grid size-11 shrink-0 place-items-center rounded-lg ${toneClass}`}
        >
          {icon}
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          {value === null ? (
            <span className="h-6 w-24 animate-pulse rounded bg-surface-overlay" />
          ) : (
            <span className="truncate text-xl font-bold tabular-nums text-fg">
              {value}
            </span>
          )}
          <span className="text-xs text-fg-muted">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-bold text-fg">
          {notFound ? "مشتری پیدا نشد" : "اطلاعات مشتری بارگذاری نشد"}
        </h1>
        <p className="text-sm text-fg-muted">
          {notFound
            ? "این مشتری حذف شده یا نشانی اشتباه است."
            : "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Link href={CUSTOMERS} className={buttonStyles({ variant: "secondary" })}>
            بازگشت به فهرست مشتریان
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

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

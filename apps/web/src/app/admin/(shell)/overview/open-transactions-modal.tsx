"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { DataTable, ErrorState, Modal, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatGrams, formatToman } from "@/lib/format";
import {
  fetchOpenTransactions,
  statsKeys,
  type OpenTransactionRow,
} from "@/lib/stats-api";

const PAGE_SIZE = 10;

type TypeFilter = "all" | "sell" | "buy";

const FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "sell", label: "بدهی مشتری" },
  { id: "buy", label: "بدهی فروشگاه" },
];

export function OpenTransactionsModal({
  open,
  onClose,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  unit: "amount" | "grams";
}) {
  const [page, setPage] = React.useState(1);
  const [type, setType] = React.useState<TypeFilter>("all");

  React.useEffect(() => {
    setPage(1);
  }, [type]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: statsKeys.openTransactions(
      page,
      PAGE_SIZE,
      type === "all" ? undefined : type,
    ),
    queryFn: () =>
      fetchOpenTransactions({
        page,
        limit: PAGE_SIZE,
        type: type === "all" ? undefined : type,
      }),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const columns = React.useMemo<Column<OpenTransactionRow>[]>(() => {
    const amountColumn: Column<OpenTransactionRow> = {
      id: "remainingAmount",
      header: "مانده (تومان)",
      cell: (row) => (
        <span className={cn(unit === "amount" && "font-medium text-fg")}>
          {formatToman(row.remainingAmount)}
        </span>
      ),
      align: "end",
      width: "10rem",
    };

    const gramsColumn: Column<OpenTransactionRow> = {
      id: "remainingGrams",
      header: "معادل (گرم)",
      cell: (row) => (
        <span className={cn(unit === "grams" && "font-medium text-fg")}>
          {formatGrams(row.remainingGrams)}
        </span>
      ),
      align: "end",
      width: "8rem",
    };

    return [
      {
        id: "invoiceNumber",
        header: "شماره فاکتور",
        cell: (row) => (
          <span className="font-mono text-2xs" dir="ltr">
            {row.invoiceNumber}
          </span>
        ),
        width: "11rem",
      },
      {
        id: "customer",
        header: "مشتری",
        cell: (row) =>
          row.customer ? (
            <div className="flex flex-col">
              <span className="truncate">
                {`${row.customer.firstName} ${row.customer.lastName}`.trim()}
              </span>
              <span className="text-2xs text-fg-muted" dir="ltr">
                {row.customer.mobile}
              </span>
            </div>
          ) : (
            <span className="text-fg-muted">—</span>
          ),
      },
      {
        id: "type",
        header: "جهت",
        cell: (row) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2 py-0.5 text-2xs",
              row.type === "sell"
                ? "bg-danger/12 text-danger"
                : "bg-warning/12 text-warning",
            )}
          >
            {row.type === "sell" ? "بدهی مشتری" : "بدهی فروشگاه"}
          </span>
        ),
        width: "7.5rem",
      },
      {
        id: "totalAmount",
        header: "مبلغ کل",
        cell: (row) => formatToman(row.totalAmount),
        align: "end",
        width: "9rem",
        hideOnMobile: true,
      },
      ...(unit === "amount"
        ? [amountColumn, gramsColumn]
        : [gramsColumn, amountColumn]),
    ];
  }, [unit]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="معاملات تسویه‌نشده"
      description={
        unit === "amount"
          ? "مانده‌ی حساب‌های باز، به تومان"
          : "مانده‌ی حساب‌های باز، به معادل گرم"
      }
    >
      <div className="flex flex-col gap-4">
        <div
          role="group"
          aria-label="فیلتر جهت بدهی"
          className="flex w-fit gap-1 rounded-md bg-surface-sunken p-1"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={type === filter.id}
              onClick={() => setType(filter.id)}
              className={cn(
                "rounded px-3 py-1.5 text-xs transition-colors",
                type === filter.id
                  ? "bg-primary-500 text-white"
                  : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isError ? (
          <ErrorState
            message="فهرست معاملات تسویه‌نشده بارگذاری نشد."
            onRetry={() => refetch()}
          />
        ) : (
          <DataTable
            data={data?.items ?? []}
            columns={columns}
            rowKey={(row) => row.id}
            manual
            page={page}
            onPageChange={setPage}
            pageSize={PAGE_SIZE}
            totalRows={data?.pagination.total ?? 0}
            loading={isFetching}
            emptyMessage="حساب تسویه‌نشده‌ای وجود ندارد."
            caption="فهرست معاملات تسویه‌نشده"
          />
        )}
      </div>
    </Modal>
  );
}

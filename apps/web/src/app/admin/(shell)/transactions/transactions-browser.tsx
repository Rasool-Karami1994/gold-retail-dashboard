"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button, ErrorState, formatJalaliRange } from "@/components/ui";
import {
  TransactionsTable,
  type TransactionColumnId,
} from "@/components/transactions/transactions-table";
import { formatNumber } from "@/lib/format";
import {
  fetchTransactions,
  transactionKeys,
  transactionQuery,
  type TransactionFilters,
} from "@/lib/transactions-api";
import { TransactionFiltersModal } from "./filters-modal";

const PAGE_SIZE = 20;

const COLUMNS: TransactionColumnId[] = [
  "invoiceNumber",
  "customerName",
  "customerMobile",
  "type",
  "goldType",
  "weight",
  "totalAmount",
  "remainingAmount",
  "status",
  "date",
  "details",
];

export function TransactionsBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const filters = React.useMemo<TransactionFilters>(
    () => ({
      customerName: searchParams.get("customerName") ?? undefined,
      customerMobile: searchParams.get("customerMobile") ?? undefined,
      invoiceNumber: searchParams.get("invoiceNumber") ?? undefined,
      dateFrom: parseDate(searchParams.get("dateFrom")),
      dateTo: parseDate(searchParams.get("dateTo")),
    }),
    [searchParams],
  );

  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const commit = (next: TransactionFilters, nextPage: number) => {
    const params = new URLSearchParams(transactionQuery(next));
    if (nextPage > 1) params.set("page", String(nextPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const applyFilters = (next: TransactionFilters) => {
    commit(next, 1);
  };

  const removeFilter = (key: keyof TransactionFilters) => {
    const next = { ...filters };
    if (key === "dateFrom" || key === "dateTo") {
      delete next.dateFrom;
      delete next.dateTo;
    } else {
      delete next[key];
    }
    commit(next, 1);
  };

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: transactionKeys.list(filters, page, PAGE_SIZE),
    queryFn: () => fetchTransactions(filters, { page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const chips = describeFilters(filters);
  const total = data?.pagination.total ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen(true)}
          startIcon={<FilterIcon />}
        >
          فیلتر
          {chips.length > 0 && (
            <span className="rounded-full bg-primary-500 px-1.5 text-2xs font-bold text-white">
              {formatNumber(chips.length)}
            </span>
          )}
        </Button>

        {chips.map((chip) => (
          <span
            key={chip.key}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface-raised py-1 pe-2 ps-1 text-xs text-fg-secondary"
          >
            <span className="text-fg-muted">{chip.label}:</span>
            <span className="text-fg">{chip.value}</span>
            <button
              type="button"
              onClick={() => removeFilter(chip.key)}
              aria-label={`حذف فیلتر ${chip.label}`}
              className="rounded-full p-0.5 text-fg-muted transition-colors hover:bg-surface-overlay hover:text-fg"
            >
              <CloseIcon />
            </button>
          </span>
        ))}

        {chips.length > 0 && (
          <button
            type="button"
            onClick={() => commit({}, 1)}
            className="text-xs text-link hover:underline"
          >
            پاک کردن همه
          </button>
        )}

        {!isPending && (
          <p className="ms-auto text-xs text-fg-muted" aria-live="polite">
            {formatNumber(total)} فاکتور
          </p>
        )}
      </div>

      {isError ? (
        <ErrorState message="فهرست معاملات بارگذاری نشد." onRetry={() => refetch()} />
      ) : (
        <TransactionsTable
          data={data?.items ?? []}
          columns={COLUMNS}
          page={page}
          onPageChange={(next) => commit(filters, next)}
          pageSize={PAGE_SIZE}
          totalRows={total}
          loading={isPending}
          emptyMessage={
            chips.length > 0
              ? "هیچ معامله‌ای با این فیلترها پیدا نشد."
              : "هنوز معامله‌ای ثبت نشده است."
          }
          caption="فهرست معاملات"
          className={
            isFetching && !isPending ? "opacity-60 transition-opacity" : undefined
          }
        />
      )}

      <TransactionFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onApply={applyFilters}
      />
    </section>
  );
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

interface FilterChip {
  key: keyof TransactionFilters;
  label: string;
  value: string;
}

function describeFilters(filters: TransactionFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.customerName) {
    chips.push({ key: "customerName", label: "نام", value: filters.customerName });
  }
  if (filters.customerMobile) {
    chips.push({
      key: "customerMobile",
      label: "موبایل",
      value: filters.customerMobile,
    });
  }
  if (filters.invoiceNumber) {
    chips.push({
      key: "invoiceNumber",
      label: "فاکتور",
      value: filters.invoiceNumber,
    });
  }
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: "dateFrom",
      label: "بازه",
      value: formatJalaliRange(
        filters.dateFrom ?? filters.dateTo!,
        filters.dateTo ?? filters.dateFrom!,
      ),
    });
  }

  return chips;
}

function FilterIcon() {
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
      <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="size-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

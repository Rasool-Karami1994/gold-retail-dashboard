"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Button,
  buttonStyles,
  formatJalaliRange,
  type Column,
} from "@/components/ui";
import {
  TransactionsTable,
  type TransactionColumnId,
} from "@/components/transactions/transactions-table";
import { formatNumber, formatToman } from "@/lib/format";
import { toNumber } from "@/lib/numbers";
import {
  customerTransactionQuery,
  fetchMyTransactions,
  myTransactionKeys,
  type CustomerTransactionFilters,
  type CustomerTransactionRow,
} from "@/lib/transactions-api";
import { customerTransaction } from "../routes";
import { CustomerFiltersModal } from "./filters-modal";

const PAGE_SIZE = 20;

/**
 * The same columns the admin list shows, minus the ones that identify the
 * customer -- on this screen every row is the reader.
 */
const COLUMNS: TransactionColumnId[] = [
  "invoiceNumber",
  "type",
  "goldType",
  "weight",
  "totalAmount",
  "remainingAmount",
  "status",
  "date",
];

/**
 * A customer's own invoice history.
 *
 * Filters live in the URL for the same reason they do on the admin list: a
 * filtered view survives a reload and the back button, and the URL being the
 * single source of truth means the query, the chips and the modal's initial
 * values cannot disagree.
 */
export function MyTransactionsBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const filters = React.useMemo<CustomerTransactionFilters>(
    () => ({
      dateFrom: parseDate(searchParams.get("dateFrom")),
      dateTo: parseDate(searchParams.get("dateTo")),
      minAmount: parseAmount(searchParams.get("minAmount")),
      maxAmount: parseAmount(searchParams.get("maxAmount")),
    }),
    [searchParams],
  );

  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  /** `replace`, not `push`: narrowing one view should not fill the history. */
  const commit = (next: CustomerTransactionFilters, nextPage: number) => {
    const params = new URLSearchParams(customerTransactionQuery(next));
    if (nextPage > 1) params.set("page", String(nextPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const removeFilter = (key: "range" | "minAmount" | "maxAmount") => {
    const next = { ...filters };
    if (key === "range") {
      // One filter to a reader, even though it is two params.
      delete next.dateFrom;
      delete next.dateTo;
    } else {
      delete next[key];
    }
    commit(next, 1);
  };

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: myTransactionKeys.list(filters, page, PAGE_SIZE),
    queryFn: () => fetchMyTransactions(filters, { page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  /**
   * The two actions the shared table has no business knowing about: a link into
   * the CUSTOMER's detail route, and the invoice the API already rendered.
   */
  const extraColumns = React.useMemo<Column<CustomerTransactionRow>[]>(
    () => [
      {
        id: "invoice",
        header: "فاکتور",
        cell: (row) =>
          row.invoicePdfUrl ? (
            <a
              href={row.invoicePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              <DownloadIcon />
              دریافت
            </a>
          ) : (
            // Null means the render never finished. A customer cannot retry it
            // -- that endpoint is admin-only -- so this says so plainly rather
            // than offering a dead button.
            <span className="text-2xs text-fg-muted">آماده نیست</span>
          ),
        align: "center",
        width: "8rem",
      },
      {
        id: "details",
        header: <span className="sr-only">عملیات</span>,
        cell: (row) => (
          <Link
            href={customerTransaction(row.id)}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            جزئیات
          </Link>
        ),
        align: "end",
        width: "6rem",
      },
    ],
    [],
  );

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
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-4 py-12 text-center"
        >
          <p className="text-sm text-fg-secondary">فهرست معاملات بارگذاری نشد.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            تلاش دوباره
          </button>
        </div>
      ) : (
        <TransactionsTable
          data={data?.items ?? []}
          columns={COLUMNS}
          extraColumns={extraColumns}
          page={page}
          onPageChange={(next) => commit(filters, next)}
          pageSize={PAGE_SIZE}
          totalRows={total}
          loading={isPending}
          emptyMessage={
            chips.length > 0
              ? "معامله‌ای با این فیلترها پیدا نشد."
              : "هنوز معامله‌ای برای شما ثبت نشده است."
          }
          caption="فهرست معاملات من"
          className={
            isFetching && !isPending ? "opacity-60 transition-opacity" : undefined
          }
        />
      )}

      <CustomerFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onApply={(next) => commit(next, 1)}
      />
    </section>
  );
}

/** Invalid or absent both mean "no bound", never an Invalid Date in a query. */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseAmount(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const amount = toNumber(value);
  // Negative is not a bound the API accepts; drop it rather than 400.
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

interface FilterChip {
  key: "range" | "minAmount" | "maxAmount";
  label: string;
  value: string;
}

function describeFilters(filters: CustomerTransactionFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: "range",
      label: "بازه",
      value: formatJalaliRange(
        filters.dateFrom ?? filters.dateTo!,
        filters.dateTo ?? filters.dateFrom!,
      ),
    });
  }
  if (filters.minAmount !== undefined) {
    chips.push({ key: "minAmount", label: "از", value: formatToman(filters.minAmount) });
  }
  if (filters.maxAmount !== undefined) {
    chips.push({ key: "maxAmount", label: "تا", value: formatToman(filters.maxAmount) });
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

function DownloadIcon() {
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
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

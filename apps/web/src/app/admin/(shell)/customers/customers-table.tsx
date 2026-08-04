"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  DataTable,
  ErrorState,
  Input,
  buttonStyles,
  type Column,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { customerKeys, fetchCustomers, type CustomerRow } from "@/lib/customers-api";
import { formatNumber, formatToman } from "@/lib/format";
import { customerProfile } from "./routes";

const PAGE_SIZE = 20;

/** Long enough that a normal typing burst is one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * The customer directory table.
 *
 * Search and pagination both run on the server -- `?search=` matches a first
 * name, a last name or a mobile number, so filtering client-side would only
 * ever narrow the current page of 20 and quietly hide matches on page 2.
 * `manual` tells DataTable the rows it is handed are already the page.
 *
 * Columns carry no `sortValue` for the same reason: DataTable's sorting is
 * client-side, and there is no sort parameter on this endpoint, so a sortable
 * header would reorder one page and look broken across the rest.
 */
export function CustomersTable() {
  const [term, setTerm] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Debounce: the input stays instant, the query trails it.
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  // Page 4 of everyone is meaningless once the list is narrowed to "احمدی".
  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: customerKeys.list(page, PAGE_SIZE, search),
    queryFn: () => fetchCustomers({ page, limit: PAGE_SIZE, search: search || undefined }),
    // Keeps the previous page on screen while the next one loads, so paging
    // doesn't collapse the table to skeletons and jump the scroll position.
    placeholderData: keepPreviousData,
  });

  const total = data?.pagination.total ?? 0;

  const columns = React.useMemo<Column<CustomerRow>[]>(
    () => [
      {
        id: "name",
        header: "نام و نام خانوادگی",
        // nowrap so a two-part name stays on one line; the fixed-width columns
        // to its left would otherwise squeeze it into a wrap at narrow widths.
        cell: (row) => (
          <span className="whitespace-nowrap font-medium text-fg">
            {`${row.firstName} ${row.lastName}`.trim()}
          </span>
        ),
      },
      {
        id: "mobile",
        header: "شماره موبایل",
        // dir="ltr" so the leading zero stays on the left; a bare RTL run would
        // render 09123456789 with its digits in the wrong visual order.
        cell: (row) => (
          <span className="font-mono text-xs" dir="ltr">
            {row.mobile}
          </span>
        ),
        width: "10rem",
      },
      {
        id: "transactionCount",
        header: "تعداد معاملات",
        cell: (row) => formatNumber(row.transactionCount),
        align: "center",
        width: "8rem",
      },
      {
        id: "totalPurchased",
        header: "مجموع خرید (تومان)",
        cell: (row) => formatToman(row.totalPurchased),
        align: "end",
        width: "11rem",
        hideOnMobile: true,
      },
      {
        id: "totalSold",
        header: "مجموع فروش (تومان)",
        cell: (row) => formatToman(row.totalSold),
        align: "end",
        width: "11rem",
        hideOnMobile: true,
      },
      {
        id: "actions",
        header: <span className="sr-only">عملیات</span>,
        cell: (row) => (
          <Link
            href={customerProfile(row.id)}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            مشاهده پروفایل
          </Link>
        ),
        align: "end",
        width: "9rem",
      },
    ],
    [],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="جست‌وجو بر اساس نام یا شماره موبایل"
            aria-label="جست‌وجوی مشتری"
            startAdornment={<SearchIcon />}
          />
        </div>

        {!isPending && (
          <p className="text-xs text-fg-muted" aria-live="polite">
            {search ? `${formatNumber(total)} نتیجه` : `${formatNumber(total)} مشتری`}
          </p>
        )}
      </div>

      {isError ? (
        <ErrorState
          message="فهرست مشتریان بارگذاری نشد."
          onRetry={() => refetch()}
        />
      ) : (
        <div
          // Dim rather than blank while a new page or search is in flight --
          // keepPreviousData means the rows below are real, just one step stale.
          className={cn(
            "transition-opacity duration-150",
            isFetching && !isPending && "opacity-60",
          )}
          aria-busy={isFetching || undefined}
        >
          <DataTable
            data={data?.items ?? []}
            columns={columns}
            rowKey={(row) => row.id}
            manual
            page={page}
            onPageChange={setPage}
            pageSize={PAGE_SIZE}
            totalRows={total}
            loading={isPending}
            emptyMessage={
              search
                ? "مشتری‌ای با این مشخصات پیدا نشد."
                : "هنوز مشتری‌ای ثبت نشده است."
            }
            caption="فهرست مشتریان"
          />
        </div>
      )}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

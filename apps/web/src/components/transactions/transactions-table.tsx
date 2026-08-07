"use client";

import * as React from "react";
import Link from "next/link";
import { DataTable, buttonStyles, type Column } from "@/components/ui";
import { formatJalali } from "@/lib/jalali";
import { formatGrams, formatToman } from "@/lib/format";

/**
 * The transaction list, wherever it appears.
 *
 * Three screens show the same rows through different lenses -- the overview's
 * range modal, a customer's history, and (next) /admin/transactions. They
 * differ only in which columns are worth the width, so this owns the rendering
 * of every column and each caller names the ones it wants.
 *
 * It is always server-paginated (`manual`): a busy month is thousands of
 * invoices, and pulling them all to slice locally would be a large response for
 * twenty visible rows. Sorting is deliberately absent for the same reason
 * DataTable's client-side sort is wrong here -- it would reorder one page and
 * leave the rest of the set behind.
 */

export type TransactionKind = "sell" | "buy";
export type TransactionGoldType = "melted" | "new" | "second-hand";
export type TransactionStatus = "open" | "settled";

/**
 * The shape every column here can render. Deliberately narrower than any one
 * endpoint's response, so a row from /stats/transactions and a row from
 * /admin/customers/:id both satisfy it.
 *
 * `customer` is optional because the customer-detail endpoint does not populate
 * it -- on that screen every row is the same person, and the column is left out.
 */
export interface TransactionTableRow {
  id: string;
  invoiceNumber: string;
  type: TransactionKind;
  goldType: TransactionGoldType;
  goldWeightGrams: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: TransactionStatus;
  createdAt: string;
  customer?: { firstName: string; lastName: string; mobile: string } | null;
}

export type TransactionColumnId =
  | "invoiceNumber"
  | "date"
  | "customer"
  | "customerName"
  | "customerMobile"
  | "type"
  | "goldType"
  | "weight"
  | "totalAmount"
  | "paidAmount"
  | "remainingAmount"
  | "status"
  | "details";

/**
 * Hardcoded rather than taken as a prop: there is one transaction detail route
 * in this app, the same way admin-sidebar.tsx owns its own hrefs. A prop would
 * be indirection with a single caller.
 */
const transactionDetail = (id: string) => `/admin/transactions/${id}`;
const addPaymentHref = (id: string) => `/admin/transactions/${id}/add-payment`;

const TYPE_LABELS: Record<TransactionKind, string> = {
  sell: "فروش",
  buy: "خرید",
};

const GOLD_TYPE_LABELS: Record<TransactionGoldType, string> = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست‌دوم",
};

const COLUMNS: Record<TransactionColumnId, Column<TransactionTableRow>> = {
  invoiceNumber: {
    id: "invoiceNumber",
    header: "شماره فاکتور",
    // dir="ltr" so INV-20260803-0001 keeps its parts in order inside an RTL row,
    // and nowrap so it never breaks at its hyphens into a three-line cell.
    cell: (row) => (
      <span className="whitespace-nowrap font-mono text-2xs" dir="ltr">
        {row.invoiceNumber}
      </span>
    ),
    width: "11rem",
  },

  date: {
    id: "date",
    header: "تاریخ",
    cell: (row) => (
      <span className="whitespace-nowrap tabular-nums">
        {formatJalali(new Date(row.createdAt))}
      </span>
    ),
    width: "7.5rem",
  },

  /** Name over mobile in one cell, for narrow contexts like the modal. */
  customer: {
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

  /** Split from the mobile, for a wide list that can afford both columns. */
  customerName: {
    id: "customerName",
    header: "مشتری",
    cell: (row) =>
      row.customer ? (
        <span className="whitespace-nowrap">
          {`${row.customer.firstName} ${row.customer.lastName}`.trim()}
        </span>
      ) : (
        // The API populates this, so null means the customer row is gone --
        // worth saying rather than rendering a blank cell.
        <span className="text-fg-muted">حذف‌شده</span>
      ),
  },

  customerMobile: {
    id: "customerMobile",
    header: "شماره موبایل",
    cell: (row) =>
      row.customer ? (
        <span className="font-mono text-xs" dir="ltr">
          {row.customer.mobile}
        </span>
      ) : (
        <span className="text-fg-muted">—</span>
      ),
    width: "10rem",
  },

  type: {
    id: "type",
    header: "نوع",
    cell: (row) => (
      <span
        className={
          row.type === "sell"
            ? "rounded-full bg-warning/12 px-2 py-0.5 text-2xs text-warning"
            : "rounded-full bg-success/12 px-2 py-0.5 text-2xs text-success"
        }
      >
        {TYPE_LABELS[row.type]}
      </span>
    ),
    width: "5.5rem",
  },

  goldType: {
    id: "goldType",
    header: "نوع طلا",
    cell: (row) => GOLD_TYPE_LABELS[row.goldType],
    width: "6rem",
    hideOnMobile: true,
  },

  weight: {
    id: "weight",
    header: "وزن (گرم)",
    cell: (row) => formatGrams(row.goldWeightGrams),
    align: "end",
    width: "7rem",
  },

  totalAmount: {
    id: "totalAmount",
    header: "مبلغ کل",
    cell: (row) => formatToman(row.totalAmount),
    align: "end",
    width: "9rem",
  },

  paidAmount: {
    id: "paidAmount",
    header: "پرداخت‌شده",
    cell: (row) => formatToman(row.paidAmount),
    align: "end",
    width: "9rem",
    hideOnMobile: true,
  },

  remainingAmount: {
    id: "remainingAmount",
    header: "مانده",
    /**
     * Reads `status`, not `remainingAmount === 0`. Amounts are floats and the
     * model settles within a tolerance, so a transaction can be settled with a
     * few rials of rounding dust left on it -- comparing to zero here would
     * print that dust as an outstanding debt. `status` is the model's own
     * verdict, computed with that tolerance.
     */
    cell: (row) =>
      row.status === "settled" ? (
        <span className="text-success">تسویه</span>
      ) : (
        <span className="text-danger">{formatToman(row.remainingAmount)}</span>
      ),
    align: "end",
    width: "9rem",
  },

  status: {
    id: "status",
    header: "وضعیت",
    cell: (row) => (
      <span
        className={
          row.status === "settled"
            ? "rounded-full bg-success/12 px-2 py-0.5 text-2xs text-success"
            : "rounded-full bg-danger/12 px-2 py-0.5 text-2xs text-danger"
        }
      >
        {row.status === "settled" ? "تسویه‌شده" : "باز"}
      </span>
    ),
    width: "6.5rem",
  },

  details: {
    id: "details",
    header: <span className="sr-only">عملیات</span>,
    cell: (row) => (
      <span className="flex items-center justify-end gap-2">
        {/*
          Only on an open invoice, and absent rather than disabled on a settled
          one: a greyed-out button invites the question "why can't I?", where
          nothing at all reads as "there is nothing left to pay" -- which the
          status badge in the same row already says.
        */}
        {row.status === "open" && (
          <Link
            href={addPaymentHref(row.id)}
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            ثبت پرداخت
          </Link>
        )}
        <Link
          href={transactionDetail(row.id)}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          جزئیات
        </Link>
      </span>
    ),
    align: "end",
    width: "13rem",
  },
};

/** What the overview modal has always shown. */
const DEFAULT_COLUMNS: TransactionColumnId[] = [
  "invoiceNumber",
  "customer",
  "type",
  "goldType",
  "weight",
  "totalAmount",
  "remainingAmount",
];

export interface TransactionsTableProps<T extends TransactionTableRow> {
  data: T[];
  /** Column ids, in display order. */
  columns?: TransactionColumnId[];
  /**
   * Appended after the selected ids, for columns this component has no business
   * knowing about -- the customer area's own detail link and invoice download,
   * which point at different routes and read fields off a wider row than the
   * shared shape. Generic in `T` so those columns can see those fields.
   */
  extraColumns?: Column<T>[];
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalRows: number;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  caption?: string;
  className?: string;
}

export function TransactionsTable<T extends TransactionTableRow>({
  data,
  columns = DEFAULT_COLUMNS,
  extraColumns,
  page,
  onPageChange,
  pageSize,
  totalRows,
  loading,
  emptyMessage = "معامله‌ای ثبت نشده است.",
  caption = "فهرست معاملات",
  className,
}: TransactionsTableProps<T>) {
  const selected = React.useMemo(
    // A column that reads only the shared fields is safe on any row that
    // extends them, which is why the widening here needs no runtime work.
    () => [
      ...columns.map((id) => COLUMNS[id] as Column<T>),
      ...(extraColumns ?? []),
    ],
    [columns, extraColumns],
  );

  return (
    <DataTable
      data={data}
      columns={selected}
      rowKey={(row) => row.id}
      // Server-driven: the API already sliced and ordered this page.
      manual
      page={page}
      onPageChange={onPageChange}
      pageSize={pageSize}
      totalRows={totalRows}
      loading={loading}
      emptyMessage={emptyMessage}
      caption={caption}
      className={className}
    />
  );
}

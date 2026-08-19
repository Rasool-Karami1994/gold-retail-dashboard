"use client";

import * as React from "react";
import Link from "next/link";
import { DataTable, buttonStyles, type Column } from "@/components/ui";
import { formatJalali } from "@/lib/jalali";
import { formatGrams, formatToman } from "@/lib/format";

export type TransactionKind = "sell" | "buy";
export type TransactionGoldType = "melted" | "new" | "second-hand";
export type TransactionStatus = "open" | "settled";

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

  customerName: {
    id: "customerName",
    header: "مشتری",
    cell: (row) =>
      row.customer ? (
        <span className="whitespace-nowrap">
          {`${row.customer.firstName} ${row.customer.lastName}`.trim()}
        </span>
      ) : (
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
  columns?: TransactionColumnId[];
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

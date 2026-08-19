"use client";

import * as React from "react";
import { DataTable, formatJalali, type Column } from "@/components/ui";
import { formatToman } from "@/lib/format";
import type { TransactionPayment } from "@/lib/transactions-api";

const METHOD_LABELS = { cash: "نقدی", bank: "بانکی" } as const;

const BANK_TYPE_LABELS = {
  paya: "پایا",
  "card-to-card": "کارت به کارت",
  bridge: "پل",
  satna: "ساتنا",
} as const;

export interface PaymentsListProps {
  payments: TransactionPayment[];
  title?: React.ReactNode;
  emptyMessage?: React.ReactNode;
}

export function PaymentsList({
  payments,
  title = "پرداخت‌ها",
  emptyMessage = "پرداختی برای این فاکتور ثبت نشده است.",
}: PaymentsListProps) {
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
        <h2 className="text-sm font-bold text-fg-secondary">{title}</h2>
        {payments.length > 0 && (
          <p className="text-xs text-fg-muted">
            مجموع {formatToman(payments.reduce((sum, p) => sum + p.amount, 0))} تومان
          </p>
        )}
      </div>

      <DataTable
        data={payments}
        columns={columns}
        rowKey={(row, index) => `${row.paidAt}-${index}`}
        paginated={false}
        emptyMessage={emptyMessage}
        caption="فهرست پرداخت‌های فاکتور"
      />
    </section>
  );
}

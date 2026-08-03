"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  DataTable,
  Modal,
  formatJalaliRange,
  type Column,
  type DateRange,
} from "@/components/ui";
import {
  fetchTransactions,
  statsKeys,
  type TransactionRow,
} from "@/lib/stats-api";
import { formatGrams, formatToman } from "@/lib/format";

/**
 * The transactions behind the two charts, for the same range.
 *
 * Paginated on the server rather than in the table: a busy month is thousands
 * of invoices, and pulling them all to slice locally would be a slow modal and
 * a large response for twenty visible rows.
 */

const PAGE_SIZE = 10;

const TYPE_LABELS: Record<TransactionRow["type"], string> = {
  sell: "فروش",
  buy: "خرید",
};

const GOLD_TYPE_LABELS: Record<TransactionRow["goldType"], string> = {
  melted: "آب‌شده",
  new: "نو",
  "second-hand": "دست‌دوم",
};

export function TransactionsModal({
  open,
  onClose,
  range,
}: {
  open: boolean;
  onClose: () => void;
  range: DateRange;
}) {
  const [page, setPage] = React.useState(1);

  // A new range makes the current page number meaningless -- page 4 of the
  // previous filter may not exist in this one.
  React.useEffect(() => {
    setPage(1);
  }, [range.from, range.to]);

  const { data, isFetching } = useQuery({
    queryKey: statsKeys.transactions(range, page, PAGE_SIZE),
    queryFn: () => fetchTransactions(range, { page, limit: PAGE_SIZE }),
    // Don't fetch a list nobody is looking at.
    enabled: open,
    // Keep the previous page on screen while the next loads, so the table
    // doesn't collapse to an empty state and shove the modal's height around.
    placeholderData: keepPreviousData,
  });

  const columns = React.useMemo<Column<TransactionRow>[]>(
    () => [
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
      {
        id: "goldType",
        header: "نوع طلا",
        cell: (row) => GOLD_TYPE_LABELS[row.goldType],
        width: "6rem",
        hideOnMobile: true,
      },
      {
        id: "goldWeightGrams",
        header: "وزن (گرم)",
        cell: (row) => formatGrams(row.goldWeightGrams),
        align: "end",
        width: "7rem",
      },
      {
        id: "totalAmount",
        header: "مبلغ کل",
        cell: (row) => formatToman(row.totalAmount),
        align: "end",
        width: "9rem",
      },
      {
        id: "remainingAmount",
        header: "مانده",
        cell: (row) =>
          row.remainingAmount === 0 ? (
            <span className="text-success">تسویه</span>
          ) : (
            <span className="text-danger">{formatToman(row.remainingAmount)}</span>
          ),
        align: "end",
        width: "9rem",
      },
    ],
    [],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="جزئیات معاملات"
      description={formatJalaliRange(range.from, range.to)}
    >
      <DataTable
        data={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        // Server-driven: the API already sliced and ordered this page.
        manual
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        totalRows={data?.pagination.total ?? 0}
        // `isFetching`, not `isPending`: the query is disabled while the modal
        // is shut, which leaves it pending forever and renders a screenful of
        // skeleton rows inside a closed dialog.
        loading={isFetching}
        emptyMessage="در این بازه معامله‌ای ثبت نشده است."
        caption="فهرست معاملات بازه‌ی انتخاب‌شده"
      />
    </Modal>
  );
}

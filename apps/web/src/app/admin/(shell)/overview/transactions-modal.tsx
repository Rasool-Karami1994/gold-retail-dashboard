"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ErrorState, Modal, formatJalaliRange, type DateRange } from "@/components/ui";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { fetchTransactions, transactionKeys } from "@/lib/transactions-api";

/**
 * The transactions behind the two charts, for the same range.
 *
 * Paginated on the server rather than in the table: a busy month is thousands
 * of invoices, and pulling them all to slice locally would be a slow modal and
 * a large response for twenty visible rows.
 *
 * The columns live in TransactionsTable, shared with the customer history --
 * this takes its default set, which is what it rendered before the extraction.
 */

const PAGE_SIZE = 10;

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

  // The same endpoint /admin/transactions reads, with only the range filled in.
  const filters = React.useMemo(
    () => ({ dateFrom: range.from, dateTo: range.to }),
    [range.from, range.to],
  );

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: transactionKeys.list(filters, page, PAGE_SIZE),
    queryFn: () => fetchTransactions(filters, { page, limit: PAGE_SIZE }),
    // Don't fetch a list nobody is looking at.
    enabled: open,
    // Keep the previous page on screen while the next loads, so the table
    // doesn't collapse to an empty state and shove the modal's height around.
    placeholderData: keepPreviousData,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="جزئیات معاملات"
      description={formatJalaliRange(range.from, range.to)}
    >
      {isError ? (
        <ErrorState
          message="فهرست معاملات بارگذاری نشد."
          onRetry={() => refetch()}
        />
      ) : (
        <TransactionsTable
          data={data?.items ?? []}
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
      )}
    </Modal>
  );
}

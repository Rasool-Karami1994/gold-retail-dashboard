"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ErrorState, Modal, formatJalaliRange, type DateRange } from "@/components/ui";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { fetchTransactions, transactionKeys } from "@/lib/transactions-api";

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

  React.useEffect(() => {
    setPage(1);
  }, [range.from, range.to]);

  const filters = React.useMemo(
    () => ({ dateFrom: range.from, dateTo: range.to }),
    [range.from, range.to],
  );

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: transactionKeys.list(filters, page, PAGE_SIZE),
    queryFn: () => fetchTransactions(filters, { page, limit: PAGE_SIZE }),
    enabled: open,
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
          loading={isFetching}
          emptyMessage="در این بازه معامله‌ای ثبت نشده است."
          caption="فهرست معاملات بازه‌ی انتخاب‌شده"
        />
      )}
    </Modal>
  );
}

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, StatCard } from "@/components/ui";
import { formatGrams, formatToman } from "@/lib/format";
import {
  fetchDebtCreditAmount,
  fetchDebtCreditGrams,
  statsKeys,
} from "@/lib/stats-api";
import { OpenTransactionsModal } from "./open-transactions-modal";

const DEBT_COLOR = "#ef4444";
const CREDIT_COLOR = "#f97316";

export function BalanceSection({ unit }: { unit: "amount" | "grams" }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const amount = useQuery({
    queryKey: statsKeys.debtCreditAmount(),
    queryFn: fetchDebtCreditAmount,
    enabled: unit === "amount",
  });

  const grams = useQuery({
    queryKey: statsKeys.debtCreditGrams(),
    queryFn: fetchDebtCreditGrams,
    enabled: unit === "grams",
  });

  const query = unit === "amount" ? amount : grams;

  const debt =
    unit === "amount"
      ? (amount.data?.customerDebtToShop ?? 0)
      : (grams.data?.customerDebtToShopGrams ?? 0);

  const credit =
    unit === "amount"
      ? (amount.data?.shopDebtToCustomer ?? 0)
      : (grams.data?.shopDebtToCustomerGrams ?? 0);

  const format = unit === "amount" ? formatToman : formatGrams;
  const unitLabel = unit === "amount" ? "تومان" : "گرم";

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="بدهی مشتریان به فروشگاه"
          description={`فاکتورهای فروش تسویه‌نشده (${unitLabel})`}
          value={debt}
          format={format}
          unit={unitLabel}
          tone="danger"
          icon={<ArrowInIcon />}
          loading={query.isPending}
          error={query.isError}
          onRetry={() => query.refetch()}
        />

        <StatCard
          title="بدهی فروشگاه به مشتریان"
          description={`فاکتورهای خرید تسویه‌نشده (${unitLabel})`}
          value={credit}
          format={format}
          unit={unitLabel}
          tone="warning"
          icon={<ArrowOutIcon />}
          loading={query.isPending}
          error={query.isError}
          onRetry={() => query.refetch()}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <NetPosition
          debt={debt}
          credit={credit}
          format={format}
          unitLabel={unitLabel}
          loading={query.isPending}
        />

        <Button variant="secondary" onClick={() => setDetailsOpen(true)}>
          مشاهده جزئیات
        </Button>
      </div>

      <OpenTransactionsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        unit={unit}
      />
    </section>
  );
}

function ArrowInIcon() {
  return (
    <Icon>
      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </Icon>
  );
}

function ArrowOutIcon() {
  return (
    <Icon>
      <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
    </Icon>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function NetPosition({
  debt,
  credit,
  format,
  unitLabel,
  loading,
}: {
  debt: number;
  credit: number;
  format: (n: number) => string;
  unitLabel: string;
  loading: boolean;
}) {
  if (loading) {
    return <span className="h-5 w-56 animate-pulse rounded bg-surface-raised" />;
  }

  const net = debt - credit;
  const settled = Math.abs(net) < 0.5;

  return (
    <p className="text-sm text-fg-secondary">
      خالص:{" "}
      {settled ? (
        <span className="font-medium text-success">تراز است</span>
      ) : (
        <>
          <span
            className="font-medium tabular-nums"
            style={{ color: net > 0 ? DEBT_COLOR : CREDIT_COLOR }}
          >
            {format(Math.abs(net))} {unitLabel}
          </span>{" "}
          <span className="text-fg-muted">
            {net > 0 ? "به سود فروشگاه" : "به سود مشتریان"}
          </span>
        </>
      )}
    </p>
  );
}

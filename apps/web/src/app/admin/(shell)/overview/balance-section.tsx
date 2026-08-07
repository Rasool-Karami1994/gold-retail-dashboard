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

/**
 * Sections 2 and 3: what is outstanding right now.
 *
 * One component, used twice -- the two sections differ only in unit, so the
 * layout, the queries' shape and the modal are identical. Splitting them into
 * two files would be the same 150 lines twice.
 *
 * No date filter, deliberately: these are running totals. A debt raised last
 * year is still owed today, and filtering it out because it falls outside "this
 * month" would understate the balance. The API refuses a range on these two
 * endpoints for the same reason.
 *
 * WHICH IS ALSO WHY THESE ARE StatCards, NOT CHARTS. A figure with no axis to
 * vary over has nothing to plot: the single bar these used to draw always
 * filled its plot area, so it carried no information the number above it did
 * not already give, and cost a chart's height to say so.
 */

/** Customers owe the shop -- a receivable. */
const DEBT_COLOR = "#ef4444"; // danger
/** The shop owes customers -- a payable. */
const CREDIT_COLOR = "#f97316"; // warning

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
      {/* Side by side from `sm`: the two are a pair -- one direction of the
          ledger each -- and reading them against each other is the point. */}
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

/**
 * Direction icons, standing in for the colour a chart legend used to carry.
 *
 * Into the shop for money owed to it, out of the shop for money it owes -- the
 * arrow says which way the debt points without relying on colour alone.
 */
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

/**
 * Net position across the two directions.
 *
 * Shown because the two figures above cannot simply be added -- they point in
 * opposite directions, so the only meaningful summary is the difference, and
 * which side it favours.
 */
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

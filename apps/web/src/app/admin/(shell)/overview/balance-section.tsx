"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { Button, ChartCard } from "@/components/ui";
import { chartColors, tooltipProps } from "@/lib/chart-theme";
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

  /**
   * THE REASON BOTH CARDS SHARE A SCALE.
   *
   * A chart with one bar auto-scales its axis to that bar, so the bar always
   * fills the plot area. Two independent single-bar cards would therefore
   * render identical full-width bars whether the figures were 13M and 16M or
   * 13M and 500. The picture would contradict the numbers printed above it.
   *
   * Pinning both to the larger of the two makes their lengths mean something:
   * the shorter bar is visibly shorter, in proportion.
   */
  const domainMax = Math.max(debt, credit, 1);

  const empty = query.isSuccess && debt === 0 && credit === 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="بدهی مشتریان به فروشگاه"
          description={`فاکتورهای فروش تسویه‌نشده (${unitLabel})`}
          showFilter={false}
          actions={
            <Figure value={debt} format={format} color={DEBT_COLOR} loading={query.isPending} />
          }
          loading={query.isPending}
          empty={empty}
          emptyMessage="بدهی تسویه‌نشده‌ای وجود ندارد."
          height={120}
        >
          <SingleBar
            value={debt}
            max={domainMax}
            color={DEBT_COLOR}
            format={format}
            unitLabel={unitLabel}
          />
        </ChartCard>

        <ChartCard
          title="بدهی فروشگاه به مشتریان"
          description={`فاکتورهای خرید تسویه‌نشده (${unitLabel})`}
          showFilter={false}
          actions={
            <Figure value={credit} format={format} color={CREDIT_COLOR} loading={query.isPending} />
          }
          loading={query.isPending}
          empty={empty}
          emptyMessage="بدهی تسویه‌نشده‌ای وجود ندارد."
          height={120}
        >
          <SingleBar
            value={credit}
            max={domainMax}
            color={CREDIT_COLOR}
            format={format}
            unitLabel={unitLabel}
          />
        </ChartCard>
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

/** The headline number, in the card header where a KPI belongs. */
function Figure({
  value,
  format,
  color,
  loading,
}: {
  value: number;
  format: (n: number) => string;
  color: string;
  loading: boolean;
}) {
  if (loading) {
    return <span className="h-7 w-28 animate-pulse rounded bg-surface-raised" />;
  }
  return (
    <span className="text-xl font-bold tabular-nums" style={{ color }}>
      {format(value)}
    </span>
  );
}

/**
 * One horizontal bar on a caller-supplied scale.
 *
 * A plain function, not a component: ChartCard hands its child straight to
 * Recharts' <ResponsiveContainer>, which measures a chart element and will not
 * measure a wrapper.
 */
function SingleBar({
  value,
  max,
  color,
  format,
  unitLabel,
}: {
  value: number;
  max: number;
  color: string;
  format: (n: number) => string;
  unitLabel: string;
}) {
  return (
    <BarChart
      layout="vertical"
      data={[{ name: "", value }]}
      margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
    >
      {/* Axes are hidden: the figure is printed in the header, and the bar's
          job here is proportion, not precise reading. */}
      <XAxis type="number" domain={[0, max]} hide />
      <YAxis type="category" dataKey="name" hide />
      <Tooltip
        {...tooltipProps}
        cursor={{ fill: chartColors.grid, opacity: 0.3 }}
        formatter={(v) => [`${format(Number(v))} ${unitLabel}`, ""]}
      />
      <Bar dataKey="value" fill={color} radius={6} barSize={40} />
    </BarChart>
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

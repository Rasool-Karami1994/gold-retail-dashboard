"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Button,
  ChartCard,
  rangeForPreset,
  type DateRange,
} from "@/components/ui";
import {
  chartColors,
  gridProps,
  rtlAxisProps,
  tooltipProps,
} from "@/lib/chart-theme";
import { formatCompactToman, formatGrams, formatToman } from "@/lib/format";
import { fetchAmount, fetchVolume, statsKeys } from "@/lib/stats-api";
import { TransactionsModal } from "./transactions-modal";

/**
 * Section 1 of the overview: what moved during a period.
 *
 * The range lives here, not inside either card, so the two charts and the
 * detail modal always describe the same window. Each ChartCard renders its own
 * filter but both are controlled by this one value -- changing either updates
 * both, which is the point of lifting it.
 */

const SOLD = "#4c5bf5"; // primary  -- gold the shop sold
const BOUGHT = "#34d399"; // success -- gold the shop bought in

interface Datum {
  label: string;
  value: number;
  fill: string;
}

export function VolumeAmountSection() {
  // `rangeForPreset` builds on the Persian calendar, so "this month" means the
  // current Jalali month, not the Gregorian one.
  const [range, setRange] = React.useState<DateRange>(() =>
    rangeForPreset("month"),
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const volume = useQuery({
    queryKey: statsKeys.volume(range),
    queryFn: () => fetchVolume(range),
  });

  const amount = useQuery({
    queryKey: statsKeys.amount(range),
    queryFn: () => fetchAmount(range),
  });

  /**
   * Both endpoints return one pair of totals for the whole range, not a series
   * over time -- so this is a two-bar comparison, which is what the data
   * actually supports. A trend line would need a grouped-by-day variant of the
   * endpoint; see the note in the response summary.
   */
  const volumeData: Datum[] = [
    { label: "فروش", value: volume.data?.soldGrams ?? 0, fill: SOLD },
    { label: "خرید", value: volume.data?.boughtGrams ?? 0, fill: BOUGHT },
  ];

  const amountData: Datum[] = [
    { label: "فروش", value: amount.data?.soldAmount ?? 0, fill: SOLD },
    { label: "خرید", value: amount.data?.boughtAmount ?? 0, fill: BOUGHT },
  ];

  // "No data" is a period with nothing in it, not a period that is still
  // loading -- otherwise the empty state flashes on every range change.
  const volumeEmpty =
    volume.isSuccess && volumeData.every((datum) => datum.value === 0);
  const amountEmpty =
    amount.isSuccess && amountData.every((datum) => datum.value === 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="حجم معاملات"
          description="وزن طلای خرید و فروش‌شده (گرم)"
          range={range}
          onRangeChange={setRange}
          loading={volume.isPending}
          empty={volumeEmpty}
          error={volume.isError}
          onRetry={() => volume.refetch()}
          height={260}
        >
          <ComparisonBars data={volumeData} format={formatGrams} unit="گرم" />
        </ChartCard>

        <ChartCard
          title="مبلغ معاملات"
          description="ارزش ریالی خرید و فروش (تومان)"
          range={range}
          onRangeChange={setRange}
          loading={amount.isPending}
          empty={amountEmpty}
          error={amount.isError}
          onRetry={() => amount.refetch()}
          height={260}
        >
          <ComparisonBars
            data={amountData}
            format={formatToman}
            tickFormat={formatCompactToman}
            unit="تومان"
          />
        </ChartCard>
      </div>

      <div className="flex justify-start">
        <Button variant="secondary" onClick={() => setDetailsOpen(true)}>
          مشاهده جزئیات معاملات
        </Button>
      </div>

      <TransactionsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        range={range}
      />
    </section>
  );
}

/**
 * Two bars, sell against buy.
 *
 * Written as a plain function rather than a component: ChartCard puts its
 * child straight inside Recharts' <ResponsiveContainer>, which requires a
 * chart element as its direct child and will not measure a wrapper component.
 */
function ComparisonBars({
  data,
  format,
  tickFormat,
  unit,
}: {
  data: Datum[];
  format: (value: number) => string;
  tickFormat?: (value: number) => string;
  unit: string;
}) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey="label" {...rtlAxisProps.x} />
      <YAxis
        {...rtlAxisProps.y}
        tickFormatter={tickFormat ?? format}
        width={72}
      />
      <Tooltip
        {...tooltipProps}
        cursor={{ fill: chartColors.grid, opacity: 0.4 }}
        formatter={(value) => [`${format(Number(value))} ${unit}`, ""]}
      />
      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={96}>
        {/* Per-bar colour: one series, two categories that mean opposite
            things, so they must not share a hue. */}
        {data.map((datum) => (
          <Cell key={datum.label} fill={datum.fill} />
        ))}
      </Bar>
    </BarChart>
  );
}

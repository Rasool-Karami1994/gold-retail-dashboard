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

const SOLD = "#4c5bf5";
const BOUGHT = "#34d399";

interface Datum {
  label: string;
  value: number;
  fill: string;
}

export function VolumeAmountSection() {
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

  const volumeData: Datum[] = [
    { label: "فروش", value: volume.data?.soldGrams ?? 0, fill: SOLD },
    { label: "خرید", value: volume.data?.boughtGrams ?? 0, fill: BOUGHT },
  ];

  const amountData: Datum[] = [
    { label: "فروش", value: amount.data?.soldAmount ?? 0, fill: SOLD },
    { label: "خرید", value: amount.data?.boughtAmount ?? 0, fill: BOUGHT },
  ];

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
      <YAxis {...rtlAxisProps.y} tickFormatter={tickFormat ?? format} />
      <Tooltip
        {...tooltipProps}
        cursor={{ fill: chartColors.grid, opacity: 0.4 }}
        formatter={(value) => [`${format(Number(value))} ${unit}`, ""]}
      />
      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={96}>
        {data.map((datum) => (
          <Cell key={datum.label} fill={datum.fill} />
        ))}
      </Bar>
    </BarChart>
  );
}

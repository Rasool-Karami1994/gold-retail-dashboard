"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, gridProps, rtlAxisProps } from "@/lib/chart-theme";
import { formatGrams, formatToman } from "@/lib/format";
import { formatJalali, fromApiDate } from "@/lib/jalali";
import type { CapitalPoint, Granularity } from "@/lib/capital-api";

export interface CapitalDatum {
  label: string;
  capitalGrams: number;
  estimated: boolean;
  pricePerGram: number;
  goldGrams: number;
  cash: number;
}

const LINE = "#4c5bf5";
const ESTIMATED = "#f97316";

export function toChartData(
  series: CapitalPoint[],
  granularity: Granularity,
): CapitalDatum[] {
  const format = granularity === "month" ? "YYYY/MM" : "MM/DD";

  return series.map((point) => ({
    label: formatJalali(fromApiDate(point.day), format),
    capitalGrams: point.capitalGrams,
    estimated: point.estimated,
    pricePerGram: point.pricePerGram,
    goldGrams: point.goldGrams,
    cash: point.cash,
  }));
}

export function CapitalLine({ data }: { data: CapitalDatum[] }) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey="label" {...rtlAxisProps.x} minTickGap={24} />
      <YAxis
        {...rtlAxisProps.y}
        domain={["auto", "auto"]}
        tickFormatter={formatGrams}
      />
      <Tooltip
        content={<CapitalTooltip />}
        cursor={{ stroke: chartColors.grid, strokeWidth: 1 }}
      />
      <Line
        type="monotone"
        dataKey="capitalGrams"
        stroke={LINE}
        strokeWidth={2}
        dot={<CapitalDot />}
        activeDot={{ r: 5, fill: LINE, stroke: chartColors.tooltipBg, strokeWidth: 2 }}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

function CapitalDot(props: {
  cx?: number;
  cy?: number;
  payload?: CapitalDatum;
  index?: number;
}) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;

  return payload.estimated ? (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill={chartColors.tooltipBg}
      stroke={ESTIMATED}
      strokeWidth={2}
    />
  ) : (
    <circle cx={cx} cy={cy} r={3} fill={LINE} stroke="none" />
  );
}

function CapitalTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: CapitalDatum }[];
  label?: string;
}) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;

  return (
    <div
      dir="rtl"
      className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-xs shadow-lg"
    >
      <p className="mb-1.5 text-fg-muted">{label}</p>
      <p className="text-sm font-bold text-fg">
        {formatGrams(datum.capitalGrams)} گرم
      </p>
      <dl className="mt-1.5 flex flex-col gap-0.5 text-fg-secondary">
        <div className="flex items-center gap-2">
          <dt className="text-fg-muted">طلای فیزیکی:</dt>
          <dd>{formatGrams(datum.goldGrams)} گرم</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-fg-muted">قیمت هر گرم:</dt>
          <dd>{formatToman(datum.pricePerGram)} تومان</dd>
        </div>
      </dl>
      {datum.estimated && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-2xs text-warning">
          برآوردی — برای این روز قیمتی ثبت نشده و آخرین قیمت پیشین استفاده شده
          است.
        </p>
      )}
    </div>
  );
}

export function EstimatedLegend() {
  return (
    <div className="flex items-center gap-3 text-2xs text-fg-muted">
      <span className="flex items-center gap-1.5">
        <svg className="size-2.5" viewBox="0 0 10 10" aria-hidden="true">
          <circle cx="5" cy="5" r="4" fill={LINE} />
        </svg>
        اندازه‌گیری‌شده
      </span>
      <span className="flex items-center gap-1.5">
        <svg className="size-2.5" viewBox="0 0 10 10" aria-hidden="true">
          <circle
            cx="5"
            cy="5"
            r="3.5"
            fill="none"
            stroke={ESTIMATED}
            strokeWidth="2"
          />
        </svg>
        برآوردی
      </span>
    </div>
  );
}

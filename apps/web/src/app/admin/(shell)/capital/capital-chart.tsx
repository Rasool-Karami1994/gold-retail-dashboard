"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, gridProps, rtlAxisProps } from "@/lib/chart-theme";
import { formatGrams, formatToman } from "@/lib/format";
import { formatJalali, fromApiDate } from "@/lib/jalali";
import type { CapitalPoint, Granularity } from "@/lib/capital-api";

/**
 * Capital in grams over time.
 *
 * MEASURED VERSUS ESTIMATED POINTS. A day with no recorded gold price is
 * valued at the last price on record, which makes its figure an estimate --
 * the metal is exact, the cash's gram equivalent is not. Drawn as a hollow
 * ring against a filled dot, so the difference is visible without reading the
 * tooltip, and named in the legend so the shape means something.
 *
 * The line itself is not split into measured and estimated segments: a
 * Recharts `<Line>` is one path with one stroke, so that would mean two series
 * with holes in each and a legend nobody asked for. The points carry the
 * distinction, which is where it actually belongs -- it is the point that is
 * estimated, not the interval between two of them.
 */

export interface CapitalDatum {
  label: string;
  capitalGrams: number;
  estimated: boolean;
  pricePerGram: number;
  goldGrams: number;
  cash: number;
}

const LINE = "#4c5bf5"; // primary
const ESTIMATED = "#f97316"; // warning

/** Bucket label: a day needs the day, a month does not. */
export function toChartData(
  series: CapitalPoint[],
  granularity: Granularity,
): CapitalDatum[] {
  const format = granularity === "month" ? "YYYY/MM" : "MM/DD";

  return series.map((point) => ({
    // `point.day`, not `point.date`: the bucket start is a calendar day, and
    // reading its instant through the browser's timezone moves the label.
    label: formatJalali(fromApiDate(point.day), format),
    capitalGrams: point.capitalGrams,
    estimated: point.estimated,
    pricePerGram: point.pricePerGram,
    goldGrams: point.goldGrams,
    cash: point.cash,
  }));
}

/**
 * Written as a plain function, not a component: ChartCard puts its child
 * straight inside Recharts' <ResponsiveContainer>, which requires a chart
 * element as its direct child and will not measure a wrapper.
 */
export function CapitalLine({ data }: { data: CapitalDatum[] }) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey="label" {...rtlAxisProps.x} minTickGap={24} />
      {/*
        `["auto", "auto"]` rather than Recharts' default, which anchors the axis
        at zero. A shop's capital sits around a large number and moves by a few
        percent -- anchored at zero, that is a flat line across the top of the
        card and the whole point of the chart is lost.
      */}
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
        // A single point has no line to draw, so it has to be visible as a dot.
        dot={<CapitalDot />}
        activeDot={{ r: 5, fill: LINE, stroke: chartColors.tooltipBg, strokeWidth: 2 }}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

/**
 * Recharts clones this with `cx`/`cy`/`payload`, so the props are partial by
 * nature -- it is never rendered by hand.
 */
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
      // Hollow: the ring reads as "outline of a value" rather than a value.
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
    // Recharts renders the tooltip in a plain div outside the RTL flow.
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

/** Sits in the chart card's header, where it explains the two dot shapes. */
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

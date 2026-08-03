"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/cn";
import { Card } from "./card";
import { DateRangeFilter } from "./date-range-filter";
import type { DateRange, DateRangePreset } from "@/lib/jalali";

/**
 * A titled card with a date-range filter in its header and a Recharts chart in
 * its body.
 *
 * The chart itself is passed as `children` rather than being described by
 * props: Recharts composes through JSX (`<Bar>`, `<Line>`, `<XAxis>`…), and
 * wrapping that in a config object would mean re-implementing its whole API to
 * expose a fraction of it. The card supplies the frame, the responsive sizing
 * and the range state; the caller supplies the chart.
 *
 * Chart styling lives in lib/chart-theme.ts -- spread `rtlAxisProps.x` /
 * `.y` onto your axes so they read right-to-left.
 */

export interface ChartCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra header content, placed before the filter. */
  actions?: React.ReactNode;

  /** Controlled range. Omit to let the card own it. */
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  defaultPreset?: Exclude<DateRangePreset, "custom">;
  /** Hides the built-in filter, for charts that aren't time-series. */
  showFilter?: boolean;

  /** Chart height in px. Width always fills the card. */
  height?: number;
  loading?: boolean;
  /** Shown instead of the chart when there's nothing to plot. */
  empty?: boolean;
  emptyMessage?: React.ReactNode;

  children: React.ReactElement;
  className?: string;
}

export function ChartCard({
  title,
  description,
  actions,
  range,
  onRangeChange,
  defaultPreset = "month",
  showFilter = true,
  height = 280,
  loading = false,
  empty = false,
  emptyMessage = "داده‌ای برای نمایش وجود ندارد.",
  children,
  className,
}: ChartCardProps) {
  return (
    /**
     * `@container` makes the header respond to the CARD's width, not the
     * viewport's. Two of these side by side are each half the page, so a
     * viewport breakpoint would flip the header to a row while the card is
     * still far too narrow for a title and five filter chips on one line --
     * which crushes the title into a two-word column.
     */
    <Card className={cn("@container flex flex-col", className)}>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-lg font-bold text-fg">{title}</h3>
          {description && (
            <p className="text-xs text-fg-muted @2xl:truncate">{description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {showFilter && (
            <DateRangeFilter
              size="sm"
              value={range}
              onChange={onRangeChange}
              defaultPreset={defaultPreset}
            />
          )}
        </div>
      </div>

      <div className="px-3 py-5" style={{ height }}>
        {loading ? (
          <div className="size-full animate-pulse rounded-md bg-surface-raised" />
        ) : empty ? (
          <div className="flex size-full items-center justify-center text-sm text-fg-muted">
            {emptyMessage}
          </div>
        ) : (
          // ResponsiveContainer needs a parent with a resolved height, which the
          // inline style above provides.
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

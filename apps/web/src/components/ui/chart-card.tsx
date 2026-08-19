"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/cn";
import { Card } from "./card";
import { DateRangeFilter } from "./date-range-filter";
import { ErrorState } from "./error-state";
import type { DateRange, DateRangePreset } from "@/lib/jalali";

export interface ChartCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;

  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  defaultPreset?: Exclude<DateRangePreset, "custom">;
  showFilter?: boolean;

  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: React.ReactNode;
  error?: boolean;
  errorMessage?: React.ReactNode;
  onRetry?: () => void;

  children?: React.ReactElement;
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
  error = false,
  errorMessage = "بارگذاری نمودار انجام نشد.",
  onRetry,
  children,
  className,
}: ChartCardProps) {
  return (
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

      {children && (
        <div className="px-3 py-5" style={{ height }}>
          {error ? (
            <ErrorState
              variant="bare"
              message={errorMessage}
              onRetry={onRetry}
              className="size-full py-0"
            />
          ) : loading ? (
            <div className="size-full animate-pulse rounded-md bg-surface-raised" />
          ) : empty ? (
            <div className="flex size-full items-center justify-center text-sm text-fg-muted">
              {emptyMessage}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Card>
  );
}

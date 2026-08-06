"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";
import { ErrorState } from "./error-state";
import { formatNumber } from "@/lib/format";

/**
 * A single figure, presented as the content rather than as a chart.
 *
 * The counterpart to ChartCard, and deliberately built to the same frame --
 * same Card, same bordered header, same rhythm -- so the two sit together on a
 * page without looking like different products.
 *
 * Use it when the number does not vary over an axis. A running total as of now
 * has nothing to plot: a chart of one value draws a bar that always fills its
 * plot area, which tells the reader nothing they cannot get from the number,
 * and costs a chart's worth of vertical space to say it.
 */

export type StatTone = "neutral" | "danger" | "success" | "warning" | "primary";

const toneText: Record<StatTone, string> = {
  neutral: "text-fg",
  danger: "text-danger",
  success: "text-success",
  warning: "text-warning",
  primary: "text-primary-400",
};

const toneChip: Record<StatTone, string> = {
  neutral: "bg-surface-raised text-fg-secondary",
  danger: "bg-danger/12 text-danger",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  primary: "bg-primary-500/12 text-primary-400",
};

export interface StatCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra header content, e.g. a filter or a link. */
  actions?: React.ReactNode;

  value: number;
  /** Defaults to plain grouped digits; pass formatToman / formatGrams as needed. */
  format?: (value: number) => string;
  /** Rendered after the number, smaller and muted: "تومان", "گرم". */
  unit?: React.ReactNode;
  /** Sits opposite the figure. Any 20-24px node. */
  icon?: React.ReactNode;
  tone?: StatTone;

  loading?: boolean;
  /**
   * Takes precedence over `loading`. A failed query has no value, and rendering
   * `۰` for it would state something false rather than admit the failure.
   */
  error?: boolean;
  errorMessage?: React.ReactNode;
  onRetry?: () => void;

  className?: string;
}

export function StatCard({
  title,
  description,
  actions,
  value,
  format = formatNumber,
  unit,
  icon,
  tone = "neutral",
  loading = false,
  error = false,
  errorMessage = "بارگذاری این عدد انجام نشد.",
  onRetry,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-lg font-bold text-fg">{title}</h3>
          {description && <p className="text-xs text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      <div className="px-6 py-6">
        {error ? (
          <ErrorState
            variant="bare"
            message={errorMessage}
            onRetry={onRetry}
            className="py-2"
          />
        ) : (
          <div className="flex items-center justify-between gap-4">
            {loading ? (
              <span className="h-9 w-48 animate-pulse rounded bg-surface-raised" />
            ) : (
              // baseline so the unit sits on the number's baseline rather than
              // floating against the top of a much larger glyph.
              <p className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    toneText[tone],
                  )}
                >
                  {format(value)}
                </span>
                {unit && (
                  <span className="text-sm font-normal text-fg-muted">{unit}</span>
                )}
              </p>
            )}

            {icon && (
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-lg",
                  toneChip[tone],
                )}
              >
                {icon}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

"use client";

import * as React from "react";
import { Calendar } from "react-multi-date-picker";
import type DateObject from "react-date-object";
import { cn } from "@/lib/cn";
import {
  CALENDAR,
  LOCALE,
  PRESET_LABELS,
  formatJalaliRange,
  rangeForPreset,
  rangeFromPicker,
  type DateRange,
  type DateRangePreset,
} from "@/lib/jalali";

/**
 * Preset range chips plus a Jalali calendar for custom ranges.
 *
 * Presets are computed on the Persian calendar (see lib/jalali.ts). Picking
 * "custom" opens a two-endpoint range picker; the popover stays open until both
 * ends are chosen, because a half-selected range is not a usable filter.
 */

const PRESETS: Exclude<DateRangePreset, "custom">[] = [
  "today",
  "week",
  "month",
  "year",
];

export interface DateRangeFilterProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  defaultPreset?: Exclude<DateRangePreset, "custom">;
  /** Compact chips, for embedding in a card header. */
  size?: "sm" | "md";
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  defaultPreset = "month",
  size = "md",
  className,
}: DateRangeFilterProps) {
  const [internal, setInternal] = React.useState<DateRange>(() =>
    rangeForPreset(defaultPreset),
  );
  const range = value ?? internal;

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const commit = (next: DateRange) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  // Close the popover on outside click or Escape.
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handlePickerChange = (selection: DateObject | DateObject[] | null) => {
    if (!Array.isArray(selection) || selection.length < 2) return;

    const [from, to] = selection;
    if (!from || !to) return;

    commit(rangeFromPicker(from, to));
    setOpen(false);
  };

  const chipSize =
    size === "sm" ? "h-7 px-2.5 text-2xs" : "h-8 px-3 text-xs";

  return (
    <div
      ref={containerRef}
      className={cn("relative flex flex-wrap items-center gap-1.5", className)}
    >
      <div
        role="group"
        aria-label="بازه زمانی"
        className="flex items-center gap-1 rounded-md border border-border bg-surface-sunken p-1"
      >
        {PRESETS.map((preset) => {
          const active = range.preset === preset;

          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setOpen(false);
                commit(rangeForPreset(preset));
              }}
              className={cn(
                "rounded-sm font-medium transition-colors duration-150",
                chipSize,
                active
                  ? "bg-primary-500 text-white"
                  : "text-fg-muted hover:bg-surface-raised hover:text-fg",
              )}
            >
              {PRESET_LABELS[preset]}
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={range.preset === "custom"}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((previous) => !previous)}
          className={cn(
            "flex items-center gap-1.5 rounded-sm font-medium transition-colors duration-150",
            chipSize,
            range.preset === "custom"
              ? "bg-primary-500 text-white"
              : "text-fg-muted hover:bg-surface-raised hover:text-fg",
          )}
        >
          <CalendarIcon />
          {range.preset === "custom"
            ? formatJalaliRange(range.from, range.to)
            : PRESET_LABELS.custom}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="انتخاب بازه دلخواه"
          className={cn(
            "absolute top-full z-40 mt-2 end-0",
            "rounded-lg border border-border bg-surface-overlay p-2 shadow-lg",
          )}
        >
          <Calendar
            range
            numberOfMonths={1}
            calendar={CALENDAR}
            locale={LOCALE}
            value={[range.from, range.to]}
            onChange={handlePickerChange}
            // Styling comes from the .rmdp-* overrides in globals.css; the
            // library's own themes don't know about our tokens.
            className="gd-calendar"
          />
          <p className="px-2 pb-1 pt-2 text-2xs text-fg-muted">
            روز شروع و پایان را انتخاب کنید.
          </p>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="size-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4m8-4v4M3 11h18" />
    </svg>
  );
}

"use client";

import * as React from "react";
import { Calendar } from "react-multi-date-picker";
import type DateObject from "react-date-object";
import { cn } from "@/lib/cn";
import { CALENDAR, LOCALE, formatJalali } from "@/lib/jalali";

/**
 * A single Jalali date, picked from a calendar popover.
 *
 * `DateRangeFilter` covers two endpoints and a set of presets, which is a
 * different control; this is the plain one-date field the opening balance
 * needs. It follows the same two rules that control learned the hard way:
 *
 *   - the popover renders INLINE, never through a portal. This form opens
 *     inside a <dialog> from the edit button, and a dialog opened with
 *     showModal() lives in the browser's top layer -- a popover portaled to
 *     document.body lands behind it and no z-index can rescue it.
 *   - it flips above the trigger when there is no room below, measured rather
 *     than assumed, because in a modal the field can sit near the bottom of
 *     the viewport and the top layer does not scroll with the page.
 *
 * Kept beside the capital screen because it is its only caller. Promote it to
 * components/ui when something else needs a single date.
 */

export interface JalaliDateFieldProps {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  hint?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  /** Nothing later than this can be chosen. */
  maxDate?: Date;
}

export function JalaliDateField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  maxDate,
}: JalaliDateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [dropUp, setDropUp] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const fieldId = React.useId();

  React.useLayoutEffect(() => {
    if (!open) return;

    const trigger = containerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const needed = popover.offsetHeight + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      // Only flip when going up is actually better: on a short viewport neither
      // side fits, and dropping down at least keeps the first week visible.
      setDropUp(spaceBelow < needed && rect.top > spaceBelow);
    };

    place();

    /**
     * Measured a second time, on a timer, and this is the measurement that
     * actually decides it.
     *
     * The popover is 18px of padding when the layout effect above runs: the
     * calendar builds its month in a PASSIVE effect, which React has not got to
     * yet, so the first measurement always concludes there is room below. A
     * timeout lands after those effects, with the real height.
     *
     * A `requestAnimationFrame` would be the obvious way to wait, and it is the
     * wrong one -- it only runs when the browser is producing frames, so in a
     * background tab the popover would open unplaced and stay that way. Timers
     * run regardless.
     */
    const timer = window.setTimeout(place, 0);
    // Still watched for later size changes: a month spanning six weeks is a row
    // taller than one spanning five, and the popover has to re-place itself
    // when the user pages through.
    const observer = new ResizeObserver(place);
    observer.observe(popover);
    window.addEventListener("resize", place);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Stops the key reaching the surrounding <dialog>, which would
        // otherwise close the whole form on the first Escape.
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const handleChange = (selection: DateObject | DateObject[] | null) => {
    if (!selection || Array.isArray(selection)) return;
    const picked = selection.toDate();
    // Local midnight: the API widens a bare date to the whole day, and the
    // opening position is a day, not an instant.
    picked.setHours(0, 0, 0, 0);
    onChange(picked);
    setOpen(false);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-fg-secondary">
        {label}
      </label>

      <div ref={containerRef} className="relative">
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          onClick={() => setOpen((previous) => !previous)}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3",
            "bg-surface-sunken text-sm transition-colors duration-150",
            "focus:border-primary-500 focus:shadow-glow-sm focus:outline-none",
            error ? "border-danger" : "border-border",
            disabled && "cursor-not-allowed opacity-50",
            value ? "text-fg" : "text-fg-muted",
          )}
        >
          <span>{value ? formatJalali(value) : "انتخاب تاریخ"}</span>
          <CalendarIcon />
        </button>

        {open && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="انتخاب تاریخ"
            className={cn(
              "absolute z-40 start-0",
              dropUp ? "bottom-full mb-2" : "top-full mt-2",
              "rounded-lg border border-border bg-surface-overlay p-2 shadow-lg",
            )}
          >
            <Calendar
              calendar={CALENDAR}
              locale={LOCALE}
              value={value ?? undefined}
              maxDate={maxDate}
              onChange={handleChange}
              className="gd-calendar"
            />
          </div>
        )}
      </div>

      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-fg-muted"
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

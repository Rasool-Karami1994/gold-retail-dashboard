"use client";

import * as React from "react";
import { Calendar } from "react-multi-date-picker";
import type DateObject from "react-date-object";
import { cn } from "@/lib/cn";
import { CALENDAR, LOCALE, formatJalali } from "@/lib/jalali";

export interface JalaliDateFieldProps {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  hint?: React.ReactNode;
  error?: string;
  disabled?: boolean;
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
      setDropUp(spaceBelow < needed && rect.top > spaceBelow);
    };

    place();

    const timer = window.setTimeout(place, 0);
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

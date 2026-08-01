"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { className, label, hint, error, placeholder, id, children, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const describedBy = error
      ? `${selectId}-error`
      : hint
        ? `${selectId}-hint`
        : undefined;

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-fg-secondary"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            defaultValue={placeholder ? "" : undefined}
            className={cn(
              "h-11 w-full appearance-none rounded-md border bg-surface-sunken",
              // extra inline-end padding leaves room for the chevron
              "ps-3 pe-10 text-sm text-fg outline-none transition-colors duration-150",
              "focus:border-primary-500 focus:shadow-glow-sm",
              "disabled:opacity-50",
              error ? "border-danger" : "border-border",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>

          <svg
            className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-fg-muted"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {error ? (
          <p id={`${selectId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${selectId}-hint`} className="text-xs text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

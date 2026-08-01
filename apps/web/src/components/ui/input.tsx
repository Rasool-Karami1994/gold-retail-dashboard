"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Sits at the inline-start edge (right, in RTL). */
  startAdornment?: React.ReactNode;
  /** Sits at the inline-end edge (left, in RTL). */
  endAdornment?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, label, hint, error, startAdornment, endAdornment, id, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-fg-secondary"
          >
            {label}
          </label>
        )}

        <div
          className={cn(
            "flex items-center gap-2 rounded-md border bg-surface-sunken px-3",
            "h-11 transition-colors duration-150",
            "focus-within:border-primary-500 focus-within:shadow-glow-sm",
            error ? "border-danger" : "border-border",
            props.disabled && "opacity-50",
          )}
        >
          {startAdornment && (
            <span className="shrink-0 text-fg-muted">{startAdornment}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-sm text-fg outline-none",
              "placeholder:text-fg-muted",
              className,
            )}
            {...props}
          />
          {endAdornment && (
            <span className="shrink-0 text-fg-muted">{endAdornment}</span>
          )}
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

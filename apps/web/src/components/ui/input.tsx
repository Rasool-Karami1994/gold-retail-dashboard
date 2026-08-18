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
  /**
   * Direction of the FIELD ROW -- the box, its adornments and their order --
   * as opposed to `dir`, which React puts on the <input> and which governs the
   * text inside it.
   *
   * The two are usually the same and this can be left alone. They come apart
   * when the field holds something inherently left-to-right that carries a
   * symbol: a percentage reads "۱۲٪", so the sign has to sit after the digits,
   * and in an RTL row "after" is the wrong side of the box. Setting this to
   * "ltr" lays the row out the way the value reads.
   */
  fieldDir?: "ltr" | "rtl";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      label,
      hint,
      error,
      startAdornment,
      endAdornment,
      fieldDir,
      id,
      ...props
    },
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
          dir={fieldDir}
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

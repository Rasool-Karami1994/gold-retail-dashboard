"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { toLatinDigits } from "@/lib/mobile";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}

export function OtpInput({
  value,
  onChange,
  length,
  disabled,
  invalid,
  autoFocus,
  "aria-label": ariaLabel = "کد تأیید",
}: OtpInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  const chars = React.useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ""),
    [value, length],
  );

  const focusBox = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    const box = refs.current[clamped];
    box?.focus();
    box?.select();
  };

  const commit = (next: string, focusAt: number) => {
    const trimmed = next.slice(0, length);
    onChange(trimmed);
    focusBox(Math.min(focusAt, trimmed.length));
  };

  const handleChange = (index: number, raw: string) => {
    const previous = chars[index] ?? "";
    let digits = toLatinDigits(raw).replace(/\D/g, "");

    if (previous) {
      if (digits.startsWith(previous)) digits = digits.slice(previous.length);
      else if (digits.endsWith(previous)) digits = digits.slice(0, -previous.length);
    }

    if (!digits) {
      commit(value.slice(0, index) + value.slice(index + 1), index);
      return;
    }

    const head = value.slice(0, index);
    commit(
      head + digits + value.slice(head.length + digits.length),
      index + digits.length,
    );
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !chars[index] && index > 0) {
      event.preventDefault();
      commit(value.slice(0, index - 1) + value.slice(index), index - 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      dir="ltr"
      className="flex w-fit gap-2"
    >
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          aria-label={`رقم ${index + 1}`}
          aria-invalid={invalid || undefined}
          value={char}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className={cn(
            "h-14 w-12 rounded-md border bg-surface-sunken text-center text-lg font-bold text-fg",
            "outline-none transition-colors duration-150",
            "focus:border-primary-500 focus:shadow-glow-sm",
            invalid ? "border-danger" : "border-border",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}

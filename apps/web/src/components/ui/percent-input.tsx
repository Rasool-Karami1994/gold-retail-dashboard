"use client";

import * as React from "react";
import { toLatinDigits } from "@/lib/mobile";
import { toPersianDigits } from "@/lib/format";
import { Input, type InputProps } from "./input";

const PERCENT_SIGN = "٪";

function toClean(raw: string): string {
  let text = toLatinDigits(raw).replace(/٫/g, ".").replace(/[^0-9.]/g, "");

  const first = text.indexOf(".");
  if (first !== -1) {
    text = text.slice(0, first + 1) + text.slice(first + 1).replace(/\./g, "");
  }
  return text;
}

export interface PercentInputProps
  extends Omit<InputProps, "value" | "onChange" | "type" | "inputMode" | "dir"> {
  value: string;
  onChange: (value: string) => void;
}

export const PercentInput = React.forwardRef<
  HTMLInputElement,
  PercentInputProps
>(function PercentInput({ value, onChange, ...props }, ref) {
  const [whole = "", fraction] = value.split(".");
  const display =
    value === ""
      ? ""
      : value.includes(".")
        ? `${toPersianDigits(whole)}٫${toPersianDigits(fraction ?? "")}`
        : toPersianDigits(whole);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      dir="ltr"
      fieldDir="ltr"
      value={display}
      onChange={(event) => onChange(toClean(event.target.value))}
      endAdornment={
        <span aria-hidden="true" className="text-sm text-fg-muted">
          {PERCENT_SIGN}
        </span>
      }
    />
  );
});

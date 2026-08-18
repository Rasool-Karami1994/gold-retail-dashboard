"use client";

import * as React from "react";
import { toLatinDigits } from "@/lib/mobile";
import { toPersianDigits } from "@/lib/format";
import { Input, type InputProps } from "./input";

/**
 * A percentage field, with the sign inside the box.
 *
 * A sibling of CurrencyInput rather than a one-off: same two-value split (a
 * Persian-numeral display over a bare ASCII value), same contract with
 * react-hook-form. It groups nothing, because a percentage never reaches four
 * digits, and it carries the sign instead.
 *
 * THE SIGN IS PART OF THE FIELD, not text beside it. `fieldDir="ltr"` lays the
 * row out the way the value reads, so the adornment lands after the digits --
 * in an RTL row the trailing edge is the left one, and a "٪" placed there
 * would read as though it belonged to whatever came next.
 *
 * `٪` (U+066A) rather than ASCII `%`, for the same reason amounts here use
 * `٬` and decimals `٫`: it is the sign this locale prints, and mixing the two
 * inside one form looks like a mistake.
 */

const PERCENT_SIGN = "٪";

/** Digits and at most one dot -- what the schema will parse. */
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
  /** The clean value: ASCII digits, at most one dot, no sign. */
  value: string;
  /** Receives the clean value, never the displayed one. */
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
      // `text`, not `number`: a number input rejects the Persian numerals this
      // shows and would sit there empty.
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

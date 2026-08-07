"use client";

import * as React from "react";
import { INTL_LOCALE } from "@/config/locale";
import {
  DECIMAL_MARK,
  formatTomanInWords,
  toPersianDigits,
} from "@/lib/format";
import { toLatinDigits } from "@/lib/mobile";
import { toNumber } from "@/lib/numbers";
import { Input, type InputProps } from "./input";

/**
 * A number field that groups digits as you type.
 *
 * TWO VALUES, KEPT APART. What the user sees is grouped and in Persian
 * numerals (`۴٬۲۰۰٬۰۰۰`); what leaves through `onChange` is a bare ASCII string
 * (`4200000`) with no separators. Only the display is formatted, so the schema
 * behind the form goes on receiving what it always did -- `toNumber` parses the
 * clean string, and the submitted payload is byte-identical to the unformatted
 * version of this field.
 *
 * The value is a string rather than a number because "" has to survive: an
 * untouched field is not zero, and the zod layer distinguishes them (see
 * `numeric()` in the new-transaction form-schema). Emitting NaN or undefined
 * here would change which validation message the user gets.
 */

const DIGIT = /[0-9۰-۹٠-٩]/;

function isSignificant(char: string, allowDecimal: boolean): boolean {
  if (DIGIT.test(char)) return true;
  return allowDecimal && (char === "." || char === DECIMAL_MARK);
}

function countSignificant(text: string, allowDecimal: boolean): number {
  let count = 0;
  for (const char of text) if (isSignificant(char, allowDecimal)) count += 1;
  return count;
}

/** Anything typed or pasted, reduced to ASCII digits and at most one dot. */
function toClean(raw: string, allowDecimal: boolean): string {
  let text = toLatinDigits(raw).split(DECIMAL_MARK).join(".");

  text = allowDecimal ? text.replace(/[^0-9.]/g, "") : text.replace(/\D/g, "");

  if (allowDecimal) {
    // Keep the first dot, drop the rest -- otherwise "1.2.3" survives to the
    // schema and fails as "not a number" for a reason the user cannot see.
    const first = text.indexOf(".");
    if (first !== -1) {
      text = text.slice(0, first + 1) + text.slice(first + 1).replace(/\./g, "");
    }
  }

  return text;
}

/** The grouped, Persian-numeral form of a clean value. */
function toDisplay(clean: string): string {
  if (clean === "") return "";

  const dot = clean.indexOf(".");
  const whole = dot === -1 ? clean : clean.slice(0, dot);
  const fraction = dot === -1 ? "" : clean.slice(dot + 1);

  const groupedWhole =
    whole === ""
      ? ""
      : new Intl.NumberFormat(INTL_LOCALE, {
          maximumFractionDigits: 0,
        }).format(Number(whole));

  // The fraction is mapped digit by digit, not through Intl: it is a string of
  // digits mid-typing, and "05" must stay "۰۵" rather than becoming "۵".
  return dot === -1
    ? groupedWhole
    : `${groupedWhole}${DECIMAL_MARK}${toPersianDigits(fraction)}`;
}

/**
 * Where the caret belongs in `display` once `count` significant characters have
 * passed. Separators are skipped, which is what stops the caret jumping to the
 * end when someone edits the middle of a number.
 */
function caretAfter(
  display: string,
  count: number,
  allowDecimal: boolean,
): number {
  if (count <= 0) return 0;

  let seen = 0;
  for (let i = 0; i < display.length; i += 1) {
    if (isSignificant(display[i]!, allowDecimal)) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return display.length;
}

export interface CurrencyInputProps
  extends Omit<InputProps, "value" | "onChange" | "type" | "inputMode"> {
  /** The clean value: ASCII digits, no separators, at most one dot. */
  value: string;
  /** Receives the clean value, never the formatted one. */
  onChange: (value: string) => void;
  /**
   * Spell the amount out underneath -- "۲٫۵ میلیون تومان".
   *
   * On by default because every current caller is a Toman field. Turn it off
   * for anything that is not money: "۱ میلیون گرم" is not a thing anyone says.
   */
  showWords?: boolean;
  /** Accept a decimal point. Off by default -- Toman is stored whole. */
  decimal?: boolean;
}

export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(function CurrencyInput(
  { value, onChange, showWords = true, decimal = false, hint, ...props },
  forwardedRef,
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingCaret = React.useRef<number | null>(null);

  /**
   * Restore the caret after React has painted the reformatted value.
   *
   * Layout effect, not effect: the DOM value has already changed by this point
   * and the browser has put the caret at the end. Fixing it after paint would
   * be visible as a jump.
   */
  React.useLayoutEffect(() => {
    const element = inputRef.current;
    if (element && pendingCaret.current !== null) {
      element.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  const display = toDisplay(value);
  const words = showWords ? formatTomanInWords(toNumber(value)) : null;

  return (
    <Input
      {...props}
      ref={(node) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      // `text`, not `number`: a number input rejects the grouping separators
      // outright and would show an empty box. inputMode still raises the right
      // keypad on a phone.
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      dir="ltr"
      value={display}
      onChange={(event) => {
        const element = event.target;
        const raw = element.value;
        const caret = element.selectionStart ?? raw.length;

        // Counted BEFORE reformatting, against what the user actually typed --
        // the separator positions are about to change underneath them.
        const before = countSignificant(raw.slice(0, caret), decimal);

        const clean = toClean(raw, decimal);
        pendingCaret.current = caretAfter(toDisplay(clean), before, decimal);

        onChange(clean);
      }}
      hint={words ?? hint}
    />
  );
});

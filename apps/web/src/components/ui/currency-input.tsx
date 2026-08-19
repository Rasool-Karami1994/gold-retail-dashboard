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

function toClean(raw: string, allowDecimal: boolean): string {
  let text = toLatinDigits(raw).split(DECIMAL_MARK).join(".");

  text = allowDecimal ? text.replace(/[^0-9.]/g, "") : text.replace(/\D/g, "");

  if (allowDecimal) {
    const first = text.indexOf(".");
    if (first !== -1) {
      text = text.slice(0, first + 1) + text.slice(first + 1).replace(/\./g, "");
    }
  }

  return text;
}

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

  return dot === -1
    ? groupedWhole
    : `${groupedWhole}${DECIMAL_MARK}${toPersianDigits(fraction)}`;
}

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
  value: string;
  onChange: (value: string) => void;
  showWords?: boolean;
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
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      dir="ltr"
      value={display}
      onChange={(event) => {
        const element = event.target;
        const raw = element.value;
        const caret = element.selectionStart ?? raw.length;

        const before = countSignificant(raw.slice(0, caret), decimal);

        const clean = toClean(raw, decimal);
        pendingCaret.current = caretAfter(toDisplay(clean), before, decimal);

        onChange(clean);
      }}
      hint={words ?? hint}
    />
  );
});

import { INTL_LOCALE } from "@/config/locale";

/**
 * Number formatting for display.
 *
 * All of these go through the app's Persian locale, so digits render as
 * Persian numerals and grouping uses the right separators. Values stay plain
 * JS numbers everywhere else -- formatting happens at the edge, never in state.
 */

/** Whole Toman, grouped: ۱۵,۲۲۵,۰۰۰ */
export function formatToman(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Weight, up to 3 decimals: ۴٫۳۵ */
export function formatGrams(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Compact form for chart axes, where a full 15,225,000 would collide with its
 * neighbours: ۱۵٫۲ م
 */
export function formatCompactToman(value: number): string {
  const abs = Math.abs(value);
  const format = (n: number, digits: number) =>
    new Intl.NumberFormat(INTL_LOCALE, { maximumFractionDigits: digits }).format(n);

  if (abs >= 1_000_000_000) return `${format(value / 1_000_000_000, 1)} میلیارد`;
  if (abs >= 1_000_000) return `${format(value / 1_000_000, 1)} م`;
  if (abs >= 1_000) return `${format(value / 1_000, 0)} هـ`;
  return format(value, 0);
}

/**
 * Single source of truth for the app's locale and text direction.
 *
 * The app is Persian/RTL by default and has no locale switcher. Anything that
 * needs the locale or direction should import from here rather than hardcoding
 * "fa" / "rtl", so adding a second locale later is a contained change.
 */
export const DEFAULT_LOCALE = "fa-IR" as const;
export const HTML_LANG = "fa" as const;
export const DEFAULT_DIRECTION = "rtl" as const;

/** BCP-47 tag with the Persian calendar and numbering, for Intl formatters. */
export const INTL_LOCALE = "fa-IR-u-ca-persian-nu-arabext" as const;

/** Jalali date, e.g. ۱۴۰۵/۱/۳۱ */
export function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat(INTL_LOCALE, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

/** Grouped amount in Persian digits, e.g. ۸۲۹,۰۰۰ */
export function formatNumber(value: number) {
  return new Intl.NumberFormat(INTL_LOCALE).format(value);
}

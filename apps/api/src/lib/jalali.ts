/**
 * Jalali (Persian) date formatting for anything customer-facing.
 *
 * Uses the platform's Intl with the `persian` calendar rather than a
 * conversion library -- Node ships full ICU, so the calendar arithmetic is
 * already there and correct, including leap years.
 */

/** Persian calendar, Persian numerals, Tehran clock. */
const LOCALE = "fa-IR-u-ca-persian-nu-arabext";
const TIME_ZONE = "Asia/Tehran";

/** e.g. ۱۴۰۵/۰۵/۱۱ */
export function formatJalaliDate(value: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/** e.g. ۱۴۰۵/۰۵/۱۱ - ۱۴:۳۲ */
export function formatJalaliDateTime(value: Date): string {
  const time = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

  return `${formatJalaliDate(value)} - ${time}`;
}

/** Grouped Persian numerals, e.g. ۱۵,۲۲۵,۰۰۰ */
export function formatToman(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

/** Weight with up to 3 decimals, e.g. ۴٫۳۵ */
/**
 * A percentage in Persian numerals, with the Persian percent sign: ۱۲٫۵٪
 *
 * Up to one decimal, because a margin is quoted in halves at most and trailing
 * zeros on a whole number read as false precision.
 */
export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(
    value,
  )}٪`;
}

export function formatGrams(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(value);
}

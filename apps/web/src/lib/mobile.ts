/**
 * Iranian mobile numbers, client side.
 *
 * MUST behave the same as `apps/api/src/lib/mobile.ts`. It is duplicated rather
 * than shared through a package for the same reason COOKIE_NAMES is (see
 * config/routes.ts): the two apps have no build-time dependency on each other.
 * The API normalises again on the way in, so a drift here costs a rejected form,
 * not a bad row in the database -- but if you change one, change the other.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const MOBILE_PATTERN = /^09\d{9}$/;

/**
 * Rewrites Persian and Arabic-Indic numerals as ASCII.
 *
 * Needed on every numeric field in this app, not just the phone: a Persian
 * keyboard produces ۰۹۱۲…, and the API's validators are ASCII `\d` regexes. The
 * OTP code field goes through this too -- unlike `mobile`, the API does NOT
 * normalise `code`, so a Persian-typed code would fail its `^\d{5}$` check.
 */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit));
  });
}

/** `+98912…`, `0098912…`, `912…` and `0912…` all collapse to `09XXXXXXXXX`. */
export function normalizeMobile(input: string): string {
  const digits = toLatinDigits(input).replace(/\D/g, "");

  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

export function isValidMobile(value: string): boolean {
  return MOBILE_PATTERN.test(normalizeMobile(value));
}

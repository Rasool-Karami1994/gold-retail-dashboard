import { INTL_LOCALE } from "@/config/locale";

/**
 * Number formatting for display.
 *
 * All of these go through the app's Persian locale, so digits render as
 * Persian numerals and grouping uses the right separators. Values stay plain
 * JS numbers everywhere else -- formatting happens at the edge, never in state.
 */

/** A plain count, in Persian numerals: ۱۲ */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE).format(value);
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * ASCII digits as Persian numerals, character for character.
 *
 * The inverse of `toLatinDigits` in lib/mobile.ts, and needed where `Intl`
 * cannot be used because the digits are not a number: the fractional part of a
 * half-typed decimal, where `Number("05")` would drop the leading zero and
 * rewrite what someone is in the middle of typing.
 */
export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}

/**
 * The locale's decimal mark, asked of Intl rather than hard-coded.
 *
 * `٫` (U+066B) today. Reading it back from the formatter keeps the character
 * this app *parses* identical to the one it *prints*, which is the invariant
 * `toNumber` depends on.
 */
export const DECIMAL_MARK: string =
  new Intl.NumberFormat(INTL_LOCALE)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";

/** Whole Toman, grouped: ۱۵,۲۲۵,۰۰۰ */
export function formatToman(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * A percentage with the Persian percent sign: ۱۲٫۵٪
 *
 * Up to one decimal -- a margin is quoted in halves at most, and trailing
 * zeros on a whole number read as precision that is not there.
 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return `${toPersianDigits("0")}٪`;

  return `${new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 1,
  }).format(value)}٪`;
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

/**
 * Largest-to-smallest, so the first unit an amount reaches is the one used.
 * The empty word is the terminator: below a thousand there is no magnitude to
 * name and the figure stands on its own.
 */
const TOMAN_UNITS: readonly { divisor: number; word: string }[] = [
  { divisor: 1_000_000_000, word: "میلیارد" },
  { divisor: 1_000_000, word: "میلیون" },
  { divisor: 1_000, word: "هزار" },
  { divisor: 1, word: "" },
];

/**
 * An amount spelled out in magnitude words: ۲٫۵ میلیون تومان
 *
 * A hint under a currency field, for the one mistake grouping separators do not
 * prevent -- a whole extra zero. `۱۲٬۰۰۰٬۰۰۰` and `۱٬۲۰۰٬۰۰۰` are easy to
 * confuse at a glance; "۱۲ میلیون" and "۱٫۲ میلیون" are not.
 *
 * Related to `formatCompactToman` above and deliberately not merged with it:
 * that one abbreviates (`م`, `هـ`) to fit a chart axis, where this one spells
 * the word out because it is prose. Same idea, different constraint.
 *
 * Returns null for anything with nothing to say -- zero, blank, NaN -- so the
 * caller renders no element at all rather than an empty one that still takes up
 * a line.
 */
export function formatTomanInWords(value: number): string | null {
  if (!Number.isFinite(value) || value === 0) return null;

  const abs = Math.abs(value);
  const index = TOMAN_UNITS.findIndex((unit) => abs >= unit.divisor);
  // findIndex misses only when abs < 1, which `value === 0` has not already
  // caught for a fraction of a Toman. Nothing sensible to name there.
  if (index === -1) return null;

  const unit = TOMAN_UNITS[index]!;
  const scaled = value / unit.divisor;
  const rounded = Math.round(Math.abs(scaled) * 10) / 10;

  /**
   * Step up when rounding pushes the figure to four digits.
   *
   * 999,999 selects "هزار" on the unrounded comparison and then rounds to
   * 1000.0, which would read "۱٬۰۰۰ هزار تومان" -- technically true and clearly
   * meant to be "۱ میلیون". Selecting on the rounded value instead would break
   * the other end, turning 950,000 into "۱ میلیون" when "۹۵۰ هزار" is right.
   */
  if (rounded >= 1000 && index > 0) {
    const bigger = TOMAN_UNITS[index - 1]!;
    return withUnit(value / bigger.divisor, bigger.word);
  }

  return withUnit(scaled, unit.word);
}

function withUnit(scaled: number, word: string): string {
  // maximumFractionDigits drops a trailing .0 on its own, so 1_000_000 reads
  // "۱ میلیون" rather than "۱٫۰ میلیون".
  const text = new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 1,
  }).format(scaled);

  return word ? `${text} ${word} تومان` : `${text} تومان`;
}

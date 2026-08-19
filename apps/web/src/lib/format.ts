import { INTL_LOCALE } from "@/config/locale";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE).format(value);
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}

export const DECIMAL_MARK: string =
  new Intl.NumberFormat(INTL_LOCALE)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";

export function formatToman(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return `${toPersianDigits("0")}٪`;

  return `${new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 1,
  }).format(value)}٪`;
}

export function formatGrams(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatCompactToman(value: number): string {
  const abs = Math.abs(value);
  const format = (n: number, digits: number) =>
    new Intl.NumberFormat(INTL_LOCALE, { maximumFractionDigits: digits }).format(n);

  if (abs >= 1_000_000_000) return `${format(value / 1_000_000_000, 1)} میلیارد`;
  if (abs >= 1_000_000) return `${format(value / 1_000_000, 1)} م`;
  if (abs >= 1_000) return `${format(value / 1_000, 0)} هـ`;
  return format(value, 0);
}

const TOMAN_UNITS: readonly { divisor: number; word: string }[] = [
  { divisor: 1_000_000_000, word: "میلیارد" },
  { divisor: 1_000_000, word: "میلیون" },
  { divisor: 1_000, word: "هزار" },
  { divisor: 1, word: "" },
];

export function formatTomanInWords(value: number): string | null {
  if (!Number.isFinite(value) || value === 0) return null;

  const abs = Math.abs(value);
  const index = TOMAN_UNITS.findIndex((unit) => abs >= unit.divisor);
  if (index === -1) return null;

  const unit = TOMAN_UNITS[index]!;
  const scaled = value / unit.divisor;
  const rounded = Math.round(Math.abs(scaled) * 10) / 10;

  if (rounded >= 1000 && index > 0) {
    const bigger = TOMAN_UNITS[index - 1]!;
    return withUnit(value / bigger.divisor, bigger.word);
  }

  return withUnit(scaled, unit.word);
}

function withUnit(scaled: number, word: string): string {
  const text = new Intl.NumberFormat(INTL_LOCALE, {
    maximumFractionDigits: 1,
  }).format(scaled);

  return word ? `${text} ${word} تومان` : `${text} تومان`;
}

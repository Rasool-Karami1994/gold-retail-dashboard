const LOCALE = "fa-IR-u-ca-persian-nu-arabext";
const TIME_ZONE = "Asia/Tehran";

export function formatJalaliDate(value: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatJalaliDateTime(value: Date): string {
  const time = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

  return `${formatJalaliDate(value)} - ${time}`;
}

export function formatToman(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(
    value,
  )}٪`;
}

export function formatGrams(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(value);
}

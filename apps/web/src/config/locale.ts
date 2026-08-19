export const DEFAULT_LOCALE = "fa-IR" as const;
export const HTML_LANG = "fa" as const;
export const DEFAULT_DIRECTION = "rtl" as const;

export const INTL_LOCALE = "fa-IR-u-ca-persian-nu-arabext" as const;

export function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat(INTL_LOCALE, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(INTL_LOCALE).format(value);
}

import { toLatinDigits } from "./mobile";

/**
 * A user-typed value as a number, or NaN.
 *
 * Every numeric field in this app goes through here rather than `Number()`.
 * `Intl` prints weights with `٫` (U+066B) and amounts with `٬` (U+066C) in this
 * locale, so what the screen shows is exactly what gets typed back -- and
 * `Number("۲٫۵")` is NaN. People paste "4,200,000" too.
 *
 * NaN rather than 0 for an empty field: 0 is a value someone might mean, and
 * reporting "required" is not the same as accepting zero. Callers computing a
 * running total treat NaN as "nothing typed yet".
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;

  const text = toLatinDigits(String(value ?? ""))
    // Persian decimal mark -> ".".
    .replace(/٫/g, ".")
    // Latin comma, Persian thousands separator, spaces.
    .replace(/[,٬\s]/g, "")
    .trim();

  return text === "" ? NaN : Number(text);
}

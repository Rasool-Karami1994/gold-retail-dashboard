import { toLatinDigits } from "./mobile";

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;

  const text = toLatinDigits(String(value ?? ""))
    .replace(/٫/g, ".")
    .replace(/[,٬\s]/g, "")
    .trim();

  return text === "" ? NaN : Number(text);
}

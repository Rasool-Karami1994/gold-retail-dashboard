/**
 * Iranian mobile numbers arrive in several shapes (`+98912…`, `0098912…`,
 * `912…`, `0912…`). We normalise every one of them to the canonical
 * `09XXXXXXXXX` form before storing, so the unique index on
 * `Customer.mobile` actually catches duplicates and OTP lookups match.
 */

export const MOBILE_PATTERN = /^09\d{9}$/;

export function normalizeMobile(input: unknown): string {
  if (typeof input !== "string") return "";

  // Persian/Arabic-Indic digits paste in from Persian keyboards and phones.
  const latinDigits = input.replace(/[۰-۹٠-٩]/g, (d) =>
    String(
      "۰۱۲۳۴۵۶۷۸۹".indexOf(d) >= 0
        ? "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
        : "٠١٢٣٤٥٦٧٨٩".indexOf(d),
    ),
  );

  const digits = latinDigits.replace(/\D/g, "");

  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

export function isValidMobile(value: string): boolean {
  return MOBILE_PATTERN.test(value);
}

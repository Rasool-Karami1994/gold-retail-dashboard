import localFont from "next/font/local";

/**
 * Vazir, self-hosted from the woff2 files vendored in this directory (copied
 * from the `vazir-font` package -- see scripts/sync-fonts.mjs to refresh them).
 *
 * We use the "Farsi-Digits" (FD) cut, which renders ASCII digits as Persian
 * numerals. The reference design shows Persian numerals everywhere, so this
 * keeps `۱۴۰۵/۱/۳۱` correct without transliterating numbers in application
 * code -- values stay as plain numbers in the DOM and remain copyable.
 *
 * next/font/local emits the @font-face rules, hashes and preloads the files,
 * and generates a size-adjusted fallback so there is no layout shift.
 */
export const vazir = localFont({
  src: [
    { path: "./Vazir-Regular-FD.woff2", weight: "400", style: "normal" },
    { path: "./Vazir-Medium-FD.woff2", weight: "500", style: "normal" },
    { path: "./Vazir-Bold-FD.woff2", weight: "700", style: "normal" },
    { path: "./Vazir-Black-FD.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
  // Vazir has no italic cut; let the browser know rather than synthesising one.
  declarations: [{ prop: "font-synthesis", value: "none" }],
});

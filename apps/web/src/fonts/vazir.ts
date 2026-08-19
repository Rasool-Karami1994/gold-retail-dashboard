import localFont from "next/font/local";

export const vazir = localFont({
  src: [
    { path: "./Vazir-Regular-FD.woff2", weight: "400", style: "normal" },
    { path: "./Vazir-Medium-FD.woff2", weight: "500", style: "normal" },
    { path: "./Vazir-Bold-FD.woff2", weight: "700", style: "normal" },
    { path: "./Vazir-Black-FD.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
  declarations: [{ prop: "font-synthesis", value: "none" }],
});

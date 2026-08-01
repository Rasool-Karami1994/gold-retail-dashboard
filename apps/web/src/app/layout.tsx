import type { Metadata } from "next";
import { vazir } from "@/fonts/vazir";
import { DEFAULT_DIRECTION, DEFAULT_LOCALE, HTML_LANG } from "@/config/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "g-dash",
  description: "سامانه آموزش برنامه‌نویسی",
  openGraph: { locale: DEFAULT_LOCALE },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={HTML_LANG} dir={DEFAULT_DIRECTION} className={vazir.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مختبر هِمّة للمعايرة",
  description: "جمع تسجيلات عربية ووسوم بشرية لمعايرة تحليل النطق",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import "./himma-lab.css";

export const metadata: Metadata = {
  title: "مختبر هِمّة للقراءة والنطق",
  description: "مختبر هِمّة لجمع تسجيلات عربية ووسوم بشرية ومعايرة تحليل القراءة والنطق",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

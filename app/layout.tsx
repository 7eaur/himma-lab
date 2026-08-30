import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Tajawal } from "next/font/google";
import "./globals.css";
import "./himma-lab.css";
import "./fonts.css";
import "./analytics.css";
import "./himma-brand.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مختبر هِمّة للقراءة والنطق",
  description: "مختبر هِمّة لجمع تسجيلات عربية ووسوم بشرية ومعايرة تحليل القراءة والنطق",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${ibmPlexArabic.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Inter, Sour_Gummy } from "next/font/google";
import SiteHeader from "./_components/SiteHeader";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

const sourGummy = Sour_Gummy({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "GYM-Meat",
  description: "Raw meat at gyms — fast, fresh, protein-packed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sourGummy.variable}`}>
      <body>
        <SiteHeader />
        <div style={{ minHeight: "calc(100dvh - 56px)" }}>{children}</div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "./_components/SiteHeader";

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
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <SiteHeader />
        <div style={{ minHeight: "calc(100dvh - 56px)" }}>{children}</div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MXD Interna",
  description: "Panel interno MXD — BOM, modelos y stock",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

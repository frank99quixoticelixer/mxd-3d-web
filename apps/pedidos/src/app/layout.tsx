import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MXD Pedidos",
  description: "Portal de pedidos de piezas MXD",
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

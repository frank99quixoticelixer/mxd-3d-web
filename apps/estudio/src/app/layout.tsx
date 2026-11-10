import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Estudio MX80",
  description: "Renders y video publicitario del MX80 (herramienta interna).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

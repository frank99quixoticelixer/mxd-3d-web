import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";

import "./globals.css";

// Titulos condensados en mayusculas (estilo menu de simulador) y texto de
// lectura. next/font los descarga al compilar y los sirve desde la app.
const titulo = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-titulo",
});
const texto = Inter({ subsets: ["latin"], variable: "--fuente-texto" });

export const metadata: Metadata = {
  title: "Estudio MX80",
  description: "Renders y video publicitario del MX80 (herramienta interna).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${titulo.variable} ${texto.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

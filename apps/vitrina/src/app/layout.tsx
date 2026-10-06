import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Encabezado } from "@/components/layout/Encabezado";
import { PieDePagina } from "@/components/layout/PieDePagina";
import { MARCA } from "@/config/marca";

const urlSitio = process.env.NEXT_PUBLIC_SITIO_URL ?? "http://localhost:3000";

/**
 * Sin esto el navegador movil maqueta a ~980 px de ancho y luego encoge la
 * pagina: todo sale diminuto y el visor 3D recibe un lienzo del tamanio
 * equivocado. Es la diferencia entre "se ve en el telefono" y "sirve".
 *
 * No se limita el zoom: el visor ya captura el pellizco sobre el lienzo
 * (touch-action: none), asi que ampliar la pagina sigue disponible en el
 * resto del sitio para quien lo necesite.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F8A4C",
};

export const metadata: Metadata = {
  metadataBase: new URL(urlSitio),
  title: {
    default: `${MARCA.nombreLargo} — Catálogo técnico de componentes`,
    template: `%s | ${MARCA.nombre}`,
  },
  description: MARCA.descripcion,
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: MARCA.nombreLargo,
    title: `${MARCA.nombreLargo} — Catálogo técnico de componentes`,
    description: MARCA.descripcion,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="flex min-h-screen flex-col bg-white">
        <Encabezado />
        <main className="flex-1">{children}</main>
        <PieDePagina />
      </body>
    </html>
  );
}

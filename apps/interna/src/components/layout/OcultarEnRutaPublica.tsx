"use client";

import { usePathname } from "next/navigation";

/** Rutas que se ven sin sesion (proxy.ts): ahi no hay menu ni descargas. */
const RUTAS_PUBLICAS = ["/login", "/registro"];

/**
 * No muestra a sus hijos en las rutas publicas. Es componente de cliente solo
 * para leer la ruta; los hijos los renderiza el servidor y no entra ningun dato
 * del catalogo.
 */
export function OcultarEnRutaPublica({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  if (ruta && RUTAS_PUBLICAS.includes(ruta)) return null;
  return <>{children}</>;
}

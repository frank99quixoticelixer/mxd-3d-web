import type { Metadata } from "next";
import Link from "next/link";

import { leerCambios, nombreDeCampo } from "@/lib/bom";
import { obtenerTodas } from "@/lib/catalogo";

export const metadata: Metadata = {
  title: "Historial del BOM",
  robots: { index: false, follow: false },
};

// Lee la base en cada peticion: un cambio recien guardado debe verse al instante.
export const dynamic = "force-dynamic";

const LIMITE = 200;

function fecha(valor: Date | string): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

/** Un valor del historial para mostrarlo: vacio si no habia, acortado si es largo. */
function Valor({ texto }: { texto: string | null }) {
  if (texto === null || texto === "") {
    return <span className="text-mxd-gris">(vacío)</span>;
  }
  const corto = texto.length > 80 ? `${texto.slice(0, 80)}…` : texto;
  return <span title={texto.length > 80 ? texto : undefined}>{corto}</span>;
}

export default async function PaginaHistorial({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  const { sku: skuCrudo } = await searchParams;
  // El SKU solo se usa como parametro de la consulta, pero se acota igual.
  const sku = skuCrudo && /^[A-Za-z0-9_-]{1,64}$/.test(skuCrudo) ? skuCrudo : undefined;

  const cambios = await leerCambios({ sku, limite: LIMITE });
  const piezas = new Map(obtenerTodas().map((p) => [p.sku, p]));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-mxd-tinta">Historial del BOM</h1>
        <p className="mt-1 text-sm text-mxd-gris">
          Quién cambió qué y cuándo. {sku ? `Solo la pieza ${sku}. ` : ""}
          Se muestran los últimos {LIMITE} cambios.
          {sku && (
            <>
              {" "}
              <Link href="/historial" className="font-medium text-mxd-verde-oscuro underline">
                Ver todos
              </Link>
            </>
          )}
        </p>
      </div>

      {cambios.length === 0 ? (
        <p className="text-sm text-mxd-gris">Todavía no hay cambios registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mxd-borde">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-mxd-borde bg-mxd-verde-claro/40 text-mxd-tinta">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Cuándo</th>
                <th scope="col" className="px-3 py-2 font-semibold">Quién</th>
                <th scope="col" className="px-3 py-2 font-semibold">Pieza</th>
                <th scope="col" className="px-3 py-2 font-semibold">Campo</th>
                <th scope="col" className="px-3 py-2 font-semibold">Antes</th>
                <th scope="col" className="px-3 py-2 font-semibold">Después</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map((c) => {
                const pieza = piezas.get(c.sku);
                return (
                  <tr key={c.id} className="border-b border-mxd-borde last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 text-mxd-gris">{fecha(c.fecha)}</td>
                    <td className="px-3 py-2 text-mxd-tinta">
                      {c.usuarioCorreo ?? <span className="text-mxd-gris">(script)</span>}
                    </td>
                    <td className="px-3 py-2">
                      {pieza ? (
                        <Link href={`/catalogo/${pieza.slug}`} className="font-medium text-mxd-verde-oscuro underline">
                          {c.sku}
                        </Link>
                      ) : (
                        c.sku
                      )}
                      {pieza && <span className="block text-xs text-mxd-gris">{pieza.nombre}</span>}
                    </td>
                    <td className="px-3 py-2 text-mxd-tinta">{nombreDeCampo(c.campo)}</td>
                    <td className="px-3 py-2 text-mxd-gris"><Valor texto={c.anterior} /></td>
                    <td className="px-3 py-2 text-mxd-tinta"><Valor texto={c.nuevo} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

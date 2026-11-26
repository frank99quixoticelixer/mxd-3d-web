import type { Metadata } from "next";
import Link from "next/link";

import { leerCambios, nombreDeCampo, puedeRestaurarse } from "@/lib/bom";
import { obtenerTodas } from "@/lib/catalogo";

import { BotonRestaurar } from "./BotonRestaurar";

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
  // Solo el cambio mas reciente de cada campo de cada pieza se puede restaurar:
  // los demas dejaron de ser lo vigente (la accion lo vuelve a comprobar).
  //
  // Una restauracion es ella misma un cambio, y si tambien llevara boton,
  // restaurar se volveria un vaiven: cada clic dejaria el valor de antes y el
  // siguiente el de ahora. Por eso una fila que solo deshace un cambio anterior
  // del mismo campo se marca como "Restauracion" y no ofrece restaurar. Para
  // cambiarlo otra vez se edita el campo en la ficha.
  const vacio = (v: string | null) => v ?? "";
  const restauraciones = new Set<number>();
  for (const c of cambios) {
    const deshaceUnoAnterior = cambios.some(
      (e) =>
        e.id < c.id &&
        e.sku === c.sku &&
        e.campo === c.campo &&
        vacio(e.anterior) === vacio(c.nuevo) &&
        vacio(e.nuevo) === vacio(c.anterior),
    );
    if (deshaceUnoAnterior) restauraciones.add(c.id);
  }
  const vistos = new Set<string>();
  const restaurables = new Set<number>();
  for (const c of cambios) {
    const llave = `${c.sku}\u0000${c.campo}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    if (puedeRestaurarse(c.campo) && c.anterior !== c.nuevo && !restauraciones.has(c.id)) {
      restaurables.add(c.id);
    }
  }

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
                <th scope="col" className="px-3 py-2 font-semibold">
                  <span className="sr-only">Restaurar</span>
                </th>
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
                    <td className="px-3 py-2 text-mxd-tinta">
                      {nombreDeCampo(c.campo)}
                      {restauraciones.has(c.id) && (
                        <span className="ml-2 rounded-full bg-mxd-verde-claro px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mxd-verde-oscuro">
                          Restauración
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-mxd-gris"><Valor texto={c.anterior} /></td>
                    <td className="px-3 py-2 text-mxd-tinta"><Valor texto={c.nuevo} /></td>
                    <td className="px-3 py-2">
                      {restaurables.has(c.id) && <BotonRestaurar idCambio={c.id} />}
                      {restauraciones.has(c.id) && <span className="text-xs text-mxd-gris">Ya restaurado</span>}
                    </td>
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

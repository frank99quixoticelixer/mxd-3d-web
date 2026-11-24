import type { Metadata } from "next";

import { LARGO_MAXIMO_NOMBRE_CORTE, leerCortes, type CorteBom } from "@/lib/bom-cortes";

import { crearCorteBom } from "./acciones";

export const metadata: Metadata = {
  title: "Cortes del BOM",
  robots: { index: false, follow: false },
};

// Lee la base en cada peticion: un corte recien creado debe verse al instante.
export const dynamic = "force-dynamic";

function fecha(valor: Date | string): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

export default async function PaginaCortes() {
  let cortes: CorteBom[] = [];
  let faltaTabla = false;
  try {
    cortes = await leerCortes();
  } catch (error) {
    // La tabla se crea con `npm run db:migrar -- --aplicar`; sin ella la pagina
    // lo dice en vez de romperse.
    if ((error as { code?: string }).code === "ER_NO_SUCH_TABLE") faltaTabla = true;
    else throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-mxd-tinta">Cortes del BOM</h1>
        <p className="mt-1 text-sm text-mxd-gris">
          Una foto con nombre del BOM completo, por ejemplo antes de una compra o al cerrar el mes.
          Cada corte se puede bajar como Excel tal como estaba ese día. No se edita ni cambia el
          BOM actual; para deshacer un cambio concreto usa «Restaurar» en el historial.
        </p>
      </div>

      {faltaTabla ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Falta la tabla de cortes en la base de datos. Hay que correr{" "}
          <code>npm run db:migrar -- --aplicar</code>.
        </p>
      ) : (
        <>
          <form action={crearCorteBom} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-mxd-tinta">
              Nombre del corte
              <input
                name="nombre"
                required
                maxLength={LARGO_MAXIMO_NOMBRE_CORTE}
                placeholder="BOM al cierre de diciembre"
                className="rounded-md border border-mxd-borde bg-mxd-hueso px-3 py-2 text-sm font-normal"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-mxd-verde px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro"
            >
              Crear corte
            </button>
          </form>

          {cortes.length === 0 ? (
            <p className="text-sm text-mxd-gris">Todavía no hay cortes.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-mxd-borde">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-mxd-borde bg-mxd-verde-claro/40 text-mxd-tinta">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Corte</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Cuándo</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Quién</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Piezas</th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      <span className="sr-only">Descarga</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cortes.map((c) => (
                    <tr key={c.id} className="border-b border-mxd-borde last:border-b-0">
                      <td className="px-3 py-2 font-medium text-mxd-tinta">{c.nombre}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-mxd-gris">{fecha(c.fecha)}</td>
                      <td className="px-3 py-2 text-mxd-tinta">
                        {c.creadoPor ?? <span className="text-mxd-gris">(script)</span>}
                      </td>
                      <td className="px-3 py-2 text-mxd-tinta">{c.piezas}</td>
                      <td className="px-3 py-2">
                        <a href={`/api/bom/cortes/${c.id}`} className="font-medium text-mxd-verde-oscuro underline">
                          Bajar Excel
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

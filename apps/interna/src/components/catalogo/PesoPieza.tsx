import Link from "next/link";

import { formatearKg, type OrigenPeso, type ResumenEnsamble } from "@/lib/pesos";
import type { PesoPropio } from "@/lib/pesos";

/**
 * "Peso": el peso unitario de la pieza y, si es un ensamble, el peso de sus
 * componentes y el total. De solo lectura: el peso unitario se captura en el
 * campo Masa de esta ficha o viene del maestro de partes; el total se calcula.
 */

const ORIGEN: Record<OrigenPeso, string> = {
  ficha: "capturado en la ficha",
  maestro: "del maestro de partes",
  suma: "suma de sus componentes",
};

export function PesoPieza({ propio, ensamble }: { propio: PesoPropio; ensamble: ResumenEnsamble | null }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">Peso</h2>
      <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4 py-3 text-sm text-mxd-tinta">
        <p>
          <span className="text-mxd-gris">Peso unitario: </span>
          {propio.kg !== null ? (
            <>
              <span className="font-medium">{formatearKg(propio.kg)}</span>
              {propio.origen && <span className="ml-2 text-xs text-mxd-gris">({ORIGEN[propio.origen]})</span>}
            </>
          ) : (
            <span className="text-mxd-gris">sin dato. Captura «Masa» en esta ficha.</span>
          )}
        </p>

        {ensamble && (
          <div className="mt-4 border-t border-mxd-borde pt-4">
            <p className="font-medium">Peso del ensamble</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-mxd-gris">
                  <tr>
                    <th className="py-1 pr-3 font-normal">Componente</th>
                    <th className="px-3 py-1 text-right font-normal">Cantidad</th>
                    <th className="px-3 py-1 text-right font-normal">Peso unitario</th>
                    <th className="py-1 pl-3 text-right font-normal">Peso total</th>
                  </tr>
                </thead>
                <tbody>
                  {ensamble.componentes.map((c) => (
                    <tr key={c.sku} className="border-t border-mxd-borde">
                      <td className="py-1.5 pr-3">
                        <Link href={`/catalogo/${c.slug}`} className="hover:text-mxd-verde hover:underline">
                          {c.nombre}
                        </Link>
                        <span className="ml-2 font-mono text-[10px] text-mxd-gris">{c.sku}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">{c.cantidad}</td>
                      <td className="px-3 py-1.5 text-right">
                        {c.pesoUnitarioKg !== null ? formatearKg(c.pesoUnitarioKg) : <span className="text-mxd-gris">sin dato</span>}
                        {c.origen === "suma" && <span className="ml-1 text-[10px] text-mxd-gris">(suma)</span>}
                      </td>
                      <td className="py-1.5 pl-3 text-right">
                        {c.subtotalKg !== null ? formatearKg(c.subtotalKg) : <span className="text-mxd-gris">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-mxd-borde font-semibold">
                    <td className="py-2 pr-3" colSpan={3}>
                      {ensamble.completo ? "Suma de componentes" : "Suma de lo que tiene peso"}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      {ensamble.sumaKg > 0 || ensamble.completo ? (
                        formatearKg(ensamble.sumaKg)
                      ) : (
                        <span className="font-normal text-mxd-gris">sin datos</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!ensamble.completo && (
              <p role="status" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {ensamble.sumaKg > 0 ? "Total parcial: " : "Sin total: "}a {ensamble.faltantes}{" "}
                {ensamble.faltantes === 1 ? "pieza" : "piezas"} les falta el peso
                {ensamble.sumaKg > 0 ? `. El real es mayor que ${formatearKg(ensamble.sumaKg)}` : ""}.
              </p>
            )}
            {propio.kg !== null && ensamble.completo && (
              <p className="mt-2 text-xs text-mxd-gris">
                Peso unitario del ensamble: {formatearKg(propio.kg)}; la suma de sus componentes es{" "}
                {formatearKg(ensamble.sumaKg)}
                {Math.abs(propio.kg - ensamble.sumaKg) > 0.005 ? ` (difieren en ${formatearKg(Math.abs(propio.kg - ensamble.sumaKg))})` : ""}.
              </p>
            )}
            <p className="mt-2 text-[11px] text-mxd-gris">
              La cantidad de cada componente sale de cuántos lleva el dron entre cuántos ensambles hay.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

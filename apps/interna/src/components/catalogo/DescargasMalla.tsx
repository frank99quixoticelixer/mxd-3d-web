import type { Pieza } from "@/lib/esquema";
import {
  FORMATOS,
  descargasDe,
  tamanoLegible,
  urlDescarga,
} from "@/lib/descargas";

/**
 * Descarga de las mallas (GLB y STL) de una pieza y de cada una de sus
 * subpiezas. Un renglon por SKU; solo se ofrecen los formatos que existen.
 */
export function DescargasMalla({
  pieza,
  subpiezas,
}: {
  pieza: Pieza;
  subpiezas: Pieza[];
}) {
  const renglones = [pieza, ...subpiezas].filter((p) =>
    FORMATOS.some((f) => descargasDe(p.sku)[f]),
  );
  if (renglones.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
        Archivos 3D
      </h2>
      <ul className="mt-3 divide-y divide-mxd-borde rounded-xl border border-mxd-borde bg-white">
        {renglones.map((p) => {
          const descargas = descargasDe(p.sku);
          return (
            <li
              key={p.sku}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-widest text-mxd-verde">
                  {p.sku}
                </p>
                <p className="truncate text-[13px] font-medium text-mxd-tinta">
                  {p.nombre}
                </p>
              </div>
              <div className="flex gap-2">
                {FORMATOS.map((formato) => {
                  const bytes = descargas[formato];
                  if (!bytes) return null;
                  return (
                    <a
                      key={formato}
                      href={urlDescarga(p.sku, formato)}
                      download
                      className="rounded-lg border border-mxd-borde px-3 py-1.5 text-xs font-medium text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
                    >
                      {formato.toUpperCase()}
                      <span className="ml-1.5 text-[10px] font-normal text-mxd-gris">
                        {tamanoLegible(bytes)}
                      </span>
                    </a>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

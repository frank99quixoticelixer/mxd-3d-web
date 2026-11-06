import type { Accesorio } from "@/data/accesorios";

/** Nombre, descripcion y especificaciones de un accesorio, debajo del visor. */
export function FichaAccesorio({ accesorio }: { accesorio: Accesorio }) {
  return (
    <div className="rounded-xl border border-mxd-borde bg-mxd-fondo p-4 sm:p-5">
      <h3 className="text-sm font-bold text-mxd-tinta">{accesorio.nombre}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-mxd-gris">
        {accesorio.descripcion}
      </p>

      {accesorio.caracteristicas.length > 0 ? (
        <dl className="mt-4 divide-y divide-mxd-borde border-t border-mxd-borde">
          {accesorio.caracteristicas.map((c) => (
            <div
              key={c.etiqueta}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <dt className="text-sm text-mxd-gris">{c.etiqueta}</dt>
              <dd className="text-right text-sm font-medium text-mxd-tinta">
                {c.valor}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-mxd-borde px-3 py-2.5 text-xs text-mxd-gris">
          Especificaciones pendientes de publicar.
        </p>
      )}
    </div>
  );
}

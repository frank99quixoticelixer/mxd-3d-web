import Link from "next/link";

import type { PartidaDeLaFicha, PartidaEnlazada } from "@/lib/partida-maestro";

/**
 * "Datos de su partida" y "Ensamble y componentes": lo que el maestro de partes
 * dice de esta pieza, de solo lectura. Se corrige en el maestro (Excel), no
 * aqui; lo que se captura en la ficha vive en el BOM.
 */

/** Columnas del maestro que se muestran, en este orden. */
const CAMPOS = [
  "Partida",
  "Nombre técnico (OEM)",
  "Sistema",
  "Tipo",
  "Rev.",
  "Estatus",
  "Criticidad",
  "Nivel",
  "Lado o posición",
  "Origen",
  "Modelos",
] as const;

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const pendiente = /^pendiente$/i.test(valor.trim());
  return (
    <div className="flex items-start justify-between gap-4 border-b border-mxd-borde py-2 last:border-0">
      <dt className="text-sm text-mxd-gris">{etiqueta}</dt>
      <dd className={`text-right text-sm ${pendiente ? "text-mxd-gris" : "font-medium text-mxd-tinta"}`}>{valor}</dd>
    </div>
  );
}

function Enlace({ p }: { p: PartidaEnlazada }) {
  const contenido = (
    <>
      <span className="font-medium">{p.nombre}</span>
      <span className="ml-2 font-mono text-[11px] text-mxd-gris">{p.numero}</span>
      {p.cantidad && <span className="ml-2 text-xs text-mxd-gris">× {p.cantidad}</span>}
    </>
  );
  return p.slug ? (
    <Link href={`/catalogo/${p.slug}`} className="hover:text-mxd-verde hover:underline">
      {contenido}
    </Link>
  ) : (
    <span>{contenido}</span>
  );
}

export function PartidaMaestro({ partidas, tieneNumero }: { partidas: PartidaDeLaFicha[]; tieneNumero: boolean }) {
  if (partidas.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">Partida del maestro</h2>
        <p className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4 py-3 text-sm text-mxd-gris">
          {tieneNumero
            ? "El número de parte de esta pieza no está en el maestro de partes."
            : "Esta pieza no tiene número de parte, así que no aparece en el maestro de partes."}{" "}
          Se asigna en «Compras» de esta ficha, o se cruza con una partida en{" "}
          <Link href="/maestro" className="underline hover:text-mxd-verde">
            el maestro
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <>
      {partidas.map((p) => {
        const cantidad = p.datos["Cant."];
        const unidad = p.datos["Unidad"];
        const filas = [
          { etiqueta: "No. parte MXD", valor: p.numero },
          ...CAMPOS.map((c) => ({ etiqueta: c, valor: p.datos[c] })),
          {
            etiqueta: "Cantidad por ensamble padre",
            valor: cantidad === null || cantidad === undefined ? null : `${cantidad}${unidad ? ` ${unidad}` : ""}`,
          },
          { etiqueta: "Observaciones del maestro", valor: p.datos["Observaciones"] },
        ]
          .filter((f) => f.valor !== null && f.valor !== undefined && f.valor !== "")
          .map((f) => ({ etiqueta: f.etiqueta, valor: String(f.valor) }));

        return (
          <div key={p.numero}>
            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
                Datos de su partida{partidas.length > 1 ? ` · ${p.numero}` : ""}
              </h2>
              <dl className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
                {filas.map((f) => (
                  <Fila key={f.etiqueta} etiqueta={f.etiqueta} valor={f.valor} />
                ))}
              </dl>
              <p className="mt-2 text-xs text-mxd-gris">
                Del maestro de partes; se corrige ahí. Lo que se captura en esta ficha (material, proveedor,
                notas) vive en el BOM.
              </p>
            </section>

            {(p.padre || p.hijos.length > 0) && (
              <section className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
                  Ensamble y componentes
                </h2>
                <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4 py-3 text-sm text-mxd-tinta">
                  {p.padre && (
                    <p>
                      <span className="text-mxd-gris">Forma parte de: </span>
                      <Enlace p={p.padre} />
                    </p>
                  )}
                  {p.hijos.length > 0 && (
                    <div className={p.padre ? "mt-3 border-t border-mxd-borde pt-3" : ""}>
                      <p className="text-mxd-gris">
                        Lo componen {p.hijos.length} {p.hijos.length === 1 ? "partida" : "partidas"}:
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {p.hijos.map((h) => (
                          <li key={h.numero}>
                            <Enlace p={h} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        );
      })}
    </>
  );
}

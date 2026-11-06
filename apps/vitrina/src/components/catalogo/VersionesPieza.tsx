import Link from "next/link";

import type { Pieza } from "@/lib/esquema";

/**
 * Versiones espejo de una pieza y si se surte dentro de su conjunto.
 *
 * Mismo componente en vitrina e interna. La vitrina no pasa `cruce` y sus
 * versiones llegan sin numero de parte (los recorta lib/publico.ts), asi que
 * ahi solo se ve que version va en cada lugar. Interna muestra ademas el numero
 * del maestro de cada version y como quedo el cruce.
 */
export function VersionesPieza({
  pieza,
  conjunto,
  cruce,
}: {
  pieza: Pick<Pieza, "nombre" | "variantes" | "surtidaEnConjunto" | "numeroBom">;
  /** El conjunto en el que se surte, si se surte en uno. */
  conjunto?: { nombre: string; slug: string } | null;
  /** Solo interna: estado del cruce con el maestro de partes. */
  cruce?: { estado: "confirmado" | "propuesto" | "sin-numero"; nota: string | null } | null;
}) {
  const conNumeros = pieza.variantes.some((v) => v.numeroBom);
  if (pieza.variantes.length === 0 && !pieza.surtidaEnConjunto && !cruce) return null;

  return (
    <section className="mt-10 rounded-2xl border border-mxd-borde bg-mxd-hueso p-5 sm:p-6">
      {pieza.variantes.length > 0 && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            {pieza.variantes.length} versiones, no intercambiables
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mxd-gris">
            Los brazos CW y CCW del MX80 son espejo uno del otro, igual que el
            lado derecho y el izquierdo del marco. Por eso esta pieza existe en
            dos versiones: cada una va solo en su lugar. Al pedirla, indica cuál
            necesitas.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {pieza.variantes.map((v) => (
              <li
                key={v.clave}
                className="rounded-xl border border-mxd-borde bg-mxd-fondo px-4 py-3"
              >
                <p className="text-sm font-semibold text-mxd-tinta">{v.etiqueta}</p>
                <p className="mt-0.5 text-xs text-mxd-gris">{v.posicion}</p>
                {conNumeros && (
                  <p className="mt-1.5 font-mono text-[11px] text-mxd-verde">
                    {v.numeroBom ?? "Sin número en el maestro"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {pieza.surtidaEnConjunto && (
        <p className={`text-sm leading-relaxed text-mxd-gris ${pieza.variantes.length > 0 ? "mt-4" : ""}`}>
          <span className="font-semibold text-mxd-tinta">Se surte con su conjunto.</span>{" "}
          No se pide por separado: viene dentro de{" "}
          {conjunto ? (
            <Link href={`/catalogo/${conjunto.slug}`} className="underline hover:text-mxd-verde">
              {conjunto.nombre}
            </Link>
          ) : (
            "su conjunto"
          )}
          . Está en el catálogo para ubicarla en el modelo 3D.
        </p>
      )}

      {cruce && (
        <div className={pieza.variantes.length > 0 || pieza.surtidaEnConjunto ? "mt-4 border-t border-mxd-borde pt-4" : ""}>
          <p className="text-xs font-bold uppercase tracking-widest text-mxd-gris">
            Maestro de partes
          </p>
          <p className="mt-1 text-sm text-mxd-tinta">
            {cruce.estado === "confirmado" && "Cruce confirmado"}
            {cruce.estado === "propuesto" && "Cruce propuesto, falta confirmarlo"}
            {cruce.estado === "sin-numero" && "Sin número en el maestro"}
            {pieza.numeroBom && !conNumeros && (
              <span className="ml-2 font-mono text-xs text-mxd-verde">{pieza.numeroBom}</span>
            )}
          </p>
          {cruce.nota && <p className="mt-1 text-xs leading-relaxed text-mxd-gris">{cruce.nota}</p>}
        </div>
      )}
    </section>
  );
}

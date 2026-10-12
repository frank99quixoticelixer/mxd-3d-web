import Image from "next/image";
import Link from "next/link";

import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_SUBSISTEMA,
  type Pieza,
} from "@/lib/esquema";
import { conVersion } from "@/lib/imagenes";
import { valorOPendiente } from "@/lib/texto";

/** Icono geometrico generado a partir del SKU: sustituto visual mientras no hay miniatura. */
function Marcador({ sku }: { sku: string }) {
  const semilla = sku.charCodeAt(sku.length - 1) % 4;
  return (
    <div className="flex h-28 items-center justify-center rounded-lg bg-mxd-hueso">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <g fill="none" stroke="#0F8A4C" strokeWidth="1.6" opacity="0.85">
          {semilla === 0 && (
            <>
              <circle cx="28" cy="28" r="18" />
              <circle cx="28" cy="28" r="7" />
            </>
          )}
          {semilla === 1 && (
            <>
              <rect x="10" y="10" width="36" height="36" rx="4" />
              <path d="M10 28h36M28 10v36" />
            </>
          )}
          {semilla === 2 && (
            <>
              <path d="M28 8l17 10v20L28 48 11 38V18z" />
              <circle cx="28" cy="28" r="6" />
            </>
          )}
          {semilla === 3 && (
            <>
              <path d="M12 34c8-14 24-14 32 0" />
              <circle cx="28" cy="34" r="5" />
              <path d="M28 8v16" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

export function TarjetaPieza({ pieza }: { pieza: Pieza }) {
  return (
    <Link
      href={`/catalogo/${pieza.slug}`}
      className="group flex flex-col rounded-xl border border-mxd-borde bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-mxd-verde hover:shadow-[0_8px_24px_-12px_rgba(15,138,76,0.35)]"
    >
      {pieza.imagen ? (
        <div className="relative h-28 overflow-hidden rounded-lg bg-mxd-hueso">
          <Image
            src={conVersion(pieza.imagen) ?? pieza.imagen}
            alt={pieza.nombre}
            fill
            // El optimizador de Next rechaza rutas locales con query string
            // (la usamos para el cache-busting por version). El archivo ya
            // sale liviano del pipeline de renders, asi que el costo es bajo.
            unoptimized
            className="object-cover"
          />
        </div>
      ) : (
        <Marcador sku={pieza.sku} />
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-widest text-mxd-verde">
          {pieza.sku}
        </span>
        <span className="rounded-full bg-mxd-verde-claro px-2 py-0.5 text-[10px] font-semibold text-mxd-verde-oscuro">
          {ETIQUETAS_SUBSISTEMA[pieza.subsistema]}
        </span>
      </div>

      <h3 className="mt-1.5 text-sm font-semibold leading-snug text-mxd-tinta group-hover:text-mxd-verde-oscuro">
        {pieza.nombre}
      </h3>

      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-mxd-gris">
        {pieza.descripcion}
      </p>

      <dl className="mt-3 flex items-center justify-between border-t border-mxd-borde pt-2.5 text-[11px]">
        <div>
          <dt className="text-mxd-gris">Masa</dt>
          <dd className="font-medium text-mxd-tinta">
            {valorOPendiente(pieza.especificaciones.masa_g, "g")}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-mxd-gris">Estado</dt>
          <dd className="font-medium text-mxd-tinta">
            {ETIQUETAS_ESTADO[pieza.estado]}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

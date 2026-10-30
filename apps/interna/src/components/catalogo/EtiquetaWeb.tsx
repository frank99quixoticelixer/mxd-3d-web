import Image from "next/image";

import { MARCA } from "@/config/marca";
import {
  cantidadPorDron,
  ETIQUETAS_SECCION,
  ETIQUETAS_SUBSISTEMA,
  ORDEN_SECCIONES,
  type Pieza,
} from "@/lib/esquema";

/**
 * Vista web de la etiqueta fisica de la pieza: mismo diseno y mismos campos
 * que public/brand/etiqueta-editor.html (el editor que se usa para imprimir
 * la etiqueta real) y que features/ficha-pdf/EtiquetaPieza.tsx (la version
 * que va en el PDF). Las tres muestran exactamente el mismo rotulo — aqui
 * para que se vea en el catalogo sin tener que abrir el editor ni descargar
 * el PDF.
 *
 * Solo vive en interna. En vitrina (catalogo publico) no se muestra: trae
 * datos de proveedor y numero de parte interno que no son para el publico.
 *
 * PROVEEDOR sale de especificaciones.proveedor. "Pendiente" significa que
 * todavia no se captura quien la surte, NO que la pieza se fabrique en
 * casa: el catalogo no distingue las dos cosas todavia, asi que esta vista
 * tampoco lo afirma.
 */

function modulo(pieza: Pieza): string {
  return pieza.categoria ?? ETIQUETAS_SUBSISTEMA[pieza.subsistema];
}

function ubicacion(pieza: Pieza): string {
  if (pieza.secciones.length === 0) return "Pendiente";
  return ORDEN_SECCIONES.filter((s) => pieza.secciones.includes(s))
    .map((s) => ETIQUETAS_SECCION[s])
    .join(", ");
}

function Campo({
  etiqueta,
  valor,
  mono = false,
  grande = false,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
  grande?: boolean;
}) {
  const pendiente = valor === "Pendiente";
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-black">
        {etiqueta}
      </p>
      <p
        className={[
          "mt-1 border-b border-black pb-1.5 leading-tight",
          mono ? "font-mono" : "font-sans",
          grande ? "text-xl" : "text-sm",
          pendiente ? "italic font-normal text-black/50" : "font-bold text-black",
        ].join(" ")}
      >
        {valor}
      </p>
    </div>
  );
}

export function EtiquetaWeb({ pieza }: { pieza: Pieza }) {
  const total = cantidadPorDron(pieza);
  const cantidad = total > 0 ? String(total) : "Pendiente";

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-black bg-white">
      <div className="flex items-center justify-between bg-black px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white">
          Etiqueta de pieza
        </p>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white">
          MXD
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,0.75fr)_1px_minmax(0,1.5fr)]">
        {/* Columna izquierda: lo que identifica el lote. */}
        <div className="flex flex-col gap-4 p-4">
          {/* El archivo public/brand/logo-mxd.svg declara width=474
              height=474 (cuadrado): MARCA.logo.altoHeader (32) no es su
              proporcion real, por eso con esos numeros salia achatado.
              Cuadrado real -> width=height aqui tambien. Centrado y grande:
              es lo primero que se ve de este lado de la etiqueta. */}
          <Image
            src={MARCA.logo.src}
            alt={MARCA.logo.alt}
            width={474}
            height={474}
            unoptimized
            className="mx-auto h-24 w-24 self-center"
          />
          <Campo etiqueta="Modelo" valor={pieza.modelo} grande />
          <Campo etiqueta="Cantidad / dron" valor={cantidad} grande />
          <Campo
            etiqueta="Proveedor"
            valor={pieza.especificaciones.proveedor ?? "Pendiente"}
          />
        </div>

        <div className="bg-black" />

        {/* Columna derecha: lo que identifica la pieza en si. */}
        <div className="flex flex-col gap-4 p-4">
          <Campo etiqueta="Nombre de la pieza" valor={pieza.nombre} />
          <Campo etiqueta="SKU" valor={pieza.sku} mono grande />
          <div className="grid grid-cols-2 gap-4">
            <Campo etiqueta="Modulo" valor={modulo(pieza)} />
            <Campo etiqueta="Ubicacion" valor={ubicacion(pieza)} />
          </div>
          <Campo
            etiqueta="No. de parte MXD (BOM)"
            valor={pieza.numeroBom ?? "Pendiente"}
            mono
          />
        </div>
      </div>
    </div>
  );
}

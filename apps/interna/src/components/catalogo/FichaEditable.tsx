"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { agregarAlBom, guardarEspecificaciones } from "@/app/catalogo/[slug]/acciones";
import {
  CAMPOS_COMPRAS,
  CAMPOS_COSTOS,
  CAMPOS_ESPECIFICACIONES,
  CAMPOS_TRAZABILIDAD,
  ETIQUETAS_GRUPO_MATERIAL,
  monedaTexto,
  textoValor,
  valorInicial,
  type CampoFicha,
} from "@/lib/campos-ficha";
import { costoMaterial, costoProduccionTotal } from "@/lib/costos";
import type { Pieza } from "@/lib/esquema";

/**
 * NO importar nada de "@/lib/bom" aqui: usa exceljs (node:fs), rompe en el
 * navegador. `@/lib/campos-ficha` es client-safe a proposito -- es la
 * frontera entre el server (que sabe leer/escribir el Excel) y el cliente
 * (que solo arma el formulario), y tambien la comparte ficha-pdf/FichaPieza.tsx
 * para que la ficha web y la ficha en PDF no se desincronicen.
 *
 * `clave` tiene que ser EXACTAMENTE el nombre de columna que espera
 * acciones.ts (que a su vez lo toma de COLUMNAS_BOM), salvo donde se anota
 * lo contrario en valorInicial().
 */

function FilaValor({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const pendiente = valor === "Pendiente" || valor === "N/A";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-mxd-borde py-2.5 last:border-0">
      <dt className="text-sm text-mxd-gris">{etiqueta}</dt>
      <dd className={pendiente ? "text-sm italic text-mxd-gris/70" : "text-sm font-medium text-mxd-tinta"}>
        {valor}
      </dd>
    </div>
  );
}

function FilaInput({ campo, valor }: { campo: CampoFicha; valor: string | number | boolean | null }) {
  if (campo.tipo === "seleccionGiro") {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-mxd-borde py-2 last:border-0">
        <label htmlFor={campo.clave} className="text-sm text-mxd-gris">
          {campo.etiqueta}
        </label>
        <select
          id={campo.clave}
          name={campo.clave}
          defaultValue={(valor as string) ?? ""}
          className="rounded-md border border-mxd-borde bg-mxd-hueso px-2 py-1 text-sm text-mxd-tinta"
        >
          <option value="">Pendiente</option>
          <option value="CW">CW</option>
          <option value="CCW">CCW</option>
        </select>
      </div>
    );
  }
  if (campo.tipo === "seleccionMaterial") {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-mxd-borde py-2 last:border-0">
        <label htmlFor={campo.clave} className="text-sm text-mxd-gris">
          {campo.etiqueta}
        </label>
        <select
          id={campo.clave}
          name={campo.clave}
          defaultValue={(valor as string) ?? ""}
          className="rounded-md border border-mxd-borde bg-mxd-hueso px-2 py-1 text-sm text-mxd-tinta"
        >
          <option value="">Automático (reglas del visor)</option>
          {Object.entries(ETIQUETAS_GRUPO_MATERIAL).map(([clave, etiqueta]) => (
            <option key={clave} value={clave}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (campo.tipo === "seleccionBooleano") {
    const inicial = valor === true ? "si" : valor === false ? "no" : "";
    return (
      <div className="flex items-center justify-between gap-4 border-b border-mxd-borde py-2 last:border-0">
        <label htmlFor={campo.clave} className="text-sm text-mxd-gris">
          {campo.etiqueta}
        </label>
        <select
          id={campo.clave}
          name={campo.clave}
          defaultValue={inicial}
          className="rounded-md border border-mxd-borde bg-mxd-hueso px-2 py-1 text-sm text-mxd-tinta"
        >
          <option value="">Pendiente</option>
          <option value="si">Sí, in-house (MXD)</option>
          <option value="no">No, maquilado afuera</option>
        </select>
      </div>
    );
  }
  if (campo.tipo === "seleccionSiNo") {
    const inicial = valor === true ? "si" : valor === false ? "no" : "";
    return (
      <div className="flex items-center justify-between gap-4 border-b border-mxd-borde py-2 last:border-0">
        <label htmlFor={campo.clave} className="text-sm text-mxd-gris">
          {campo.etiqueta}
        </label>
        <select
          id={campo.clave}
          name={campo.clave}
          defaultValue={inicial}
          className="rounded-md border border-mxd-borde bg-mxd-hueso px-2 py-1 text-sm text-mxd-tinta"
        >
          <option value="">Pendiente</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 border-b border-mxd-borde py-2 last:border-0">
      <label htmlFor={campo.clave} className="text-sm text-mxd-gris">
        {campo.etiqueta}
        {campo.unidad ? ` (${campo.unidad})` : ""}
      </label>
      <input
        id={campo.clave}
        name={campo.clave}
        type={campo.tipo === "numero" ? "number" : "text"}
        step={campo.tipo === "numero" ? "any" : undefined}
        defaultValue={(valor as string | number | null) ?? ""}
        className="w-48 rounded-md border border-mxd-borde bg-mxd-hueso px-2 py-1 text-sm text-mxd-tinta"
      />
    </div>
  );
}

/** Lo que la ficha sabe de la pieza en el BOM (ver EstadoBom en lib/bom.ts, que no se importa aqui). */
export interface EstadoBomFicha {
  enBom: boolean;
  /** Version del BOM que vio quien abrio la ficha; se manda al guardar para no pisar cambios ajenos. */
  version: number;
  origen: string | null;
  origenNota: string | null;
}

/**
 * Aviso de la ficha sobre el origen de la pieza en el BOM. Una pieza sin fila
 * ofrece sumarla; una sumada a mano lo dice, porque no viene del maestro de
 * partes original y quien lea el BOM debe saberlo.
 */
function AvisoOrigen({ estado, sku, slug }: { estado: EstadoBomFicha; sku: string; slug: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [agregando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function agregar() {
    const datos = new FormData();
    datos.set("sku", sku);
    datos.set("slug", slug);
    startTransition(async () => {
      const resultado = await agregarAlBom(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setError(null);
      setConfirmando(false);
      router.refresh();
    });
  }

  if (estado.enBom && estado.origen !== "agregada") return null;

  return (
    <div role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      {estado.enBom ? (
        <>
          <p className="font-semibold">Agregada al BOM a mano</p>
          <p className="mt-1 text-xs leading-relaxed">
            {estado.origenNota ?? "No viene del maestro de partes original."} En el Excel del BOM
            sale marcada con el origen «agregada».
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">Esta pieza no está en el BOM maestro</p>
          <p className="mt-1 text-xs leading-relaxed">
            Lo que ves viene del catálogo del 3D y no se guarda en ningún BOM. Si la agregas (o si
            la editas), queda marcada como agregada a mano, con quién y cuándo, y sale así en el
            Excel.
          </p>
          {confirmando ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">¿Agregar {sku} al BOM maestro?</span>
              <button
                type="button"
                disabled={agregando}
                onClick={agregar}
                className="rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
              >
                {agregando ? "Agregando…" : "Sí, agregar"}
              </button>
              <button
                type="button"
                disabled={agregando}
                onClick={() => setConfirmando(false)}
                className="rounded-md border border-amber-400 px-3 py-1 text-xs font-semibold hover:bg-amber-100"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="mt-3 rounded-md border border-amber-500 px-3 py-1 text-xs font-semibold hover:bg-amber-100"
            >
              Agregar al BOM maestro
            </button>
          )}
          {error && <p className="mt-2 text-xs font-medium text-red-800">{error}</p>}
        </>
      )}
    </div>
  );
}

export function FichaEditable({
  pieza,
  slug,
  estadoBom,
  filasFijas = [],
}: {
  pieza: Pieza;
  slug: string;
  estadoBom: EstadoBomFicha;
  /** Filas de solo lectura (no viven en el BOM: secciones/cantidad vienen de mx80.ts). */
  filasFijas?: { etiqueta: string; valor: string }[];
}) {
  const [editando, setEditando] = useState(false);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(async () => {
      const resultado = await guardarEspecificaciones(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setError(null);
      setEditando(false);
      router.refresh();
    });
  }

  const camposEspecVisibles = CAMPOS_ESPECIFICACIONES.filter(
    (c) => !pieza.camposNoAplican.includes(c.clave),
  );
  const camposComprasVisibles = CAMPOS_COMPRAS;
  const camposCostosVisibles = CAMPOS_COSTOS.filter(
    (c) => !pieza.camposNoAplican.includes(c.clave),
  );
  const camposTrazabilidadVisibles = CAMPOS_TRAZABILIDAD.filter(
    (c) => !pieza.camposNoAplican.includes(c.clave),
  );

  if (!editando) {
    return (
      <>
        <AvisoOrigen estado={estadoBom} sku={pieza.sku} slug={slug} />
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
              Especificaciones
            </h2>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-md border border-mxd-borde px-3 py-1 text-xs font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
            >
              Editar
            </button>
          </div>
          <dl className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
            {filasFijas.map((f) => (
              <FilaValor key={f.etiqueta} etiqueta={f.etiqueta} valor={f.valor} />
            ))}
            {camposEspecVisibles.map((c) => (
              <FilaValor key={c.clave} etiqueta={c.etiqueta} valor={textoValor(pieza, c)} />
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-mxd-gris">
            Los campos pendientes aún no han sido medidos ni verificados. &ldquo;N/A&rdquo;
            significa que ese dato no aplica a esta pieza, no que falte.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            Compras e inventario
          </h2>
          <dl className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
            {camposComprasVisibles.map((c) => (
              <FilaValor key={c.clave} etiqueta={c.etiqueta} valor={textoValor(pieza, c)} />
            ))}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            Costos de producción
          </h2>
          <dl className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
            {camposCostosVisibles.map((c) => (
              <FilaValor key={c.clave} etiqueta={c.etiqueta} valor={textoValor(pieza, c)} />
            ))}
            {/* Calculados, no editables: salen de costo_masa_g + costo_material
                (lib/costos.ts). Se muestran aqui para no perder el total que ya
                daba la version anterior de esta seccion. */}
            {!pieza.camposNoAplican.includes("costo_material") && (
              <>
                <FilaValor etiqueta="Costo de material (calculado)" valor={monedaTexto(costoMaterial(pieza))} />
                <FilaValor etiqueta="Costo total de producción" valor={monedaTexto(costoProduccionTotal(pieza))} />
              </>
            )}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
            Trazabilidad
          </h2>
          <dl className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
            {camposTrazabilidadVisibles.map((c) => (
              <FilaValor key={c.clave} etiqueta={c.etiqueta} valor={textoValor(pieza, c)} />
            ))}
          </dl>
        </section>
      </>
    );
  }

  return (
    <form onSubmit={onGuardar}>
      <input type="hidden" name="sku" value={pieza.sku} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="version" value={estadoBom.version} />

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
          Especificaciones
        </h2>
        <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
          {filasFijas.map((f) => (
            <FilaValor key={f.etiqueta} etiqueta={f.etiqueta} valor={f.valor} />
          ))}
          {camposEspecVisibles.map((c) => (
            <FilaInput key={c.clave} campo={c} valor={valorInicial(pieza, c.clave)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
          Compras e inventario
        </h2>
        <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
          {camposComprasVisibles.map((c) => (
            <FilaInput key={c.clave} campo={c} valor={valorInicial(pieza, c.clave)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
          Costos de producción
        </h2>
        <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
          {camposCostosVisibles.map((c) => (
            <FilaInput key={c.clave} campo={c} valor={valorInicial(pieza, c.clave)} />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-mxd-gris">
          El costo de material y el total se calculan solos a partir de la masa y el material de
          producción; no se escriben a mano.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mxd-gris">
          Trazabilidad
        </h2>
        <div className="mt-3 rounded-xl border border-mxd-borde bg-mxd-fondo px-4">
          {camposTrazabilidadVisibles.map((c) => (
            <FilaInput key={c.clave} campo={c} valor={valorInicial(pieza, c.clave)} />
          ))}
        </div>
      </section>

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-mxd-verde px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-mxd-verde-oscuro disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={() => {
            setError(null);
            setEditando(false);
          }}
          className="rounded-lg border border-mxd-borde px-5 py-2 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {/* El formulario manda todos los campos: guardar sobre una version vieja
              revertiria lo que la otra persona cambio. Hay que volver a abrir la
              ficha ya actualizada. */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditando(false);
              router.refresh();
            }}
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-semibold hover:bg-red-100"
          >
            Descartar mis cambios y recargar
          </button>
        </div>
      )}
    </form>
  );
}

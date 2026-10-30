"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { guardarEspecificaciones } from "@/app/catalogo/[slug]/acciones";
import { costoMaterial, costoProduccionTotal } from "@/lib/costos";
import type { Pieza } from "@/lib/esquema";

/**
 * NO importar nada de "@/lib/bom" aqui: usa exceljs (node:fs), rompe en el
 * navegador. Esta lista es client-safe a proposito, aunque duplique las
 * claves de COLUMNAS_BOM -- es la frontera entre el server (que sabe leer/
 * escribir el Excel) y el cliente (que solo arma el formulario).
 *
 * `clave` tiene que ser EXACTAMENTE el nombre de columna que espera
 * acciones.ts (que a su vez lo toma de COLUMNAS_BOM), salvo donde se anota
 * lo contrario.
 */
type TipoCampo = "numero" | "texto" | "seleccionGiro" | "seleccionBooleano";
type CampoFicha = { clave: string; etiqueta: string; tipo: TipoCampo; unidad?: string };

const CAMPOS_ESPECIFICACIONES: CampoFicha[] = [
  { clave: "masa_g", etiqueta: "Masa", tipo: "numero", unidad: "g" },
  { clave: "largo_mm", etiqueta: "Largo", tipo: "numero", unidad: "mm" },
  { clave: "ancho_mm", etiqueta: "Ancho", tipo: "numero", unidad: "mm" },
  { clave: "alto_mm", etiqueta: "Alto", tipo: "numero", unidad: "mm" },
  { clave: "tolerancia_mm", etiqueta: "Tolerancia general", tipo: "numero", unidad: "mm" },
  { clave: "par_apriete_nm", etiqueta: "Par de apriete", tipo: "numero", unidad: "N·m" },
  { clave: "numero_tornillos", etiqueta: "No. de tornillos", tipo: "numero" },
  { clave: "material", etiqueta: "Material", tipo: "texto" },
  { clave: "acabado", etiqueta: "Acabado", tipo: "texto" },
  { clave: "proceso_fabricacion", etiqueta: "Proceso de fabricación", tipo: "texto" },
  { clave: "rosca", etiqueta: "Rosca", tipo: "texto" },
  { clave: "longitud_mm", etiqueta: "Longitud", tipo: "numero", unidad: "mm" },
  { clave: "sentido_giro", etiqueta: "Sentido de giro", tipo: "seleccionGiro" },
  { clave: "modulo_conectado", etiqueta: "Módulo al que conecta", tipo: "texto" },
  { clave: "volumen_ml", etiqueta: "Volumen", tipo: "numero", unidad: "mL" },
  { clave: "diametro_tubo_mm", etiqueta: "Diámetro de tubo", tipo: "numero", unidad: "mm" },
  { clave: "grosor_pared_mm", etiqueta: "Grosor de pared", tipo: "numero", unidad: "mm" },
  { clave: "diametro_barreno_mm", etiqueta: "Diámetro de barreno", tipo: "numero", unidad: "mm" },
  { clave: "ancho_perfil_mm", etiqueta: "Ancho de perfil", tipo: "numero", unidad: "mm" },
  { clave: "alto_perfil_mm", etiqueta: "Alto de perfil", tipo: "numero", unidad: "mm" },
  { clave: "motor_kv", etiqueta: "Motor: KV", tipo: "numero", unidad: "RPM/V" },
  { clave: "motor_voltaje_nominal_v", etiqueta: "Motor: voltaje nominal", tipo: "numero", unidad: "V" },
  { clave: "motor_rpm_nominal", etiqueta: "Motor: RPM nominal", tipo: "numero" },
  { clave: "motor_torque_nominal_nm", etiqueta: "Motor: torque nominal", tipo: "numero", unidad: "N·m" },
  { clave: "motor_torque_max_nm", etiqueta: "Motor: torque máximo", tipo: "numero", unidad: "N·m" },
  { clave: "notas", etiqueta: "Notas", tipo: "texto" },
];

const CAMPOS_COMPRAS: CampoFicha[] = [
  { clave: "numero_parte_mxd", etiqueta: "Número de parte (BOM)", tipo: "texto" },
  { clave: "proveedor", etiqueta: "Proveedor", tipo: "texto" },
  { clave: "parte_proveedor", etiqueta: "Parte del proveedor", tipo: "texto" },
  { clave: "precio_mxn", etiqueta: "Precio", tipo: "numero", unidad: "MXN" },
  { clave: "stock", etiqueta: "Existencias", tipo: "numero", unidad: "pzas" },
];

const CAMPOS_COSTOS: CampoFicha[] = [
  { clave: "costo_fabricado_inhouse", etiqueta: "Fabricado in-house", tipo: "seleccionBooleano" },
  { clave: "costo_equipo", etiqueta: "Equipo de producción", tipo: "texto" },
  { clave: "costo_material", etiqueta: "Material de producción", tipo: "texto" },
  { clave: "costo_masa_g", etiqueta: "Masa de producción", tipo: "numero", unidad: "g" },
  { clave: "costo_horas_produccion", etiqueta: "Horas de producción", tipo: "numero", unidad: "h" },
  { clave: "costo_pintura_mxn", etiqueta: "Costo de pintura", tipo: "numero", unidad: "MXN" },
  { clave: "costo_mano_obra_mxn", etiqueta: "Costo de mano de obra", tipo: "numero", unidad: "MXN" },
  { clave: "costo_notas", etiqueta: "Notas de costos", tipo: "texto" },
];

/** Las pocas claves donde el nombre de columna del BOM no coincide con donde vive el dato en Pieza. */
function valorInicial(pieza: Pieza, clave: string): string | number | boolean | null {
  if (clave === "numero_parte_mxd") return pieza.numeroBom;
  if (clave === "proceso_fabricacion") return pieza.proceso_fabricacion;
  if (clave === "precio_mxn") return pieza.precio_mxn;
  if (clave === "stock") return pieza.stock;
  if (clave === "costo_fabricado_inhouse") return pieza.costosProduccion.fabricadoInhouse;
  if (clave === "costo_equipo") return pieza.costosProduccion.equipo;
  if (clave === "costo_material") return pieza.costosProduccion.material;
  if (clave === "costo_masa_g") return pieza.costosProduccion.masaG;
  if (clave === "costo_horas_produccion") return pieza.costosProduccion.horasProduccion;
  if (clave === "costo_pintura_mxn") return pieza.costosProduccion.costoPinturaMxn;
  if (clave === "costo_mano_obra_mxn") return pieza.costosProduccion.costoManoObraMxn;
  if (clave === "costo_notas") return pieza.costosProduccion.notas;
  return (pieza.especificaciones as unknown as Record<string, string | number | null>)[clave] ?? null;
}

function monedaTexto(valor: number | null): string {
  return valor === null
    ? "Pendiente"
    : valor.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function textoValor(pieza: Pieza, campo: CampoFicha): string {
  if (pieza.camposNoAplican.includes(campo.clave)) return "N/A";
  const valor = valorInicial(pieza, campo.clave);
  // Un tornillo sin par documentado no es un dato faltante: es que no hace
  // falta torquimetro para esa pieza (ver comentario en EspecificacionesEsquema).
  if (campo.clave === "par_apriete_nm" && valor === null && pieza.especificaciones.numero_tornillos) {
    return "Apriete manual";
  }
  if (valor === null || valor === "") return "Pendiente";
  if (campo.tipo === "seleccionBooleano") return valor ? "In-house (MXD)" : "Maquilado afuera";
  if (campo.unidad === "MXN") return monedaTexto(valor as number);
  return campo.unidad ? `${valor} ${campo.unidad}` : String(valor);
}

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

export function FichaEditable({
  pieza,
  slug,
  filasFijas = [],
}: {
  pieza: Pieza;
  slug: string;
  /** Filas de solo lectura (no viven en el BOM: secciones/cantidad vienen de mx80.ts). */
  filasFijas?: { etiqueta: string; valor: string }[];
}) {
  const [editando, setEditando] = useState(false);
  const [guardando, startTransition] = useTransition();
  const router = useRouter();

  function onGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(async () => {
      await guardarEspecificaciones(datos);
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

  if (!editando) {
    return (
      <>
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
      </>
    );
  }

  return (
    <form onSubmit={onGuardar}>
      <input type="hidden" name="sku" value={pieza.sku} />
      <input type="hidden" name="slug" value={slug} />

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
          onClick={() => setEditando(false)}
          className="rounded-lg border border-mxd-borde px-5 py-2 text-sm font-semibold text-mxd-tinta transition-colors hover:border-mxd-verde hover:text-mxd-verde"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

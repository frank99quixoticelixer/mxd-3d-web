/**
 * Migracion de una sola corrida: genera el BOM_MX80.xlsx inicial a partir de
 * lo que ya existe hoy (especificaciones-mx80.json via datosDeFicha + los
 * campos de compras/inventario hardcodeados en mx80.ts: numeroBom,
 * precio_mxn, stock).
 *
 * Despues de esto, BOM_MX80.xlsx es la fuente de verdad: no se vuelve a
 * correr este script salvo que se quiera reconstruir el archivo desde cero
 * (y entonces se pierde cualquier edicion hecha en vivo despues de la
 * primera migracion -- por eso rehusa pisar un archivo ya existente).
 *
 * Uso: npx tsx scripts/migrar-a-bom.ts [--force]
 */
import ExcelJS from "exceljs";
import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PIEZAS_MX80 } from "../src/data/mx80";
import { COLUMNAS_BOM, RUTA_BOM, type FilaBom } from "../src/lib/bom";

async function main() {
  const forzar = process.argv.includes("--force");
  const yaExiste = await access(RUTA_BOM).then(() => true).catch(() => false);
  if (yaExiste && !forzar) {
    console.error(
      `${RUTA_BOM} ya existe. No lo piso para no perder ediciones en vivo.\n` +
        `Si de verdad quieres reconstruirlo desde cero: npx tsx scripts/migrar-a-bom.ts --force`,
    );
    process.exit(1);
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("BOM_MX80");
  hoja.addRow(COLUMNAS_BOM.map((c) => c.encabezado));
  hoja.getRow(1).font = { bold: true };

  for (const pieza of PIEZAS_MX80) {
    const fila: FilaBom = {
      sku: pieza.sku,
      nombre: pieza.nombre,
      categoria: pieza.categoria,
      proceso_fabricacion: pieza.proceso_fabricacion,
      descripcion_funcional: pieza.descripcion_funcional,
      especificaciones_tecnicas: pieza.especificaciones_tecnicas,
      camposNoAplican: pieza.camposNoAplican,
      numero_parte_mxd: pieza.numeroBom,
      precio_mxn: pieza.precio_mxn,
      stock: pieza.stock,
      costo_fabricado_inhouse: pieza.costosProduccion.fabricadoInhouse,
      costo_equipo: pieza.costosProduccion.equipo,
      costo_material: pieza.costosProduccion.material,
      costo_masa_g: pieza.costosProduccion.masaG,
      costo_horas_produccion: pieza.costosProduccion.horasProduccion,
      costo_pintura_mxn: pieza.costosProduccion.costoPinturaMxn,
      costo_mano_obra_mxn: pieza.costosProduccion.costoManoObraMxn,
      costo_notas: pieza.costosProduccion.notas,
      ...pieza.especificaciones,
    };
    const valores = COLUMNAS_BOM.map((col) => {
      const v = (fila as unknown as Record<string, unknown>)[col.clave];
      if (col.tipo === "lista") return ((v as string[]) ?? []).join("; ");
      if (col.tipo === "listaCorta") return ((v as string[]) ?? []).join(",");
      return v ?? null;
    });
    hoja.addRow(valores);
  }

  await mkdir(dirname(RUTA_BOM), { recursive: true });
  await libro.xlsx.writeFile(RUTA_BOM);
  console.log(`Migrado: ${PIEZAS_MX80.length} piezas -> ${RUTA_BOM}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

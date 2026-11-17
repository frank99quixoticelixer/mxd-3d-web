/**
 * Carga el BOM en la base de datos (tabla bom_piezas). Se corre una vez al
 * pasar del Excel a la base, y despues solo para sumar piezas nuevas.
 *
 *   npm run bom:importar                          Excel -> base, muestra que haria
 *   npm run bom:importar -- --aplicar             lo aplica
 *   npm run bom:importar -- --archivo=ruta.xlsx   otro Excel (por defecto
 *                                                 contenido/BOM_MX80.xlsx)
 *   npm run bom:importar -- --reemplazar          vacia la tabla primero (pierde
 *                                                 ediciones hechas en la base)
 *   npm run bom:agregar                           suma al BOM las piezas del
 *                                                 catalogo que aun no tienen
 *                                                 fila (las nuevas del GLB)
 *
 * Sin --reemplazar rehusa si la tabla ya tiene filas, para no pisar ediciones.
 * La carga inicial no escribe historial (bom_cambios): no son cambios de nadie.
 *
 * Antes hay que crear las tablas: npm run db:migrar -- --aplicar
 */
import { PIEZAS_MX80 } from "../src/data/mx80";
import { cargarFilasIniciales, filaDesdePieza, type FilaBom } from "../src/lib/bom";
import { RUTA_BOM, leerFilasDeExcel } from "../src/lib/bom-excel";
import { obtenerPool } from "../src/lib/db";

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes("--aplicar");
const reemplazar = argumentos.includes("--reemplazar");
const agregarFaltantes = argumentos.includes("--agregar-faltantes");
const archivo = argumentos.find((a) => a.startsWith("--archivo="))?.slice("--archivo=".length) ?? RUTA_BOM;

async function main() {
  if (!obtenerPool()) {
    console.error("Falta configuracion de la base de datos (DB_* en apps/interna/.env.local).");
    process.exit(1);
  }

  let filas: FilaBom[];
  if (agregarFaltantes) {
    filas = PIEZAS_MX80.map((p) => filaDesdePieza(p));
    console.log(`Catalogo: ${filas.length} piezas.`);
  } else {
    filas = await leerFilasDeExcel(archivo);
    console.log(`${archivo}: ${filas.length} filas leidas.`);
    const repetidos = filas.map((f) => f.sku).filter((s, i, todos) => todos.indexOf(s) !== i);
    if (repetidos.length > 0) {
      console.error(`SKU repetidos en el Excel: ${[...new Set(repetidos)].join(", ")}. Corrigelos antes de importar.`);
      process.exit(1);
    }
  }

  if (!aplicar) {
    console.log(
      `\nNo se cambio nada. Repite con --aplicar para ${
        agregarFaltantes ? "agregar solo las piezas que faltan" : reemplazar ? "reemplazar el BOM de la base" : "cargarlo"
      }.`,
    );
    return;
  }

  const { insertadas, yaExistian } = await cargarFilasIniciales(filas, {
    reemplazar,
    soloFaltantes: agregarFaltantes,
  });
  console.log(`\nListo: ${insertadas} filas insertadas, ${yaExistian} ya estaban y no se tocaron.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);

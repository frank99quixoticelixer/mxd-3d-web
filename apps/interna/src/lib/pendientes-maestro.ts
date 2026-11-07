import MAESTRO from "@/data/maestro-mx80.json";
import type { Pieza } from "@/lib/esquema";

/**
 * Lo que falta para que el catalogo y el maestro de partes queden enlazados
 * por completo. Lo usan la pagina /maestro y la descarga CSV
 * (/api/maestro/pendientes), para que las dos digan exactamente lo mismo.
 *
 * Cuatro listas:
 *   porConfirmar   cruces "propuesto": hay un numero (o varios candidatos)
 *                  pero alguien que conozca el BOM debe confirmarlo
 *   porDarDeAlta   piezas sin numero que si se compran o se fabrican: diseno
 *                  MXD nuevo o piezas que el maestro no separa
 *   tornilleria    tornillos, arandelas, tuercas e insertos sin numero: el
 *                  maestro casi no desglosa tornilleria
 *   partidasSinPieza  partidas del maestro que no tienen pieza en el 3D
 *
 * No entran las subpiezas que se surten dentro de su conjunto (la PDB, el
 * motor, la bateria): no necesitan numero propio. Tampoco los conjuntos del
 * catalogo sin numero (el cableado del brazo, el tren): son agrupaciones para
 * navegar, no algo que se compre como unidad.
 */

export interface PartidaMaestro {
  numero: string;
  nombre: string | null;
  nombreOem: string | null;
  sistema: string | null;
  cantidad: number | null;
  unidad: string | null;
  posicion: string | null;
}

export interface PendientesMaestro {
  porConfirmar: Pieza[];
  porDarDeAlta: Pieza[];
  tornilleria: Pieza[];
  partidasSinPieza: PartidaMaestro[];
}

const esTornilleria = (p: Pieza) =>
  /sujeci|torniller|tornillo|arandela|tuerca|inserto/i.test(`${p.categoria ?? ""} ${p.nombre}`);

/** Todos los numeros del maestro que alguna pieza (o version) ya lleva. */
export function numerosEnlazados(piezas: readonly Pieza[]): Set<string> {
  const usados = new Set<string>();
  for (const p of piezas) {
    for (const n of p.numeroBom?.split(" / ") ?? []) usados.add(n.trim());
    for (const v of p.variantes) if (v.numeroBom) usados.add(v.numeroBom);
  }
  return usados;
}

export function pendientesMaestro(piezas: readonly Pieza[]): PendientesMaestro {
  const tieneHijas = new Set(piezas.map((p) => p.parteDe).filter(Boolean));
  const sinNumero = piezas.filter(
    (p) => p.cruceBom?.estado === "sin-numero" && !p.surtidaEnConjunto && !tieneHijas.has(p.sku),
  );
  const usados = numerosEnlazados(piezas);
  return {
    porConfirmar: piezas.filter((p) => p.cruceBom?.estado === "propuesto"),
    porDarDeAlta: sinNumero.filter((p) => !esTornilleria(p)),
    tornilleria: sinNumero.filter(esTornilleria),
    partidasSinPieza: (MAESTRO.partidas as PartidaMaestro[]).filter(
      (m) => m.sistema !== "PRD" && !usados.has(m.numero),
    ),
  };
}

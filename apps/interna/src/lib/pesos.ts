/**
 * Pesos: el peso unitario de una pieza y el peso de un ensamble sumando sus
 * componentes. Calculo puro, sin base de datos: quien lo llama le da de donde
 * sacar el peso de cada pieza (lib/pesos-ensamble.ts).
 *
 * El peso del ensamble NO se captura: se calcula (cantidad x peso unitario de
 * cada componente, hacia abajo si un componente es a su vez un ensamble). Si a
 * alguna pieza le falta el peso, el resultado dice cuantas faltan en vez de dar
 * un total que parezca completo.
 */
import { cantidadPorDron, type Pieza } from "./esquema";

/** De donde sale un peso: capturado en la ficha, del maestro de partes, o sumado de los componentes. */
export type OrigenPeso = "ficha" | "maestro" | "suma";

export interface PesoPropio {
  kg: number | null;
  origen: "ficha" | "maestro" | null;
}

export interface FilaComponente {
  sku: string;
  slug: string;
  nombre: string;
  /** Cuantas lleva el ensamble. */
  cantidad: number;
  pesoUnitarioKg: number | null;
  origen: OrigenPeso | null;
  /** cantidad x peso unitario; null si falta el peso. */
  subtotalKg: number | null;
  /** Piezas sin peso dentro de este componente (1 si es el propio componente). */
  faltantes: number;
}

export interface ResumenEnsamble {
  componentes: FilaComponente[];
  /** Suma de lo que si tiene peso. Es el total solo si `faltantes` es 0. */
  sumaKg: number;
  faltantes: number;
  completo: boolean;
}

/**
 * Cuantas unidades de `hijo` lleva un `padre`. El catalogo solo sabe cuantas
 * hay por dron de cada uno, asi que se divide: 4 tuercas por dron en 4
 * balanceadores por dron son 1 por balanceador. Si no sale entero, 1.
 */
export function cantidadEnPadre(hijo: Pieza, padre: Pieza): number {
  const delPadre = cantidadPorDron(padre);
  const n = delPadre > 0 ? cantidadPorDron(hijo) / delPadre : 1;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function resumirEnsamble(
  pieza: Pieza,
  hijosDe: (sku: string) => Pieza[],
  pesoPropio: (sku: string) => PesoPropio,
  profundidad = 0,
): ResumenEnsamble {
  const componentes: FilaComponente[] = [];
  let sumaKg = 0;
  let faltantes = 0;

  for (const hijo of hijosDe(pieza.sku)) {
    const cantidad = cantidadEnPadre(hijo, pieza);
    const propio = pesoPropio(hijo.sku);
    const nietos = profundidad < 5 ? hijosDe(hijo.sku) : [];
    const fila: FilaComponente = {
      sku: hijo.sku,
      slug: hijo.slug,
      nombre: hijo.nombre,
      cantidad,
      pesoUnitarioKg: null,
      origen: null,
      subtotalKg: null,
      faltantes: 0,
    };

    if (propio.kg !== null) {
      fila.pesoUnitarioKg = propio.kg;
      fila.origen = propio.origen;
      fila.subtotalKg = cantidad * propio.kg;
      sumaKg += fila.subtotalKg;
    } else if (nietos.length > 0) {
      // Un subensamble sin peso propio: se suma lo que lo compone.
      const interno = resumirEnsamble(hijo, hijosDe, pesoPropio, profundidad + 1);
      fila.faltantes = interno.faltantes;
      sumaKg += cantidad * interno.sumaKg;
      if (interno.completo) {
        fila.pesoUnitarioKg = interno.sumaKg;
        fila.origen = "suma";
        fila.subtotalKg = cantidad * interno.sumaKg;
      }
      faltantes += interno.faltantes;
    } else {
      fila.faltantes = 1;
      faltantes += 1;
    }
    componentes.push(fila);
  }

  return { componentes, sumaKg, faltantes, completo: faltantes === 0 };
}

/** "1.234 kg": hasta 3 decimales, sin ceros de relleno. */
export function formatearKg(kg: number): string {
  return `${kg.toLocaleString("es-MX", { maximumFractionDigits: 3 })} kg`;
}

/**
 * La partida del maestro de partes que le corresponde a una pieza, con su
 * ensamble padre y sus componentes. Alimenta los bloques "Datos de su partida" y
 * "Ensamble y componentes" de la ficha.
 *
 * Una pieza llega a su partida por el numero de parte que tiene en el BOM, por
 * el de cada version (CW/CCW, derecha/izquierda) o por el cruce de
 * data/cruce-maestro.ts. Los datos salen de la tabla maestro_partidas (el repo
 * no los guarda: es publico).
 *
 * Solo servidor.
 */
import { CRUCE_MAESTRO } from "@/data/cruce-maestro";

import { obtenerPiezaPorSku } from "./catalogo";
import type { Pieza } from "./esquema";
import { leerMaestro, type PartidaMaestro, type ValorMaestro } from "./maestro-base";
import { numerosEnUso, SIN_DUENO } from "./numeros-en-uso";

/** Una partida vista desde una ficha: lo suyo y a que pieza del catalogo corresponde, si alguna. */
export interface PartidaEnlazada {
  numero: string;
  nombre: string;
  /** Cantidad por ensamble padre y su unidad ("4 pza"), si el maestro la trae. */
  cantidad: string | null;
  /** Ficha del catalogo a la que apunta, si la partida esta cruzada con una pieza. */
  slug: string | null;
}

export interface PartidaDeLaFicha {
  numero: string;
  /** Columnas del maestro por titulo. */
  datos: Record<string, ValorMaestro>;
  padre: PartidaEnlazada | null;
  hijos: PartidaEnlazada[];
}

function texto(v: ValorMaestro | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/** Las partidas de la pieza (una, o una por version). Vacio si no tiene numero o si la base no responde. */
export async function partidasDeLaPieza(pieza: Pieza): Promise<PartidaDeLaFicha[]> {
  const cruce = CRUCE_MAESTRO[pieza.sku];
  const numeros = [
    ...new Set(
      [pieza.numeroBom, cruce?.numero, ...Object.values(cruce?.porVariante ?? {})].filter(
        (n): n is string => Boolean(n),
      ),
    ),
  ];
  if (numeros.length === 0) return [];

  let maestro: PartidaMaestro[];
  let duenos: Map<string, string>;
  try {
    [maestro, duenos] = await Promise.all([leerMaestro(), numerosEnUso()]);
  } catch {
    // Sin la tabla (aun sin migrar) o sin base: la ficha sigue sin este bloque.
    return [];
  }
  const porNumero = new Map(maestro.map((p) => [p.numero, p]));

  const enlazar = (p: PartidaMaestro): PartidaEnlazada => {
    const dueno = duenos.get(p.numero);
    const slug = dueno && dueno !== SIN_DUENO ? (obtenerPiezaPorSku(dueno)?.slug ?? null) : null;
    const cant = texto(p.datos["Cant."]);
    const unidad = texto(p.datos["Unidad"]);
    return {
      numero: p.numero,
      nombre: texto(p.datos["Nombre corto"]) ?? texto(p.datos["Nombre técnico (OEM)"]) ?? p.numero,
      cantidad: cant ? `${cant}${unidad ? ` ${unidad}` : ""}` : null,
      slug,
    };
  };

  return numeros
    .map((numero) => porNumero.get(numero))
    .filter((p): p is PartidaMaestro => Boolean(p))
    .map((p) => {
      const numeroPadre = texto(p.datos["Ensamble padre"]);
      const padre = numeroPadre ? porNumero.get(numeroPadre) : undefined;
      return {
        numero: p.numero,
        datos: p.datos,
        // El maestro a veces apunta a un padre que no es una partida (p. ej.
        // PRO-ENS-000, el ensamble de nivel 1 del sistema): se muestra su numero.
        padre: padre
          ? enlazar(padre)
          : numeroPadre
            ? { numero: numeroPadre, nombre: "Ensamble de nivel 1", cantidad: null, slug: null }
            : null,
        hijos: maestro
          .filter((h) => h.numero !== p.numero && texto(h.datos["Ensamble padre"]) === p.numero)
          .map(enlazar),
      };
    });
}

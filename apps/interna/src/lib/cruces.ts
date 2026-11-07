import { MODELO_PREDETERMINADO } from "@/config/modelos3d";
import MAESTRO from "@/data/maestro-mx80.json";
import {
  escribirNumerosVariantes,
  escribirPieza,
  filaDesdePieza,
  leerBom,
  type CambiosFilaBom,
} from "@/lib/bom";
import { conBomTodas, obtenerTodas } from "@/lib/catalogo";

/** Un cambio de la pagina /maestro sobre el cruce de una pieza. */
export interface CambioCruce {
  sku: string;
  /** Version de la pieza ("cw", "der"...), o null para la pieza entera. */
  variante: string | null;
  /** Numero del maestro; null = quitar la asociacion. */
  numero: string | null;
  estado: "confirmado" | "propuesto";
}

/**
 * Guarda en el BOM editable los cruces hechos en /maestro: asociar una
 * partida a una pieza (o a una version de ella), confirmar un cruce propuesto
 * o quitarlo.
 *
 * Todo se valida contra lo que existe: el numero tiene que estar en el
 * maestro, la pieza en el catalogo y la version en la pieza. Asi un formulario
 * alterado no puede escribir un numero inventado en el BOM.
 */
export async function aplicarCruces(cambios: CambioCruce[]): Promise<{ piezas: number }> {
  if (!Array.isArray(cambios) || cambios.length === 0) return { piezas: 0 };
  if (cambios.length > 500) throw new Error("Demasiados cambios en una sola guardada.");

  const numerosMaestro = new Set((MAESTRO.partidas as { numero: string }[]).map((p) => p.numero));
  const piezas = await conBomTodas(obtenerTodas(MODELO_PREDETERMINADO));
  const porSku = new Map(piezas.map((p) => [p.sku, p]));
  const bom = await leerBom();

  const porPieza = new Map<string, CambioCruce[]>();
  for (const c of cambios) {
    if (typeof c?.sku !== "string" || !porSku.has(c.sku)) {
      throw new Error(`Pieza desconocida: ${String(c?.sku)}`);
    }
    if (c.numero !== null && !numerosMaestro.has(c.numero)) {
      throw new Error(`El numero ${c.numero} no esta en el maestro de partes.`);
    }
    if (c.estado !== "confirmado" && c.estado !== "propuesto") {
      throw new Error(`Estado de cruce invalido: ${String(c.estado)}`);
    }
    const lista = porPieza.get(c.sku) ?? [];
    lista.push(c);
    porPieza.set(c.sku, lista);
  }

  for (const [sku, lista] of porPieza) {
    const pieza = porSku.get(sku)!;
    let numeroPieza = pieza.numeroBom;
    const porVersion: Record<string, string> = Object.fromEntries(
      pieza.variantes.filter((v) => v.numeroBom).map((v) => [v.clave, v.numeroBom as string]),
    );
    let estado: string | null = pieza.cruceBom?.estado ?? null;

    for (const c of lista) {
      if (c.variante !== null) {
        if (!pieza.variantes.some((v) => v.clave === c.variante)) {
          throw new Error(`${sku} no tiene la version "${c.variante}".`);
        }
        if (c.numero) porVersion[c.variante] = c.numero;
        else delete porVersion[c.variante];
      } else {
        numeroPieza = c.numero;
      }
      estado = c.estado;
    }

    // Con versiones, el numero de la pieza entera es el de sus versiones: es
    // el que va al BOM y a la ficha PDF, y uno solo mentiria.
    if (pieza.variantes.length > 0 && lista.some((c) => c.variante !== null)) {
      const unicos = [...new Set(Object.values(porVersion))];
      numeroPieza = unicos.length > 0 ? unicos.join(" / ") : null;
    }
    const tieneNumero = Boolean(numeroPieza) || Object.keys(porVersion).length > 0;

    const fila: CambiosFilaBom = {
      // Fila nueva: se siembra con lo que hoy dice el catalogo, para no
      // borrar la ficha (ver filaDesdePieza).
      ...(bom.has(sku) ? {} : filaDesdePieza(pieza)),
      numero_parte_mxd: numeroPieza,
      numeros_variantes: escribirNumerosVariantes(porVersion),
      cruce_estado: tieneNumero ? estado : "sin-numero",
    };
    await escribirPieza(sku, fila, pieza.nombre);
  }

  return { piezas: porPieza.size };
}

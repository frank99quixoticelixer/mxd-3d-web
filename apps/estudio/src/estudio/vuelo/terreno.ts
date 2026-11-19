/**
 * Suelo para el simulador de vuelo: la altura del terreno en cada punto.
 *
 * Los mapas con relieve traen una rejilla de alturas exportada de Blender
 * (scripts/exportar_entorno.py): <base>.json con su tamano y <base>.bin con
 * las alturas en enteros de 16 bits. Aqui se lee y se interpola.
 *
 * Coordenadas: el simulador trabaja en NED (n = norte, e = este). En la
 * rejilla, x = este y y = norte (los ejes de Blender), asi que x = e, y = n.
 */

/** Altura del suelo [m] en un punto NED (n, e). */
export type AlturaSuelo = (n: number, e: number) => number;

export const SUELO_PLANO: AlturaSuelo = () => 0;

interface MetaAlturas {
  mitad: number;
  paso: number;
  n: number;
  zMin: number;
  escala: number;
}

/** Carga la rejilla de alturas; si no hay (mapa plano), el suelo es y = 0. */
export async function cargarSuelo(base: string | null): Promise<AlturaSuelo> {
  if (!base) return SUELO_PLANO;
  const [meta, bin] = await Promise.all([
    fetch(`${base}.json`).then((r) => r.json() as Promise<MetaAlturas>),
    fetch(`${base}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const valores = new Uint16Array(bin);
  const { mitad, paso, n, zMin, escala } = meta;
  const en = (i: number, j: number) => zMin + valores[j * n + i] * escala;

  return (norte, este) => {
    // Fuera de la rejilla se toma el borde mas cercano.
    const fx = Math.min(Math.max((este + mitad) / paso, 0), n - 1.0001);
    const fy = Math.min(Math.max((norte + mitad) / paso, 0), n - 1.0001);
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const abajo = en(i, j) * (1 - tx) + en(i + 1, j) * tx;
    const arriba = en(i, j + 1) * (1 - tx) + en(i + 1, j + 1) * tx;
    return abajo * (1 - ty) + arriba * ty;
  };
}

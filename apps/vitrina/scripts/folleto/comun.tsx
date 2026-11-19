/**
 * Piezas comunes de los PDF comerciales del MX80 (folleto y ficha tecnica):
 * paleta, logo, filtro de caracteres y los dibujos vectoriales.
 *
 * Usan Helvetica, que viene con el lector de PDF. Esa fuente solo tiene los
 * caracteres de Windows-1252: los que no estan (≈, ≥, μ griega) se traducen, y
 * cualquier otro detiene el script en vez de salir como un cuadro vacio.
 *
 * Reglas del equipo para estos documentos: sin renders ni fotos (los que hay
 * no son del modelo actual) y sin enlaces a paginas web.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Circle, Defs, Font, G, Image, Line, LinearGradient, Rect, Stop, Svg, Text, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { Style } from "@react-pdf/types";

import { COLORES } from "../../src/config/marca";

// Sin guiones de corte: react-pdf parte las palabras con reglas del ingles
// ("an-tena"). En espanol se ve mal; mejor que la linea salga mas corta.
Font.registerHyphenationCallback((palabra) => [palabra]);

export const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------------------------------------------------------------------------
// Texto: solo lo que Helvetica puede dibujar
// ---------------------------------------------------------------------------

const TRADUCCIONES: [RegExp, string][] = [
  [/≈\s*/g, "aprox. "],
  [/≥\s*(.+)/g, "$1 o más"], // "≥ 5.5 min" -> "5.5 min o más"
  [/μ/g, "µ"], // mu griega -> signo micro, que si esta en Windows-1252
  [/−/g, "-"], // signo menos -> guion
];
const EXTRA_1252 = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function t(texto: string): string {
  let s = texto;
  for (const [patron, reemplazo] of TRADUCCIONES) s = s.replace(patron, reemplazo);
  for (const c of s) {
    if (c.charCodeAt(0) > 0xff && !EXTRA_1252.has(c)) {
      throw new Error(`Caracter sin glifo en Helvetica: "${c}" en "${texto}". Agregalo a TRADUCCIONES.`);
    }
  }
  return s;
}

export const LOGO = readFileSync(path.join(RAIZ, "public/brand/logo-mxd.png"));

// ---------------------------------------------------------------------------
// Paleta y medidas
// ---------------------------------------------------------------------------

export const C = {
  ...COLORES,
  fondoOscuro: "#06301C",
  lineaClara: "#7FD8A4",
  ambar: "#F59E0B",
  rojo: "#DC2626",
};

/**
 * Paleta sobria (profesional, minimalista): blanco, tinta casi negra, grises y
 * el verde de marca solo como acento. La cabecera es un bloque carbon solido,
 * sobre el que va el render de lineas (lineas claras).
 */
export const P = {
  tinta: "#15191B",
  gris: "#69726E",
  grisClaro: "#9AA4A0",
  regla: "#DDE2DF",
  suave: "#F4F6F5",
  banda: "#121618",
  textoBanda: "#C5CDC9",
  apagadoBanda: "#7F8A85",
  acento: COLORES.verde,
  blanco: "#FFFFFF",
};

export const ANCHO = 612; // carta, en puntos
export const ALTO = 792;
export const M = 40; // margen

// ---------------------------------------------------------------------------
// Dibujos (vectores, no imagenes)
// ---------------------------------------------------------------------------

/**
 * Vista superior esquematica a escala: cuatro rotores en las diagonales (2640 mm
 * entre ejes opuestos, helices de 1608 mm) y la cota de operacion del manual.
 */
export function EsquemaSuperior({ ancho = 236, estilo }: { ancho?: number; estilo?: Style }) {
  const W = ancho;
  const escala = (W - 30) / 3577; // pt por mm
  const cx = W / 2;
  const cy = W / 2 - 6;
  const brazo = (2640 / 2 / Math.SQRT2) * escala;
  const radioHelice = (1608 / 2) * escala;
  const k = W / 236; // los detalles crecen con el dibujo
  const rotores = [
    [cx - brazo, cy - brazo],
    [cx + brazo, cy - brazo],
    [cx + brazo, cy + brazo],
    [cx - brazo, cy + brazo],
  ];
  const cota = 3577 * escala;
  const yCota = cy + 3384 * escala * 0.5 + 10 * k;
  return (
    <Svg width={W} height={W + 8 * k} style={estilo}>
      {rotores.map(([x, y], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={radioHelice} stroke={C.lineaClara} strokeWidth={0.8} strokeOpacity={0.55} fill={C.verde} fillOpacity={0.12} />
          <Line x1={cx} y1={cy} x2={x} y2={y} stroke={C.verdeClaro} strokeWidth={3.2 * k} strokeLinecap="round" />
          <Line
            x1={x - radioHelice * 0.92}
            y1={y + (i % 2 ? 1 : -1) * radioHelice * 0.12}
            x2={x + radioHelice * 0.92}
            y2={y - (i % 2 ? 1 : -1) * radioHelice * 0.12}
            stroke={C.blanco}
            strokeWidth={1.4 * k}
            strokeOpacity={0.85}
            strokeLinecap="round"
          />
          <Circle cx={x} cy={y} r={4.5 * k} fill={C.verdeAcento} />
        </G>
      ))}
      <Rect x={cx - 17 * k} y={cy - 25 * k} width={34 * k} height={50 * k} rx={9 * k} fill={C.blanco} />
      <Rect x={cx - 11 * k} y={cy - 17 * k} width={22 * k} height={26 * k} rx={5 * k} fill={C.verdeClaro} />
      <Circle cx={cx} cy={cy + 17 * k} r={3 * k} fill={C.verde} />
      {/* Cota del ancho en operacion */}
      <Line x1={cx - cota / 2} y1={yCota} x2={cx + cota / 2} y2={yCota} stroke={C.lineaClara} strokeWidth={0.7} />
      <Line x1={cx - cota / 2} y1={yCota - 4} x2={cx - cota / 2} y2={yCota + 4} stroke={C.lineaClara} strokeWidth={0.7} />
      <Line x1={cx + cota / 2} y1={yCota - 4} x2={cx + cota / 2} y2={yCota + 4} stroke={C.lineaClara} strokeWidth={0.7} />
      <Rect x={cx - 26} y={yCota - 6} width={52} height={12} fill={C.fondoOscuro} />
      <Text x={cx - 20} y={yCota + 3} style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }} fill={C.lineaClara}>
        3577 mm
      </Text>
    </Svg>
  );
}

/**
 * Render de lineas del MX80 (dibujo tecnico, fondo transparente, lineas claras),
 * hecho en el Estudio MX80 con el estilo "lineas" y los brazos desplegados.
 * Es fuente de los PDF, no se sirve en el sitio. Si falta, se usa el esquema.
 */
const RUTA_LINEAS = path.join(RAIZ, "scripts/folleto/mx80-lineas.png");
const RENDER_LINEAS = existsSync(RUTA_LINEAS) ? readFileSync(RUTA_LINEAS) : null;

export function DronLineas({ ancho, estilo }: { ancho: number; estilo?: Style }) {
  if (!RENDER_LINEAS) return <EsquemaSuperior ancho={ancho} estilo={estilo} />;
  // Proporcion del PNG, de su cabecera (IHDR: ancho y alto en los bytes 16-23).
  const proporcion = RENDER_LINEAS.readUInt32BE(16) / RENDER_LINEAS.readUInt32BE(20);
  return <Image src={RENDER_LINEAS} style={[{ width: ancho, height: ancho / proporcion }, estilo ?? {}]} />;
}

/** Fondo verde con degradado y surcos tenues, a todo lo ancho. */
export function FondoDegradado({ alto, id }: { alto: number; id: string }) {
  return (
    <Svg width={ANCHO} height={alto} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.verdeOscuro} />
          <Stop offset="1" stopColor={C.fondoOscuro} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={ANCHO} height={alto} fill={`url(#${id})`} />
      {Array.from({ length: 16 }, (_, i) => (
        <Line key={i} x1={-200 + i * 56} y1={alto} x2={60 + i * 56} y2={0} stroke={C.blanco} strokeOpacity={0.035} strokeWidth={14} />
      ))}
    </Svg>
  );
}

/** Escribe el PDF en public/ y reporta su peso. */
export async function escribirPdf(documento: ReactElement, rutaPublica: string, constante: string) {
  const destino = path.join(RAIZ, "public", rutaPublica);
  mkdirSync(path.dirname(destino), { recursive: true });
  // renderToBuffer espera un <Document>; los componentes de este folder lo son.
  writeFileSync(destino, await renderToBuffer(documento as Parameters<typeof renderToBuffer>[0]));
  const kb = statSync(destino).size / 1024;
  console.log(`[pdf] ${path.relative(RAIZ, destino)} (${kb.toFixed(0)} KB)`);
  console.log(`[pdf] Si cambio el peso, actualiza ${constante}.`);
}

import * as THREE from "three";

import type { Ancla } from "./Dron";

/**
 * Dibuja las etiquetas sobre la imagen exportada, con el mismo estilo que en
 * pantalla: punto en la pieza, linea a 45 grados y el texto en un recuadro.
 *
 * Todo se escala con el alto de la imagen (referencia: 1080 px), para que en
 * 4K no salgan diminutas ni en 9:16 enormes.
 */
export function dibujarEtiquetas(
  ctx: CanvasRenderingContext2D,
  anclas: readonly Ancla[],
  camara: THREE.Camera,
  ancho: number,
  alto: number,
) {
  const s = alto / 1080;
  ctx.save();
  ctx.font = `600 ${Math.round(26 * s)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  for (const a of anclas) {
    if (!a.visible) continue;
    const p = a.punto.clone().project(camara);
    if (p.z >= 1) continue; // detras de la camara
    const x = ((p.x + 1) / 2) * ancho;
    const y = ((1 - p.y) / 2) * alto;
    const fin = { x: x + 55 * s, y: y - 55 * s };

    // Linea
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(fin.x, fin.y);
    ctx.stroke();

    // Punto
    ctx.fillStyle = "#0f8a4c";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(x, y, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Recuadro con el texto
    const relleno = 14 * s;
    const anchoTexto = ctx.measureText(a.texto).width;
    const caja = { x: fin.x, y: fin.y - 22 * s, w: anchoTexto + relleno * 2, h: 44 * s };
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath();
    ctx.roundRect(caja.x, caja.y, caja.w, caja.h, 8 * s);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(a.texto, caja.x + relleno, fin.y);
  }
  ctx.restore();
}

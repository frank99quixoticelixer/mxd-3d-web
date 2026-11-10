/**
 * Accesorios que se venden junto con el MX80 (no son piezas del chasis: no
 * tienen SKU de catalogo ni viven en el GLB del dron). Cada uno tiene su
 * propio GLB, independiente del ensamble principal, salvo los que declaran
 * `sku` (la bateria): esos se sacan del GLB del dron.
 *
 * Las caracteristicas y los modelos 3D finales no existen todavia. Un
 * `glb: null` muestra una primitiva generica en el visor (ver
 * EscenaAccesorio.tsx); una lista de `caracteristicas` vacia no muestra tabla
 * en la interfaz. Nada aqui se inventa: se llena conforme llegue la
 * informacion real.
 */

export interface CaracteristicaAccesorio {
  etiqueta: string;
  valor: string;
}

export interface Accesorio {
  /** Identificador estable, usado como clave de seleccion en la interfaz. */
  id: string;
  nombre: string;
  descripcion: string;
  caracteristicas: CaracteristicaAccesorio[];
  /**
   * Ruta del GLB relativa a /models (se sirve desde protegido/models/, nunca
   * desde public/), o null si todavia no hay modelo.
   * Pasa por urlModelo() (config/modelos3d.ts) antes de usarse, igual que
   * los GLB del dron.
   */
  glb: string | null;
  /**
   * SKU de la pieza del catalogo que lo representa, cuando el modelo ya viene
   * dentro del GLB del dron (la bateria va montada en el). El visor la saca de
   * ese mismo GLB, igual que la ficha de la pieza; no hay descarga extra.
   * Tiene prioridad sobre `glb`.
   */
  sku?: string;
}

export const ACCESORIOS_MX80: Accesorio[] = [
  {
    id: "bateria",
    nombre: "Batería",
    descripcion:
      "Cada MX80 incluye dos baterías: una alimenta al dron y la otra se mantiene cargada como reserva. Al terminar el vuelo, se sustituye por la de reserva y la operación continúa sin esperar la recarga. Aquí se muestra su carcasa.",
    // Fuente: ficha del proveedor (fuentes/accesorios/, fuera de git).
    // Solo datos del vendedor o medidos; el fin de carga (supuesto) no se
    // publica. Fabricante y numero de parte se quedan fuera: son de compras.
    caracteristicas: [
      { etiqueta: "Configuración", valor: "18S" },
      { etiqueta: "Voltaje nominal", valor: "68.4 V" },
      { etiqueta: "Capacidad", valor: "30 000 mAh" },
      { etiqueta: "Energía", valor: "2 052 Wh" },
      { etiqueta: "Química", valor: "Ion de litio NCM" },
      { etiqueta: "Peso", valor: "13.5 kg" },
      { etiqueta: "Dimensiones", valor: "175 × 275 × 309 mm" },
      { etiqueta: "Descarga", valor: "8C (aprox. 240 A)" },
      { etiqueta: "Carga", valor: "4C (aprox. 120 A)" },
      { etiqueta: "Vida útil", valor: "600 ciclos" },
      { etiqueta: "Indicadores", valor: "5 LED de nivel de carga y botón de encendido" },
      { etiqueta: "Garantía", valor: "12 meses" },
    ],
    glb: null,
    // Carcasa de la bateria (nodo BAT_Carcasa del GLB del dron).
    sku: "MX80-017-01",
  },
  // El generador (estacion de carga en campo) se agrega cuando se revise la
  // licencia de su modelo 3D: el repo es publico y un GLB commiteado no se
  // puede retirar del historial.
  {
    id: "cargador",
    nombre: "Cargador de batería",
    descripcion:
      "Cargador de un canal para las baterías 18S del MX80: la batería entra parada en su cajón y se conecta sola.",
    // Fuente: ficha del proveedor (fuentes/accesorios/, fuera de git):
    // (medidas del equipo y fotos; no hay ficha publica). El voltaje de
    // entrada es un supuesto y la potencia no se conoce: no se publican.
    caracteristicas: [
      { etiqueta: "Canales", valor: "1" },
      { etiqueta: "Baterías compatibles", valor: "18S del MX80" },
      { etiqueta: "Dimensiones", valor: "302 × 330 × 370 mm (ancho × fondo × alto)" },
      { etiqueta: "Panel", valor: "LED de carga, operación y alarma; botón de inicio y paro" },
      { etiqueta: "Ventilación", valor: "2 ventiladores de 92 mm" },
      { etiqueta: "Alimentación", valor: "Cable fijo con clavija industrial tipo CEE" },
    ],
    glb: "models/accesorios/cargador_18S_v1_web.glb",
  },
];

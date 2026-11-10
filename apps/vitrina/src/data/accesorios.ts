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
   * Ruta del GLB relativa a public/, o null si todavia no hay modelo.
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
    caracteristicas: [],
    glb: null,
    // Carcasa de la bateria (nodo BAT_Carcasa del GLB del dron).
    sku: "MX80-017-01",
  },
  // El generador (estacion de carga en campo) se agrega cuando exista su
  // modelo 3D. Su GLB de referencia se retiro: no debe publicarse.
];

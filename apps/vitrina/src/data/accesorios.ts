/**
 * Accesorios que se venden junto con el MX80 (no son piezas del chasis: no
 * tienen SKU de catalogo ni viven en el GLB del dron). Cada uno tiene su
 * propio GLB, independiente del ensamble principal.
 *
 * Ni las caracteristicas ni los modelos 3D finales existen todavia. Un
 * `glb: null` muestra una primitiva generica en el visor (ver
 * EscenaAccesorio.tsx); una lista de `caracteristicas` vacia se muestra como
 * "pendiente" en la interfaz. Nada aqui se inventa: se llena conforme llegue
 * la informacion real.
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
}

export const ACCESORIOS_MX80: Accesorio[] = [
  {
    id: "bateria",
    nombre: "Batería",
    descripcion:
      "Batería de cambio rápido del MX80. Ficha técnica y modelo 3D en preparación.",
    caracteristicas: [],
    glb: null,
  },
  {
    id: "generador",
    nombre: "Generador",
    descripcion:
      "Estación de carga en campo para el MX80. El modelo que se ve aquí es de referencia; ficha técnica en preparación.",
    caracteristicas: [],
    // Placeholder generico (no es el modelo final): convertido desde un OBJ
    // de referencia. Cambia esta ruta cuando llegue el modelo real.
    glb: "models/accesorios/generador_placeholder_v1.glb",
  },
];

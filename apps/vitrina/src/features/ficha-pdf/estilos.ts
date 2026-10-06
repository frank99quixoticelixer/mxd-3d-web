import { StyleSheet } from "@react-pdf/renderer";

import { COLORES } from "@/config/marca";

/**
 * Estilos de la ficha tecnica en PDF.
 *
 * Los colores salen de src/config/marca.ts, el mismo archivo que usan la web y
 * el visor 3D: si se cambia el verde de marca, el PDF cambia con el resto.
 *
 * La tipografia es Helvetica a proposito. Va incrustada en el estandar PDF, asi
 * que no hay que registrar ni descargar una fuente en tiempo de compilacion, y
 * el documento abre identico en cualquier lector. Registrar una fuente externa
 * agregaria una peticion de red a la generacion de cada documento.
 */

/** Medidas en puntos PDF (1 pt = 1/72 pulgada). A4 = 595 x 842 pt. */
export const MEDIDAS = {
  margenHorizontal: 42,
  margenSuperior: 64,
  margenInferior: 52,
  anchoUtil: 595 - 42 * 2,
} as const;

export const estilos = StyleSheet.create({
  pagina: {
    paddingTop: MEDIDAS.margenSuperior,
    paddingBottom: MEDIDAS.margenInferior,
    paddingHorizontal: MEDIDAS.margenHorizontal,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORES.tinta,
    backgroundColor: COLORES.blanco,
  },

  // ---------------------------------------------------------------
  // Encabezado y pie: van con fixed, se repiten en todas las paginas
  // ---------------------------------------------------------------
  encabezado: {
    position: "absolute",
    top: 26,
    left: MEDIDAS.margenHorizontal,
    right: MEDIDAS.margenHorizontal,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORES.verde,
  },
  // El ancho es alto x 1.919, la proporcion del PNG (307 x 160). Se declara
  // explicito porque react-pdf no deduce la proporcion de la imagen.
  logoEncabezado: {
    height: 20,
    width: 38,
  },
  logoPortada: {
    height: 46,
    width: 88,
    marginBottom: 24,
  },
  /** Respaldo cuando el PNG del logo no se pudo cargar. */
  marca: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    letterSpacing: 1.5,
    color: COLORES.verde,
  },
  encabezadoTexto: {
    fontSize: 7.5,
    color: COLORES.grisTexto,
    letterSpacing: 0.5,
  },

  pie: {
    position: "absolute",
    bottom: 24,
    left: MEDIDAS.margenHorizontal,
    right: MEDIDAS.margenHorizontal,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLORES.borde,
  },
  pieTexto: {
    fontSize: 7,
    color: COLORES.grisTexto,
  },

  // ---------------------------------------------------------------
  // Portada
  // ---------------------------------------------------------------
  portada: {
    flexGrow: 1,
    justifyContent: "center",
  },
  portadaEtiqueta: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 2,
    color: COLORES.verde,
    marginBottom: 10,
  },
  portadaTitulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 30,
    lineHeight: 1.2,
    marginBottom: 12,
  },
  portadaSubtitulo: {
    fontSize: 11,
    color: COLORES.grisTexto,
    lineHeight: 1.5,
    maxWidth: 380,
  },
  portadaDatos: {
    marginTop: 34,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLORES.borde,
    flexDirection: "row",
    gap: 40,
  },
  portadaDatoEtiqueta: {
    fontSize: 7,
    letterSpacing: 1,
    color: COLORES.grisTexto,
    marginBottom: 3,
  },
  portadaDatoValor: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },

  // ---------------------------------------------------------------
  // Indice
  // ---------------------------------------------------------------
  indiceFila: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORES.borde,
  },
  indiceSku: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    width: 70,
  },
  indiceNombre: {
    fontSize: 8.5,
    flexGrow: 1,
  },
  // Renglon de subpieza: sangrado y en gris, para que la jerarquia se lea de
  // un vistazo sin necesidad de numeracion.
  indiceFilaSub: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingLeft: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORES.borde,
  },
  indiceSkuSub: {
    fontSize: 8,
    width: 76,
    color: COLORES.grisTexto,
  },
  indiceNombreSub: {
    fontSize: 8,
    flexGrow: 1,
    color: COLORES.grisTexto,
  },
  indiceCantidad: {
    fontSize: 8.5,
    color: COLORES.grisTexto,
    width: 60,
    textAlign: "right",
  },

  // ---------------------------------------------------------------
  // Ficha de pieza
  // ---------------------------------------------------------------
  tituloPieza: {
    fontFamily: "Helvetica-Bold",
    fontSize: 19,
    marginBottom: 5,
  },
  lineaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  chip: {
    fontSize: 7,
    letterSpacing: 0.6,
    color: COLORES.verdeOscuro,
    backgroundColor: COLORES.verdeClaro,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 3,
  },

  columnas: {
    flexDirection: "row",
    gap: 18,
  },
  columnaImagen: {
    width: 200,
  },
  columnaDatos: {
    flexGrow: 1,
  },

  marcoImagen: {
    borderWidth: 0.5,
    borderColor: COLORES.borde,
    borderRadius: 4,
    backgroundColor: COLORES.hueso,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  imagen: {
    objectFit: "contain",
    maxHeight: 138,
  },
  imagenAusente: {
    fontSize: 8,
    color: COLORES.grisTexto,
  },
  pieImagen: {
    fontSize: 6.5,
    color: COLORES.grisTexto,
    marginTop: 4,
    lineHeight: 1.4,
  },

  subtitulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: COLORES.grisTexto,
    marginBottom: 6,
  },

  filaSpec: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORES.borde,
  },
  specEtiqueta: {
    fontSize: 8.5,
    color: COLORES.grisTexto,
  },
  specValor: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "right",
    maxWidth: 200,
  },
  specPendiente: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 8.5,
    color: COLORES.grisTexto,
    textAlign: "right",
  },

  bloque: {
    marginTop: 16,
  },

  // Requisitos tecnicos: vinetas, no prosa. Un proveedor los lee como una
  // lista de puntos a cumplir y los va tachando.
  vineta: {
    flexDirection: "row",
    marginBottom: 3,
  },
  vinetaPunto: {
    width: 10,
    fontSize: 8.5,
    color: COLORES.verde,
  },
  vinetaTexto: {
    flexGrow: 1,
    fontSize: 8,
    lineHeight: 1.5,
  },

  fuenteTexto: {
    fontSize: 6.5,
    lineHeight: 1.45,
    color: COLORES.grisTexto,
  },
  parrafo: {
    fontSize: 8.5,
    lineHeight: 1.55,
    color: COLORES.tinta,
  },
  aviso: {
    marginTop: 14,
    padding: 8,
    backgroundColor: COLORES.hueso,
    borderLeftWidth: 2,
    borderLeftColor: COLORES.verde,
  },
  avisoTexto: {
    fontSize: 7,
    lineHeight: 1.5,
    color: COLORES.grisTexto,
  },
});

import { StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  cantidadPorDron,
  ETIQUETAS_SECCION,
  ETIQUETAS_SUBSISTEMA,
  ORDEN_SECCIONES,
  type Pieza,
} from "@/lib/esquema";

import { COLORES } from "@/config/marca";

/**
 * Facsimil, en PDF, de la etiqueta fisica que se imprime para la pieza
 * (ver public/brand/etiqueta-editor.html y etiqueta-pieza.svg: mismo diseno,
 * mismos campos, negro sobre blanco porque es lo que se manda a imprimir en
 * una impresora de etiquetas). Va en la ficha de cada pieza para que quien
 * abre el PDF vea exactamente el rotulo que trae — o deberia traer — la
 * pieza fisica, incluido el numero de parte oficial del maestro (BOM) cuando
 * ya esta confirmado.
 *
 * Los campos MODULO y UBICACION usan lo unico que el catalogo ya sabe de
 * eso: el subsistema y las secciones donde se monta. No inventan una
 * ubicacion de almacen: eso lo define quien imprime, ahi mismo en el editor
 * HTML.
 */

const estilos = StyleSheet.create({
  caja: {
    borderWidth: 1,
    borderColor: COLORES.tinta,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8,
  },
  barra: {
    backgroundColor: COLORES.tinta,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barraTexto: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: COLORES.blanco,
  },
  cuerpo: {
    padding: 8,
    gap: 6,
  },
  etiquetaCampo: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    color: COLORES.tinta,
  },
  valorCampo: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: COLORES.tinta,
    marginTop: 1,
  },
  valorSku: {
    fontSize: 13,
    fontFamily: "Courier-Bold",
    color: COLORES.tinta,
    marginTop: 1,
  },
  // Los codigos de BOM (MXD-MX80-...-R00) son mas largos que un SKU interno
  // (hasta 25 caracteres): a 13pt tocarian el borde de la caja (200pt de
  // ancho, columnaImagen en estilos.ts). Mismo estilo, letra mas chica.
  valorBom: {
    fontSize: 9.5,
    fontFamily: "Courier-Bold",
    color: COLORES.tinta,
    marginTop: 1,
  },
  fila: {
    flexDirection: "row",
    gap: 10,
  },
  columna: {
    flexGrow: 1,
    flexBasis: 0,
  },
  linea: {
    borderBottomWidth: 0.75,
    borderBottomColor: COLORES.tinta,
    marginTop: 2,
  },
});

function modulo(pieza: Pieza): string {
  return pieza.categoria ?? ETIQUETAS_SUBSISTEMA[pieza.subsistema];
}

function ubicacion(pieza: Pieza): string {
  if (pieza.secciones.length === 0) return "Pendiente";
  return ORDEN_SECCIONES.filter((s) => pieza.secciones.includes(s))
    .map((s) => ETIQUETAS_SECCION[s])
    .join(", ");
}

export function EtiquetaPieza({ pieza }: { pieza: Pieza }) {
  const total = cantidadPorDron(pieza);

  return (
    <View style={estilos.caja} wrap={false}>
      <View style={estilos.barra}>
        <Text style={estilos.barraTexto}>ETIQUETA DE PIEZA</Text>
        <Text style={estilos.barraTexto}>MXD</Text>
      </View>
      <View style={estilos.cuerpo}>
        <View>
          <Text style={estilos.etiquetaCampo}>NOMBRE DE LA PIEZA</Text>
          <Text style={estilos.valorCampo}>{pieza.nombre}</Text>
          <View style={estilos.linea} />
        </View>

        <View>
          <Text style={estilos.etiquetaCampo}>SKU</Text>
          <Text style={estilos.valorSku}>{pieza.sku}</Text>
          <View style={estilos.linea} />
        </View>

        <View style={estilos.fila}>
          <View style={estilos.columna}>
            <Text style={estilos.etiquetaCampo}>MODELO</Text>
            <Text style={estilos.valorCampo}>{pieza.modelo}</Text>
            <View style={estilos.linea} />
          </View>
          <View style={estilos.columna}>
            <Text style={estilos.etiquetaCampo}>CANTIDAD/DRON</Text>
            <Text style={estilos.valorCampo}>
              {total > 0 ? String(total) : "Pendiente"}
            </Text>
            <View style={estilos.linea} />
          </View>
        </View>

        <View style={estilos.fila}>
          <View style={estilos.columna}>
            <Text style={estilos.etiquetaCampo}>MODULO</Text>
            <Text style={estilos.valorCampo}>{modulo(pieza)}</Text>
            <View style={estilos.linea} />
          </View>
          <View style={estilos.columna}>
            <Text style={estilos.etiquetaCampo}>UBICACION</Text>
            <Text style={estilos.valorCampo}>{ubicacion(pieza)}</Text>
            <View style={estilos.linea} />
          </View>
        </View>

        <View>
          <Text style={estilos.etiquetaCampo}>No. DE PARTE MXD (BOM)</Text>
          <Text style={estilos.valorBom}>{pieza.numeroBom ?? "Pendiente"}</Text>
          <View style={estilos.linea} />
        </View>
      </View>
    </View>
  );
}

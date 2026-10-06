import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import React from "react";

import { MARCA } from "@/config/marca";
import {
  cantidadPorDron,
  ETIQUETAS_SECCION,
  type Pieza,
  type Seccion,
} from "@/lib/esquema";

import { estilos } from "./estilos";
import { FichaPieza } from "./FichaPieza";
import { EncabezadoPagina, PiePagina } from "./PartesComunes";
import type { ImagenPdf } from "./recursos";
import { fechaEmision } from "./revision";

/**
 * Los tres alcances de descarga, en un solo documento parametrizado:
 *
 *   pieza    -> 1 ficha, sin portada
 *   seccion  -> portada + indice + las fichas de esa seccion
 *   completo -> portada + indice + todas las fichas
 *
 * El completo es literalmente el individual N veces mas portada e indice, que
 * es lo que garantiza que los tres se vean como el mismo documento.
 */

export type Alcance =
  | { tipo: "pieza"; pieza: Pieza }
  | { tipo: "seccion"; seccion: Seccion; piezas: Pieza[] }
  | { tipo: "completo"; piezas: Pieza[] };

function Portada({
  titulo,
  subtitulo,
  totalPiezas,
  logo,
}: {
  titulo: string;
  subtitulo: string;
  totalPiezas: number;
  logo?: ImagenPdf | null;
}) {
  return (
    <Page size="A4" style={estilos.pagina}>
      <EncabezadoPagina titulo="Catalogo tecnico" logo={logo} />

      <View style={estilos.portada}>
        {logo ? <Image style={estilos.logoPortada} src={logo} /> : null}
        {/* Con el logo arriba, repetir "MXD" aqui sobra: basta el modelo. */}
        <Text style={estilos.portadaEtiqueta}>
          {logo ? "MX80" : "MXD · MX80"}
        </Text>
        <Text style={estilos.portadaTitulo}>{titulo}</Text>
        <Text style={estilos.portadaSubtitulo}>{subtitulo}</Text>

        <View style={estilos.portadaDatos}>
          <View>
            <Text style={estilos.portadaDatoEtiqueta}>FECHA DE EMISION</Text>
            <Text style={estilos.portadaDatoValor}>{fechaEmision()}</Text>
          </View>
          <View>
            <Text style={estilos.portadaDatoEtiqueta}>COMPONENTES</Text>
            <Text style={estilos.portadaDatoValor}>{totalPiezas}</Text>
          </View>
          <View>
            <Text style={estilos.portadaDatoEtiqueta}>MODELO</Text>
            <Text style={estilos.portadaDatoValor}>MX80</Text>
          </View>
        </View>
      </View>

      <PiePagina izquierda={`Emitido ${fechaEmision()}`} />
    </Page>
  );
}

function Indice({
  piezas,
  seccion,
  logo,
  subpiezas,
}: {
  piezas: Pieza[];
  seccion?: Seccion;
  logo?: ImagenPdf | null;
  subpiezas: Map<string, Pieza[]>;
}) {
  const totalHojas =
    piezas.length + [...subpiezas.values()].reduce((s, v) => s + v.length, 0);
  return (
    <Page size="A4" style={estilos.pagina}>
      <EncabezadoPagina titulo="Contenido" logo={logo} />

      <Text style={estilos.tituloPieza}>Contenido</Text>
      <View style={estilos.lineaChips}>
        <Text style={estilos.chip}>{piezas.length} COMPONENTES</Text>
        <Text style={estilos.chip}>{totalHojas} HOJAS</Text>
      </View>

      {piezas.map((pieza) => (
        <React.Fragment key={pieza.sku}>
          <View style={estilos.indiceFila}>
            <Text style={estilos.indiceSku}>{pieza.sku}</Text>
            <Text style={estilos.indiceNombre}>{pieza.nombre}</Text>
            <Text style={estilos.indiceCantidad}>
              {seccion
                ? `${pieza.cantidadPorSeccion} en seccion`
                : `${cantidadPorDron(pieza)} por dron`}
            </Text>
          </View>
          {(subpiezas.get(pieza.sku) ?? []).map((sub) => (
            <View key={sub.sku} style={estilos.indiceFilaSub}>
              <Text style={estilos.indiceSkuSub}>{sub.sku}</Text>
              <Text style={estilos.indiceNombreSub}>{sub.nombre}</Text>
              <Text style={estilos.indiceCantidad}>
                {seccion
                  ? `${sub.cantidadPorSeccion} en seccion`
                  : `${cantidadPorDron(sub)} por dron`}
              </Text>
            </View>
          ))}
        </React.Fragment>
      ))}

      <PiePagina izquierda={`Emitido ${fechaEmision()}`} />
    </Page>
  );
}

/** El padre directo de una subpieza (puede ser otra subpieza, no la raiz). */
function padreInmediato(
  raiz: Pieza,
  sub: Pieza,
  subpiezas: Map<string, Pieza[]>,
): Pieza {
  if (sub.parteDe === raiz.sku) return raiz;
  return (subpiezas.get(raiz.sku) ?? []).find((p) => p.sku === sub.parteDe) ?? raiz;
}

export function DocumentoFichas({
  alcance,
  imagenes,
  logo,
  subpiezas,
}: {
  alcance: Alcance;
  imagenes: Map<string, ImagenPdf>;
  logo?: ImagenPdf | null;
  subpiezas: Map<string, Pieza[]>;
}) {
  /** Hoja general de la pieza y despues una hoja por subpieza. */
  const hojasDe = (pieza: Pieza, seccion?: Seccion) => [
    <FichaPieza
      key={pieza.sku}
      pieza={pieza}
      imagen={imagenes.get(pieza.sku)}
      seccion={seccion}
      logo={logo}
    />,
    ...(subpiezas.get(pieza.sku) ?? []).map((sub) => (
      <FichaPieza
        key={sub.sku}
        pieza={sub}
        imagen={imagenes.get(sub.sku)}
        seccion={seccion}
        logo={logo}
        padre={padreInmediato(pieza, sub, subpiezas)}
      />
    )),
  ];

  if (alcance.tipo === "pieza") {
    return (
      <Document
        title={`${alcance.pieza.sku} — ${alcance.pieza.nombre}`}
        author={MARCA.nombreLargo}
        subject="Ficha tecnica de componente"
      >
        {hojasDe(alcance.pieza)}
      </Document>
    );
  }

  const esSeccion = alcance.tipo === "seccion";
  const seccion = esSeccion ? alcance.seccion : undefined;
  const titulo = esSeccion
    ? ETIQUETAS_SECCION[alcance.seccion]
    : "Catalogo tecnico completo";
  const subtitulo = esSeccion
    ? `Especificaciones de los componentes de la seccion ${ETIQUETAS_SECCION[alcance.seccion]} del dron agricola MX80.`
    : "Especificaciones de todos los componentes documentados del dron agricola MX80, agrupados por seccion.";

  return (
    <Document
      title={`MX80 — ${titulo}`}
      author={MARCA.nombreLargo}
      subject="Catalogo tecnico de componentes"
    >
      <Portada
        titulo={titulo}
        subtitulo={subtitulo}
        totalPiezas={alcance.piezas.length}
        logo={logo}
      />
      <Indice
        piezas={alcance.piezas}
        seccion={seccion}
        logo={logo}
        subpiezas={subpiezas}
      />
      {alcance.piezas.map((pieza) => hojasDe(pieza, seccion))}
    </Document>
  );
}

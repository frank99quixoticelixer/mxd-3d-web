/**
 * Genera el folleto comercial del MX80: public/folletos/mx80/folleto-mx80.pdf.
 *
 *   cd apps/vitrina && npm run folleto:generar
 *
 * Dos paginas carta, estilo sobrio: cabecera carbon con el render de lineas
 * del MX80, cifras separadas por reglas finas, texto en columnas y tablas con
 * hilos. Portada: cifras, sistema de aspersion y evasion de obstaculos.
 * Reverso: funciones de vuelo inteligente, especificaciones y contacto.
 * Los datos viven en src/data/folleto-mx80.ts, cada uno con su fuente.
 *
 * Paleta, logo, filtro de caracteres y render compartidos: comun.tsx.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { MARCA } from "../../src/config/marca";
import {
  ASPERSION_FOLLETO,
  CIFRAS_FOLLETO,
  ESPECIFICACIONES_FOLLETO,
  EVASION_FOLLETO,
  FOLLETO_MX80,
  FUNCIONES_FOLLETO,
  LEMA_FOLLETO,
  NOTA_FOLLETO,
} from "../../src/data/folleto-mx80";
import { ANCHO, DronLineas, LOGO, M, P, escribirPdf, t } from "./comun";

const ALTO_BANDA = 318;

const e = StyleSheet.create({
  pagina: { fontFamily: "Helvetica", fontSize: 8.6, color: P.tinta, backgroundColor: P.blanco, paddingBottom: 46 },
  cuerpo: { paddingHorizontal: M },

  // ---- Cabecera (portada) ----
  banda: { height: ALTO_BANDA, backgroundColor: P.banda, paddingHorizontal: M, paddingTop: 34 },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoFondo: { backgroundColor: P.blanco, paddingVertical: 5, paddingHorizontal: 8 },
  logo: { height: 20, width: (307 / 160) * 20 },
  rotuloBanda: { fontSize: 6.8, letterSpacing: 2.4, color: P.apagadoBanda, textTransform: "uppercase" },
  acentoBanda: { marginTop: 54, width: 22, height: 1.5, backgroundColor: P.acento },
  antetitulo: { marginTop: 10, fontSize: 7.5, letterSpacing: 2.8, color: P.apagadoBanda, textTransform: "uppercase" },
  titulo: { marginTop: 8, fontFamily: "Helvetica-Bold", fontSize: 96, letterSpacing: -3.5, lineHeight: 0.9, color: P.blanco },
  lema: { marginTop: 14, fontSize: 11.5, color: P.textoBanda, maxWidth: 260 },
  sellos: { marginTop: 18, fontSize: 7, letterSpacing: 2, color: P.apagadoBanda, textTransform: "uppercase" },
  render: { position: "absolute", right: M - 14, top: 120 },

  // ---- Cifras ----
  cifras: { flexDirection: "row", flexWrap: "wrap", marginTop: 26, borderTopWidth: 0.6, borderColor: P.regla },
  cifra: { width: "33.333%", paddingVertical: 12, paddingRight: 10, borderBottomWidth: 0.6, borderColor: P.regla },
  cifraConLinea: { paddingLeft: 14, borderLeftWidth: 0.6 },
  cifraValor: { fontFamily: "Helvetica-Bold", fontSize: 21, letterSpacing: -0.6 },
  cifraEtiqueta: { marginTop: 3, fontSize: 6.5, letterSpacing: 1.6, color: P.gris, textTransform: "uppercase" },

  // ---- Secciones ----
  encabezado: { flexDirection: "row", alignItems: "center", marginTop: 22, marginBottom: 9 },
  seccion: { fontFamily: "Helvetica-Bold", fontSize: 7.8, letterSpacing: 2.2, textTransform: "uppercase" },
  hilo: { flexGrow: 1, height: 0.6, backgroundColor: P.regla, marginLeft: 12 },
  intro: { fontSize: 8.6, lineHeight: 1.5, color: P.gris, marginBottom: 12, maxWidth: 440 },

  columnas: { flexDirection: "row", marginHorizontal: -9 },
  columna: { paddingHorizontal: 9 },
  bloque: { borderTopWidth: 1.2, borderColor: P.tinta, paddingTop: 8 },
  bloqueCifra: { fontFamily: "Helvetica-Bold", fontSize: 12.5, letterSpacing: -0.2 },
  bloqueTitulo: { marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 8.4 },
  bloqueTexto: { marginTop: 3, fontSize: 7.8, lineHeight: 1.45, color: P.gris },

  // ---- Evasion: escala de 0 a 60 m ----
  escala: { marginTop: 4, height: 30, position: "relative" },
  tramo: { position: "absolute", top: 10, height: 2 },
  marca: { position: "absolute", top: 6, width: 0.8, height: 10, backgroundColor: P.tinta },
  marcaTexto: { position: "absolute", top: 19, fontSize: 6.8, color: P.gris },
  etapas: { flexDirection: "row", marginHorizontal: -9 },
  etapaDistancia: { fontFamily: "Helvetica-Bold", fontSize: 8.4 },
  etapaAccion: { marginTop: 2, fontSize: 7.6, lineHeight: 1.4, color: P.gris },

  // ---- Reverso ----
  cabeceraPagina: {
    marginHorizontal: M,
    marginTop: 28,
    paddingBottom: 7,
    borderBottomWidth: 0.6,
    borderColor: P.regla,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cabeceraTitulo: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 2.2, textTransform: "uppercase" },
  cabeceraDetalle: { fontSize: 7, letterSpacing: 2, color: P.gris, textTransform: "uppercase" },

  rejilla: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -9 },
  celda3: { width: "33.333%", paddingHorizontal: 9, marginBottom: 9 },

  specs: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -12 },
  celdaSpec: { width: "50%", paddingHorizontal: 12, marginBottom: 9 },
  grupo: { fontFamily: "Helvetica-Bold", fontSize: 6.8, letterSpacing: 1.8, color: P.acento, textTransform: "uppercase", marginBottom: 3 },
  renglon: { flexDirection: "row", paddingVertical: 2.9, borderBottomWidth: 0.5, borderColor: P.regla },
  parametro: { width: "50%", fontSize: 7.8, color: P.gris },
  valor: { width: "50%", fontSize: 7.9, fontFamily: "Helvetica-Bold", textAlign: "right" },
  nota: { marginTop: 2, fontSize: 6.8, lineHeight: 1.4, color: P.grisClaro },

  contacto: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1.2,
    borderColor: P.tinta,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  contactoTitulo: { fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: -0.3 },
  contactoTexto: { marginTop: 3, fontSize: 8.4, color: P.gris },
  contactoDato: { fontFamily: "Helvetica-Bold", fontSize: 9.5, textAlign: "right", marginBottom: 2 },
  contactoCiudad: { fontSize: 8, color: P.gris, textAlign: "right" },

  pie: {
    position: "absolute",
    left: M,
    right: M,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.8,
    color: P.grisClaro,
  },
});

function Encabezado({ titulo }: { titulo: string }) {
  return (
    <View style={e.encabezado}>
      <Text style={e.seccion}>{t(titulo)}</Text>
      <View style={e.hilo} />
    </View>
  );
}

function Pie() {
  return (
    <View style={e.pie} fixed>
      <Text>{t(`${MARCA.nombreLargo} · ${MARCA.contacto.correo} · ${MARCA.contacto.telefono}`)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/** Escala de 0 a 60 m con las tres etapas de frenado, en grises. */
function EscalaEvasion() {
  const ancho = ANCHO - 2 * M;
  const x = (m: number) => (m / 60) * ancho;
  const tramos = [
    { de: 0, a: 8, color: P.tinta },
    { de: 8, a: 30, color: P.gris },
    { de: 30, a: 60, color: P.regla },
  ];
  return (
    <View style={e.escala}>
      {tramos.map((tr) => (
        <View key={tr.de} style={[e.tramo, { left: x(tr.de), width: x(tr.a) - x(tr.de), backgroundColor: tr.color }]} />
      ))}
      {[0, 8, 30, 60].map((m) => (
        <View key={m}>
          <View style={[e.marca, { left: Math.min(x(m), ancho - 0.8) }]} />
          <Text style={[e.marcaTexto, { left: m === 60 ? ancho - 22 : x(m) + 2 }]}>{`${m} m`}</Text>
        </View>
      ))}
    </View>
  );
}

function Folleto() {
  const etapas = [...EVASION_FOLLETO.etapas].reverse(); // de cerca a lejos
  return (
    <Document
      // Las propiedades del PDF van sin tildes: el diccionario Info del PDF no
      // las codifica bien y salen como simbolos raros en el lector.
      title={`${MARCA.nombreLargo} MX80 - Folleto`}
      author={MARCA.nombreLargo}
      subject="Dron agricola de aspersion MX80"
      creator={MARCA.nombreLargo}
      producer={MARCA.nombreLargo}
      language="es-MX"
    >
      {/* ================= Portada ================= */}
      <Page size="LETTER" style={e.pagina}>
        <View style={e.banda}>
          <View style={e.fila}>
            <View style={e.logoFondo}>
              <Image src={LOGO} style={e.logo} />
            </View>
            <Text style={e.rotuloBanda}>Folleto comercial</Text>
          </View>
          <View style={e.acentoBanda} />
          <Text style={e.antetitulo}>{t("Dron agrícola de aspersión")}</Text>
          <Text style={e.titulo}>MX80</Text>
          <Text style={e.lema}>{t(LEMA_FOLLETO)}</Text>
          <Text style={e.sellos}>{t("IP67   ·   RTK   ·   LiDAR   ·   Plegable")}</Text>
          <DronLineas ancho={300} estilo={e.render} />
        </View>

        <View style={e.cuerpo}>
          <View style={e.cifras}>
            {CIFRAS_FOLLETO.map((c, i) => (
              <View key={c.etiqueta} style={i % 3 === 0 ? e.cifra : [e.cifra, e.cifraConLinea]}>
                <Text style={e.cifraValor}>{t(c.valor)}</Text>
                <Text style={e.cifraEtiqueta}>{t(c.etiqueta)}</Text>
              </View>
            ))}
          </View>

          <Encabezado titulo="Sistema de aspersión" />
          <View style={e.columnas}>
            {ASPERSION_FOLLETO.map((a) => (
              <View key={a.titulo} style={[e.columna, { width: "25%" }]}>
                <View style={e.bloque}>
                  <Text style={e.bloqueCifra}>{t(a.cifra)}</Text>
                  <Text style={e.bloqueTitulo}>{t(a.titulo)}</Text>
                  <Text style={e.bloqueTexto}>{t(a.texto)}</Text>
                </View>
              </View>
            ))}
          </View>

          <Encabezado titulo="Evasión de obstáculos" />
          <Text style={e.intro}>{t(EVASION_FOLLETO.texto)}</Text>
          <EscalaEvasion />
          <View style={e.etapas}>
            {etapas.map((etapa) => (
              <View key={etapa.distancia} style={[e.columna, { width: "33.333%" }]}>
                <Text style={e.etapaDistancia}>{t(etapa.distancia)}</Text>
                <Text style={e.etapaAccion}>{t(etapa.accion)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Pie />
      </Page>

      {/* ================= Reverso ================= */}
      <Page size="LETTER" style={e.pagina}>
        <View style={e.cabeceraPagina}>
          <Text style={e.cabeceraTitulo}>MX80</Text>
          <Text style={e.cabeceraDetalle}>{MARCA.nombreLargo}</Text>
        </View>

        <View style={e.cuerpo}>
          <Encabezado titulo="Funciones de vuelo inteligente" />
          <View style={e.rejilla}>
            {FUNCIONES_FOLLETO.map((f) => (
              <View key={f.titulo} style={e.celda3}>
                <View style={e.bloque}>
                  <Text style={e.bloqueTitulo}>{t(f.titulo)}</Text>
                  <Text style={e.bloqueTexto}>{t(f.texto)}</Text>
                </View>
              </View>
            ))}
          </View>

          <Encabezado titulo="Especificaciones" />
          <View style={e.specs}>
            {ESPECIFICACIONES_FOLLETO.map((g) => (
              <View key={g.grupo} style={e.celdaSpec} wrap={false}>
                <Text style={e.grupo}>{t(g.grupo)}</Text>
                {g.datos.map((d) => (
                  <View key={d.etiqueta} style={e.renglon}>
                    <Text style={e.parametro}>{t(d.etiqueta)}</Text>
                    <Text style={e.valor}>{t(d.valor)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Text style={e.nota}>{t(NOTA_FOLLETO)}</Text>

          <View style={e.contacto} wrap={false}>
            <View>
              <Text style={e.contactoTitulo}>{t("Cotiza tu MX80")}</Text>
              <Text style={e.contactoTexto}>{t("Cuéntanos tu operación y te armamos el equipo que necesitas.")}</Text>
            </View>
            <View>
              <Text style={e.contactoDato}>{MARCA.contacto.correo}</Text>
              <Text style={e.contactoDato}>{MARCA.contacto.telefono}</Text>
              <Text style={e.contactoCiudad}>{t(MARCA.contacto.ciudad)}</Text>
            </View>
          </View>
        </View>
        <Pie />
      </Page>
    </Document>
  );
}

async function main() {
  await escribirPdf(<Folleto />, FOLLETO_MX80.archivo, "FOLLETO_MX80.tamano en src/data/folleto-mx80.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

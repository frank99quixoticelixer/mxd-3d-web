/**
 * Genera la ficha tecnica del MX80: public/folletos/mx80/ficha-tecnica-mx80.pdf.
 *
 *   cd apps/vitrina && npm run ficha:generar
 *
 * Carta, estilo sobrio (el mismo del folleto): cabecera carbon con el render
 * de lineas del MX80 y las cifras clave entre reglas finas; despues, las
 * especificaciones por sistema en tablas con hilos, numeradas, que fluyen entre
 * paginas (una seccion nunca se parte). Los datos viven en
 * src/data/ficha-tecnica-mx80.ts, cada uno con su fuente. Paleta, logo y
 * render compartidos: comun.tsx.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { MARCA } from "../../src/config/marca";
import {
  CIFRAS_FICHA,
  FICHA_TECNICA_MX80,
  NOTAS_FICHA,
  SECCIONES_FICHA,
  type FilaFicha,
} from "../../src/data/ficha-tecnica-mx80";
import { DronLineas, LOGO, M, P, escribirPdf, t } from "./comun";

const ALTO_BANDA = 236;
const ARRIBA = 64; // margen superior (deja sitio a la cabecera fija de las paginas 2+)

const e = StyleSheet.create({
  pagina: {
    paddingTop: ARRIBA,
    paddingBottom: 50,
    paddingHorizontal: M,
    fontFamily: "Helvetica",
    fontSize: 8.4,
    color: P.tinta,
    backgroundColor: P.blanco,
  },

  // ---- Cabecera de la primera pagina ----
  banda: { position: "absolute", top: 0, left: 0, right: 0, height: ALTO_BANDA, backgroundColor: P.banda, paddingHorizontal: M, paddingTop: 34 },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoFondo: { backgroundColor: P.blanco, paddingVertical: 5, paddingHorizontal: 8 },
  logo: { height: 18, width: (307 / 160) * 18 },
  rotuloBanda: { fontSize: 6.8, letterSpacing: 2.4, color: P.apagadoBanda, textTransform: "uppercase" },
  acentoBanda: { marginTop: 40, width: 22, height: 1.5, backgroundColor: P.acento },
  antetitulo: { marginTop: 10, fontSize: 7.5, letterSpacing: 2.8, color: P.apagadoBanda, textTransform: "uppercase" },
  titulo: { marginTop: 6, fontFamily: "Helvetica-Bold", fontSize: 68, letterSpacing: -2.5, lineHeight: 0.9, color: P.blanco },
  subtitulo: { marginTop: 10, fontSize: 10.5, color: P.textoBanda },
  render: { position: "absolute", right: M - 12, top: 84 },
  espacioBanda: { height: ALTO_BANDA - ARRIBA },

  cifras: { flexDirection: "row", marginTop: 20, marginBottom: 6, borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: P.regla },
  cifra: { width: "20%", paddingVertical: 11, paddingRight: 8 },
  cifraConLinea: { paddingLeft: 12, borderLeftWidth: 0.6, borderColor: P.regla },
  cifraValor: { fontFamily: "Helvetica-Bold", fontSize: 15.5, letterSpacing: -0.4 },
  cifraEtiqueta: { marginTop: 3, fontSize: 6.1, letterSpacing: 0.9, color: P.gris, textTransform: "uppercase" },

  // ---- Cabecera fija de las paginas 2 en adelante ----
  cabeceraFija: { position: "absolute", top: 30, left: M, right: M },
  cabecera: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 7, borderBottomWidth: 0.6, borderColor: P.regla },
  cabeceraTitulo: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 2.2, textTransform: "uppercase" },
  cabeceraDetalle: { fontSize: 7, letterSpacing: 2, color: P.gris, textTransform: "uppercase" },

  // ---- Secciones ----
  seccion: { marginTop: 16 },
  encabezado: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  numero: { width: 22, fontSize: 7.5, color: P.grisClaro, letterSpacing: 1 },
  tituloSeccion: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 2.2, textTransform: "uppercase" },
  marca: { marginLeft: 10, fontSize: 6.6, letterSpacing: 1.8, color: P.grisClaro, textTransform: "uppercase" },
  hilo: { flexGrow: 1, height: 0.6, backgroundColor: P.regla, marginLeft: 12 },
  tabla: { marginLeft: 22, borderTopWidth: 1.1, borderColor: P.tinta },
  renglon: { flexDirection: "row", paddingVertical: 3.9, borderBottomWidth: 0.5, borderColor: P.regla },
  parametro: { width: "42%", color: P.gris, paddingRight: 10 },
  valor: { width: "58%", fontFamily: "Helvetica-Bold" },
  subtituloTabla: {
    paddingTop: 8,
    paddingBottom: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.6,
    letterSpacing: 1.8,
    color: P.acento,
    textTransform: "uppercase",
    borderBottomWidth: 0.5,
    borderColor: P.regla,
  },

  notas: { marginTop: 18, marginLeft: 22 },
  nota: { fontSize: 6.8, lineHeight: 1.5, color: P.grisClaro },

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

function Tabla({ filas }: { filas: FilaFicha[] }) {
  return (
    <View style={e.tabla}>
      {filas.map((f, i) =>
        "sub" in f ? (
          <Text key={i} style={e.subtituloTabla}>
            {t(f.sub)}
          </Text>
        ) : (
          <View key={i} style={e.renglon}>
            <Text style={e.parametro}>{t(f.p)}</Text>
            <Text style={e.valor}>{t(f.v)}</Text>
          </View>
        ),
      )}
    </View>
  );
}

function FichaTecnica() {
  return (
    <Document
      // Las propiedades del PDF van sin tildes: el diccionario Info del PDF no
      // las codifica bien y salen como simbolos raros en el lector.
      title={`${MARCA.nombreLargo} MX80 - Ficha tecnica`}
      author={MARCA.nombreLargo}
      subject="Especificaciones tecnicas del dron agricola MX80"
      creator={MARCA.nombreLargo}
      producer={MARCA.nombreLargo}
      language="es-MX"
    >
      <Page size="LETTER" style={e.pagina}>
        {/* Cabecera de la primera pagina: posicion absoluta y no fija, asi que
            solo se dibuja en la pagina donde aparece (la 1). */}
        <View style={e.banda}>
          <View style={e.fila}>
            <View style={e.logoFondo}>
              <Image src={LOGO} style={e.logo} />
            </View>
            <Text style={e.rotuloBanda}>{t("Ficha técnica")}</Text>
          </View>
          <View style={e.acentoBanda} />
          <Text style={e.antetitulo}>{t("Dron agrícola de aspersión")}</Text>
          <Text style={e.titulo}>MX80</Text>
          <Text style={e.subtitulo}>{t("Especificaciones técnicas por sistema")}</Text>
          <DronLineas ancho={290} estilo={e.render} />
        </View>

        {/* Cabecera de las paginas 2 en adelante */}
        <View style={e.cabeceraFija} fixed render={({ pageNumber }) => (pageNumber > 1 ? (
          <View style={e.cabecera}>
            <Text style={e.cabeceraTitulo}>{t("MX80 · Ficha técnica")}</Text>
            <Text style={e.cabeceraDetalle}>{MARCA.nombreLargo}</Text>
          </View>
        ) : null)} />

        <View style={e.espacioBanda} />

        <View style={e.cifras}>
          {CIFRAS_FICHA.map((c, i) => (
            <View key={c.etiqueta} style={i === 0 ? e.cifra : [e.cifra, e.cifraConLinea]}>
              <Text style={e.cifraValor}>{t(c.valor)}</Text>
              <Text style={e.cifraEtiqueta}>{t(c.etiqueta)}</Text>
            </View>
          ))}
        </View>

        {SECCIONES_FICHA.map((s, i) => (
          <View key={s.titulo} style={e.seccion} wrap={false}>
            <View style={e.encabezado}>
              <Text style={e.numero}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={e.tituloSeccion}>{t(s.titulo)}</Text>
              {s.marca && <Text style={e.marca}>{t(s.marca)}</Text>}
              <View style={e.hilo} />
            </View>
            <Tabla filas={s.filas} />
          </View>
        ))}

        <View style={e.notas} wrap={false}>
          {NOTAS_FICHA.map((n) => (
            <Text key={n} style={e.nota}>
              {t(n)}
            </Text>
          ))}
        </View>

        <View style={e.pie} fixed>
          <Text>{t(`${MARCA.nombreLargo} · ${MARCA.contacto.correo} · ${MARCA.contacto.telefono}`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

async function main() {
  await escribirPdf(<FichaTecnica />, FICHA_TECNICA_MX80.archivo, "FICHA_TECNICA_MX80.tamano en src/data/ficha-tecnica-mx80.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

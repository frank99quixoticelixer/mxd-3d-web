import { Image, Page, Text, View } from "@react-pdf/renderer";

import {
  cantidadPorDron,
  ETIQUETAS_SECCION,
  ETIQUETAS_SUBSISTEMA,
  ORDEN_SECCIONES,
  type Pieza,
  type Seccion,
} from "@/lib/esquema";
import { valorOPendiente } from "@/lib/texto";

import { estilos } from "./estilos";
import { EtiquetaPieza } from "./EtiquetaPieza";
import { EncabezadoPagina, PiePagina } from "./PartesComunes";
import type { ImagenPdf } from "./recursos";
import { selloRevision } from "./revision";

/**
 * Ficha de una pieza.
 *
 * Es la unica plantilla de pieza que existe. La descarga individual, el paquete
 * de una seccion y el catalogo completo montan ESTE componente; por eso no
 * pueden verse distintos ni quedar desincronizados.
 *
 * La pagina ya no se fuerza a una sola hoja: con los requisitos tecnicos
 * completos hay piezas que ocupan dos. react-pdf corta donde toca y el
 * encabezado y el pie se repiten solos.
 */

function FilaSpec({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const pendiente = valor === "Pendiente";
  return (
    <View style={estilos.filaSpec}>
      <Text style={estilos.specEtiqueta}>{etiqueta}</Text>
      <Text style={pendiente ? estilos.specPendiente : estilos.specValor}>
        {valor}
      </Text>
    </View>
  );
}

/** Seccion con titulo que no se parte a la mitad entre dos paginas. */
function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <View style={estilos.bloque} wrap={false}>
      <Text style={estilos.subtitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function Vinetas({ puntos }: { puntos: string[] }) {
  return (
    <>
      {puntos.map((punto, i) => (
        <View key={i} style={estilos.vineta}>
          <Text style={estilos.vinetaPunto}>-</Text>
          <Text style={estilos.vinetaTexto}>{punto}</Text>
        </View>
      ))}
    </>
  );
}

function dimensiones(pieza: Pieza): string {
  const { largo_mm, ancho_mm, alto_mm } = pieza.especificaciones;
  if (largo_mm && ancho_mm && alto_mm) {
    return `${largo_mm} x ${ancho_mm} x ${alto_mm} mm`;
  }
  return "Pendiente";
}

function seccionesTexto(pieza: Pieza): string {
  if (pieza.secciones.length === 0) return "Pendiente";
  return ORDEN_SECCIONES.filter((s) => pieza.secciones.includes(s))
    .map((s) => ETIQUETAS_SECCION[s])
    .join(", ");
}

export function FichaPieza({
  pieza,
  imagen,
  seccion,
  logo,
  padre,
}: {
  pieza: Pieza;
  imagen?: ImagenPdf;
  /** Seccion desde la que se genera, cuando el documento es de una sola seccion. */
  seccion?: Seccion;
  logo?: ImagenPdf | null;
  /** Pieza de catalogo a la que pertenece, cuando esta hoja es de una subpieza. */
  padre?: Pieza;
}) {
  const e = pieza.especificaciones;
  const total = cantidadPorDron(pieza);

  return (
    <Page size="A4" style={estilos.pagina}>
      <EncabezadoPagina
        titulo={padre ? "Ficha tecnica de subpieza" : "Ficha tecnica de componente"}
        logo={logo}
      />

      <Text style={estilos.tituloPieza}>{pieza.nombre}</Text>
      <View style={estilos.lineaChips}>
        <Text style={estilos.chip}>{pieza.sku}</Text>
        <Text style={estilos.chip}>{pieza.modelo}</Text>
        <Text style={estilos.chip}>
          {(pieza.categoria ?? ETIQUETAS_SUBSISTEMA[pieza.subsistema]).toUpperCase()}
        </Text>
        {padre ? (
          <Text style={estilos.chip}>
            PARTE DE {padre.sku}
          </Text>
        ) : null}
      </View>

      <View style={estilos.columnas}>
        <View style={estilos.columnaImagen}>
          <View style={estilos.marcoImagen}>
            {imagen ? (
              <Image style={estilos.imagen} src={imagen} />
            ) : (
              <Text style={estilos.imagenAusente}>Render pendiente</Text>
            )}
          </View>
          <Text style={estilos.pieImagen}>
            Render del modelo 3D, vista de referencia. No es un plano acotado y
            no sustituye a las cotas de la tabla.
          </Text>

          <EtiquetaPieza pieza={pieza} />
        </View>

        <View style={estilos.columnaDatos}>
          <Text style={estilos.subtitulo}>DIMENSIONES Y MASA</Text>
          <FilaSpec etiqueta="Masa" valor={valorOPendiente(e.masa_g, "g")} />
          <FilaSpec etiqueta="Dimensiones (L x A x H)" valor={dimensiones(pieza)} />
          <FilaSpec
            etiqueta="Tolerancia general"
            valor={valorOPendiente(e.tolerancia_mm, "mm")}
          />
          <FilaSpec
            etiqueta="Par de apriete"
            valor={valorOPendiente(e.par_apriete_nm, "N·m")}
          />

          <View style={estilos.bloque}>
            <Text style={estilos.subtitulo}>MONTAJE</Text>
            <FilaSpec etiqueta="Se monta en" valor={seccionesTexto(pieza)} />
            {seccion ? (
              <FilaSpec
                etiqueta={`Cantidad en ${ETIQUETAS_SECCION[seccion]}`}
                valor={String(pieza.cantidadPorSeccion)}
              />
            ) : null}
            <FilaSpec
              etiqueta="Cantidad por dron"
              valor={total > 0 ? String(total) : "Pendiente"}
            />
          </View>
        </View>
      </View>

      <Bloque titulo="FUNCION">
        <Text style={estilos.parrafo}>
          {pieza.descripcion_funcional ?? pieza.descripcion}
        </Text>
      </Bloque>

      <Bloque titulo="MATERIAL Y ACABADO">
        <FilaSpec etiqueta="Material" valor={valorOPendiente(e.material)} />
        <FilaSpec etiqueta="Acabado" valor={valorOPendiente(e.acabado)} />
        <FilaSpec
          etiqueta="Proceso de fabricacion"
          valor={valorOPendiente(pieza.proceso_fabricacion)}
        />
        <FilaSpec etiqueta="Proveedor" valor={valorOPendiente(e.proveedor)} />
        <FilaSpec
          etiqueta="Numero de parte del proveedor"
          valor={valorOPendiente(e.parte_proveedor)}
        />
      </Bloque>

      {pieza.especificaciones_tecnicas.length > 0 ? (
        <View style={estilos.bloque}>
          <Text style={estilos.subtitulo}>REQUISITOS TECNICOS</Text>
          <Vinetas puntos={pieza.especificaciones_tecnicas} />
        </View>
      ) : null}

      {e.notas ? (
        <Bloque titulo="PENDIENTES Y VERIFICACIONES">
          <Text style={estilos.parrafo}>{e.notas}</Text>
        </Bloque>
      ) : null}

      {e.fuente.length > 0 ? (
        <Bloque titulo="ORIGEN DE LOS DATOS">
          <Text style={estilos.fuenteTexto}>{e.fuente.join("  ·  ")}</Text>
        </Bloque>
      ) : null}

      <View style={estilos.aviso}>
        <Text style={estilos.avisoTexto}>
          Los campos marcados como Pendiente no han sido medidos ni verificados.
          No se publican valores estimados: una ficha incompleta es preferible a
          una con datos inventados. Los valores marcados como propuestos son una
          recomendacion tecnica, no una especificacion aprobada. Antes de
          fabricar, confirme que el codigo de revision del pie de pagina
          corresponde a la version vigente.
        </Text>
      </View>

      <PiePagina izquierda={selloRevision(pieza)} />
    </Page>
  );
}

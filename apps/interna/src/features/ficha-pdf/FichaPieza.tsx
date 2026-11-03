import { Image, Page, Text, View } from "@react-pdf/renderer";

import {
  CAMPOS_COMPRAS,
  CAMPOS_COSTOS,
  CAMPOS_ESPECIFICACIONES,
  campoPorClave,
  monedaTexto,
  textoValor,
  type CampoFicha,
} from "@/lib/campos-ficha";
import { costoMaterial, costoProduccionTotal } from "@/lib/costos";
import {
  cantidadPorDron,
  ETIQUETAS_SECCION,
  ETIQUETAS_SUBSISTEMA,
  ORDEN_SECCIONES,
  type Pieza,
  type Seccion,
} from "@/lib/esquema";

import { estilos } from "./estilos";
import { EtiquetaPieza } from "./EtiquetaPieza";
import { EncabezadoPagina, PiePagina } from "./PartesComunes";
import type { ImagenPdf } from "./recursos";
import { selloRevision } from "./revision";

/** Claves de @/lib/campos-ficha que entran en cada bloque de la ficha. */
const CLAVES_DIMENSIONES = [
  "masa_g",
  "largo_mm",
  "ancho_mm",
  "alto_mm",
  "tolerancia_mm",
  "rosca",
  "longitud_mm",
  "volumen_ml",
  "diametro_tubo_mm",
  "grosor_pared_mm",
  "diametro_barreno_mm",
  "ancho_perfil_mm",
  "alto_perfil_mm",
];
const CLAVES_MONTAJE = ["numero_tornillos", "par_apriete_nm", "sentido_giro", "modulo_conectado"];
const CLAVES_MOTOR = [
  "motor_kv",
  "motor_voltaje_nominal_v",
  "motor_rpm_nominal",
  "motor_torque_nominal_nm",
  "motor_torque_max_nm",
];
const CLAVES_COMPRAS = ["numero_parte_mxd", "proveedor", "parte_proveedor", "precio_mxn", "stock"];

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

/** Una fila de @/lib/campos-ficha, o nada si ese campo no aplica a esta pieza. */
function FilaCampo({ pieza, campo }: { pieza: Pieza; campo: CampoFicha }) {
  if (pieza.camposNoAplican.includes(campo.clave)) return null;
  return <FilaSpec etiqueta={campo.etiqueta} valor={textoValor(pieza, campo)} />;
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

          <EtiquetaPieza pieza={pieza} logo={logo} />
        </View>

        <View style={estilos.columnaDatos}>
          <Text style={estilos.subtitulo}>DIMENSIONES Y MASA</Text>
          {CLAVES_DIMENSIONES.map((clave) => (
            <FilaCampo key={clave} pieza={pieza} campo={campoPorClave(CAMPOS_ESPECIFICACIONES, clave)} />
          ))}

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
            {CLAVES_MONTAJE.map((clave) => (
              <FilaCampo key={clave} pieza={pieza} campo={campoPorClave(CAMPOS_ESPECIFICACIONES, clave)} />
            ))}
          </View>
        </View>
      </View>

      <Bloque titulo="FUNCION">
        <Text style={estilos.parrafo}>
          {pieza.descripcion_funcional ?? pieza.descripcion}
        </Text>
      </Bloque>

      <Bloque titulo="MATERIAL Y ACABADO">
        <FilaCampo pieza={pieza} campo={campoPorClave(CAMPOS_ESPECIFICACIONES, "material")} />
        <FilaCampo pieza={pieza} campo={campoPorClave(CAMPOS_ESPECIFICACIONES, "acabado")} />
        <FilaCampo
          pieza={pieza}
          campo={campoPorClave(CAMPOS_ESPECIFICACIONES, "proceso_fabricacion")}
        />
      </Bloque>

      {CLAVES_MOTOR.some((c) => !pieza.camposNoAplican.includes(c)) ? (
        <Bloque titulo="MOTOR">
          {CLAVES_MOTOR.map((clave) => (
            <FilaCampo key={clave} pieza={pieza} campo={campoPorClave(CAMPOS_ESPECIFICACIONES, clave)} />
          ))}
        </Bloque>
      ) : null}

      <Bloque titulo="COMPRAS E INVENTARIO">
        {CLAVES_COMPRAS.map((clave) => (
          <FilaCampo key={clave} pieza={pieza} campo={campoPorClave(CAMPOS_COMPRAS, clave)} />
        ))}
      </Bloque>

      {CAMPOS_COSTOS.some((c) => !pieza.camposNoAplican.includes(c.clave)) ? (
        <Bloque titulo="COSTOS DE PRODUCCION (INTERNO)">
          {CAMPOS_COSTOS.map((campo) => (
            <FilaCampo key={campo.clave} pieza={pieza} campo={campo} />
          ))}
          {!pieza.camposNoAplican.includes("costo_material") ? (
            <>
              <FilaSpec etiqueta="Costo de material (calculado)" valor={monedaTexto(costoMaterial(pieza))} />
              <FilaSpec
                etiqueta="Costo total de produccion"
                valor={monedaTexto(costoProduccionTotal(pieza))}
              />
            </>
          ) : null}
        </Bloque>
      ) : null}

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

import { Image, Text, View } from "@react-pdf/renderer";

import { MARCA } from "@/config/marca";

import type { ImagenPdf } from "./recursos";

import { estilos } from "./estilos";

/**
 * Encabezado y pie compartidos por todas las paginas de todos los documentos.
 *
 * Los dos van con `fixed`, asi que react-pdf los repite en cada pagina sin que
 * el contenido tenga que saber cuantas paginas hay.
 *
 * El logo entra como PNG (public/brand/logo-mxd.png, generado desde el SVG
 * oficial con scripts/logo_a_png.mjs) porque el componente Image de react-pdf
 * no carga archivos SVG. Si el PNG no esta disponible se imprime el texto
 * "MXD" en su lugar: un documento sin logo sirve, uno que no se genera no.
 */

export function EncabezadoPagina({
  titulo,
  logo,
}: {
  titulo: string;
  logo?: ImagenPdf | null;
}) {
  return (
    <View style={estilos.encabezado} fixed>
      {logo ? (
        <Image style={estilos.logoEncabezado} src={logo} />
      ) : (
        <Text style={estilos.marca}>{MARCA.nombre}</Text>
      )}
      <Text style={estilos.encabezadoTexto}>{titulo.toUpperCase()}</Text>
    </View>
  );
}

export function PiePagina({ izquierda }: { izquierda: string }) {
  return (
    <View style={estilos.pie} fixed>
      <Text style={estilos.pieTexto}>{izquierda}</Text>
      <Text style={estilos.pieTexto}>
        Documento confidencial · {MARCA.nombreLargo}
      </Text>
      <Text
        style={estilos.pieTexto}
        render={({ pageNumber, totalPages }) =>
          `Pagina ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

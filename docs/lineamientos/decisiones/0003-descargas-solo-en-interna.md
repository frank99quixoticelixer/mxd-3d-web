# 0003. Las descargas de modelos 3D son solo de interna

- Fecha: 2026-10-13
- Estado: Aceptada
- Decide: Axel

## Contexto

La ficha de cada pieza en la vitrina ofrecia descargar su GLB y su STL. Los
archivos estaban en `apps/vitrina/public/downloads/` (56 archivos, 65 MB).
CLAUDE.md ya ponia las descargas en el nivel de datos de pedidos y no en el
publico, y el documento de requerimientos de vitrina lo dejaba como pregunta
abierta (P-01).

Un STL es geometria que se puede fabricar. Publicarlo es regalar el diseno.

## Decision

La vitrina no ofrece descargas. Los archivos se movieron a
`apps/interna/descargas/` y el script de espejo de interna los publica en su
`public/downloads/`, detras de la contrasena.

No basta con quitar el boton: todo lo que esta en `public/` de la vitrina se
puede pedir por URL.

## Consecuencias

- Se quitaron `DescargasMalla`, `lib/descargas.ts` y el indice
  `data/descargas-mx80.json` de la vitrina.
- Interna sigue ofreciendo las descargas.
- Actualizacion 2026-10-20: tampoco pueden ir en `public/` de interna. En
  Hostinger esos archivos no pasan por `proxy.ts` y se descargaban sin
  contrasena. Ahora las entrega la ruta `/api/descargas/[sku]/[archivo]`
  desde `apps/interna/descargas/`, y el zip de interna incluye esa carpeta.
- Cuando exista pedidos, decidir si ofrece descargas y de que formato.

## Alternativas descartadas

- Dejar los archivos y quitar solo el boton: siguen publicos por URL.
- Una ruta de API con contrasena en la vitrina: la vitrina no tiene
  autenticacion, y agregarla para esto la convierte en otra interna.

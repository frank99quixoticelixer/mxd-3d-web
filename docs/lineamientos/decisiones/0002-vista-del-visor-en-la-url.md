# 0002. La vista del visor vive en la URL

- Fecha: 2026-10-12
- Estado: Aceptada
- Decide: Axel

## Contexto

La capa, la zona y la pieza del visor vivian solo en memoria. Al ir a una
ficha del catalogo y volver, el visor empezaba de cero. Tampoco habia forma
de mandarle a un cliente un enlace al motor del brazo, y pedidos va a
necesitar exactamente eso: senalar una pieza.

## Decision

La vista se refleja en la URL de la portada:

- `?zona=brazo-cw` para una zona,
- `?zona=brazo-cw&pieza=motor` para una pieza aislada,
- `?sku=MX80-007` como entrada desde una ficha; se reescribe a la forma de
  zona y pieza.

El estado de Zustand manda y la URL lo sigue. Cada cambio de vista agrega una
entrada al historial, asi que el boton Atras del navegador y el del visor
hacen lo mismo.

## Consecuencias

- Volver de una ficha deja el visor donde estaba.
- Una vista se puede compartir.
- Los mandos (despliegue, encendido, despiece) no van en la URL: son
  exploracion momentanea, no un lugar.
- `pieza` es una clave del visor ("motor" o un nombre de nodo del GLB). Si el
  GLB cambia de nombres, los enlaces viejos con `pieza=` pueden dejar de
  resolver; los de `sku=` siguen funcionando mientras `componentes.ts` este al
  dia.

## Alternativas descartadas

- `useSearchParams` de Next: obliga a envolver la portada en `Suspense` y la
  saca del renderizado estatico.
- Guardar la vista en `sessionStorage`: no se comparte y no funciona con el
  boton Atras.

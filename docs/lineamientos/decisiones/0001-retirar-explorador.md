# 0001. Retirar el explorador 3D de la vitrina

- Fecha: 2026-10-12
- Estado: Aceptada
- Decide: Axel

## Contexto

La vitrina tenia dos visores del mismo dron: el de la portada (`VisorFrame`,
navegacion por capas: dron, zona, pieza) y la pagina `/explorador`
(`VisorMXD`, lista de piezas y ficha flotante). Hacian casi lo mismo con dos
codigos distintos (unos 2,000 lineas solo del explorador), y cada arreglo
habia que hacerlo dos veces.

El explorador ademas fue el origen de la filtracion de datos: recibia el
catalogo completo como prop y lo publicaba en el HTML.

## Decision

Se retira `/explorador` y todo su codigo. El visor de la portada es el unico
visor del dron. Para ver una pieza en detalle, el visor lleva a su ficha del
catalogo con "Ver ficha". `/explorador` redirige a `/` (temporal, 307).

## Consecuencias

- Un solo visor que mantener.
- Se pierde la lista lateral del explorador. Se reemplaza por la lista de
  zonas y piezas junto al visor de la portada, que tambien sirve con teclado.
- Las rutas `/api/modelo` y `/api/descarga`, que solo eran respaldo, se
  borraron con el explorador.

## Alternativas descartadas

- Mantener los dos: duplica el trabajo y la superficie de datos.
- Quedarse con el explorador y quitar el visor de la portada: el de la
  portada ya tenia el despliegue de brazos, el encendido y la navegacion por
  capas, que el explorador no.

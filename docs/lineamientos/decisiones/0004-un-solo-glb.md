# 0004. Un solo GLB para todo lo que se muestra

- Fecha: 2026-10-19
- Estado: Aceptada
- Decide: Axel

## Contexto

La ficha de cada pieza cargaba su propio GLB (`piezas/{SKU}_v1.glb`). Eran 59
archivos, 26 MB, extraidos a mano del mismo GLB del dron completo que ya usa
la portada. Cada vez que el dron se reexportaba, esas copias quedaban viejas, y
cada pieza nueva (el tren, la carcasa frontal) exigia extraer y subir otro
archivo.

## Decision

El sitio muestra un solo modelo: el GLB completo del dron. La ficha de una pieza
carga ese mismo archivo y muestra solo sus nodos. La seleccion se arma en el
servidor con los datos del catalogo (`seleccionDePieza`) y se resuelve en el
navegador contra el GLB (`nodosDeSeleccion`), en este orden: componente del
brazo, nombres de la propia pieza, la zona entera y los nombres de sus
subpiezas.

La excepcion es `piezas/MX80-003_v2.glb`, el interior de la tuerca del
balanceador: el GLB completo solo trae un placeholder de la tuerca.

## Consecuencias

- Se borraron 59 GLB de pieza y `MX80_brazo_CW_web.glb` (29 MB en git).
- Una pieza nueva solo necesita sus `nombresBlender` en `data/mx80.ts`.
- Reexportar el dron actualiza a la vez la portada y todas las fichas.
- La primera ficha que se abre descarga el GLB completo (8 MB) en vez de un
  archivo chico. Si se llega desde la portada ya esta en cache.
- Interna sigue ofreciendo GLB y STL por pieza como descarga
  (`apps/interna/descargas/`); eso es otra cosa y no cambia (ADR 0003).

## Alternativas descartadas

- Mantener los GLB por pieza: duplicaban el modelo y se desactualizaban.
- Generarlos en el build a partir del GLB completo: menos descarga en la
  ficha, pero mas pasos en el deploy y mas espacio en el servidor.

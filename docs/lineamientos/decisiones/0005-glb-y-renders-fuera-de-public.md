# 0005. Los GLB y renders se entregan por una ruta de la app, no desde public/

- Fecha: 2026-11-09
- Estado: Aceptada
- Decide: Francisco

## Contexto

Alguien del equipo bajo el modelo 3D de la vitrina como ejercicio para buscar
vulnerabilidades. No hizo falta ninguna tecnica: `proxy.ts` ya pedia contrasena
en todo el sitio, pero el GLB (`/models/mx80/MX80_completo_v4_web.glb`) y los
renders respondian 200 sin credenciales.

La causa es la que ya documento el ADR 0003 para las descargas de interna: en
Hostinger los archivos de `public/` los entrega su servidor estatico sin pasar
por la app, asi que `proxy.ts` no los ve. El comentario del proxy decia que
cubria los GLB de `/public`, y en produccion no era cierto. Interna tenia el
mismo agujero: su script de espejo copiaba `vitrina/public/` completo a su
propio `public/`.

## Decision

Los GLB y los renders viven en `apps/vitrina/protegido/` y los entregan dos
rutas de la app, `/api/modelos/[...ruta]` y `/api/renders/[archivo]`
(`src/lib/protegido.ts`). `next.config.mjs` reescribe `/models/*` y
`/renders/*` hacia ellas, asi que las URLs del codigo no cambian y `proxy.ts`,
que corre antes de las reescrituras, las protege.

Las rutas ademas:

- limitan por IP: 30 GLB por minuto y 300 renders por minuto (429 con
  `Retry-After`). Una visita normal pide de 1 a 3 GLB;
- responden 403 al GLB cuando la peticion es una navegacion directa del
  navegador (`Sec-Fetch-Dest: document`), que es como se baja pegando la URL;
- validan la ruta con lista cerrada (segmentos con formato exacto, extension
  `.glb` o `.jpg`, resultado dentro de `protegido/`);
- mandan `Cache-Control: private` y `ETag`, para que ningun CDN ni proxy
  compartido guarde el archivo y el navegador reciba 304 en vez de rebajar 12 MB.

Interna recibe las mismas rutas. Su espejo copia `vitrina/protegido/` a
`interna/protegido/`.

## Consecuencias

- La carpeta se llama `protegido/` y no `contenido/`: la regla sin anclar
  `contenido/` del `.gitignore` raiz la ignoraba, y interna ya usa su propio
  `contenido/` (el BOM), que el espejo habria podado.
- Un GLB o render nuevo se pone en `protegido/`. Uno que se ponga en `public/`
  queda abierto.
- Las rutas leen de disco en cada peticion, asi que `protegido/` va en
  `outputFileTracingIncludes` de las dos apps; sin eso falla solo en Hostinger.
- Se quito la cabecera `Cache-Control: public` que `next.config.mjs` ponia a
  `/models/*`: permitia que un CDN guardara el GLB y lo sirviera sin
  contrasena.
- El limite es en memoria: se reinicia con cada despliegue y cada proceso lleva
  el suyo. La IP sale de la ultima entrada de `x-forwarded-for` (la que agrega
  el proxy de Hostinger); si se pone un CDN delante hay que revisar esa funcion.
- `public/manuales/` y `public/brand/` se quedan en `public/`: son material de
  venta.

## Lo que esto no resuelve

- **El repo es publico y los modelos estan en git.** Cualquiera puede clonarlo.
  Hostinger necesita el repo publico por ahora; mientras eso siga asi, esta
  decision cierra el sitio y no el repo. Si el repo pasa a privado o los
  modelos salen de git, se revisa.
- Quien tiene credenciales puede bajar el GLB: el limite lo hace mas lento y
  deja rastro, no lo impide. Lo que se dibuja en el navegador, el navegador lo
  tiene.
- Lo que ya se descargo antes de este cambio no se puede recuperar.

## Alternativas descartadas

- **Cifrar el GLB y descifrarlo en el navegador:** la clave y el modelo
  descifrado terminan en memoria del cliente. Mucho trabajo, falsa seguridad.
- **Dejar los archivos en `public/` y confiar en el proxy:** es el error que
  origino esto.
- **Una ruta de API distinta de la URL actual:** habria obligado a tocar las
  ~40 rutas de renders de `mx80.ts`, el visor y las paginas. La reescritura
  evita todo eso.

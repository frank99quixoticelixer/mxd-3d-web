# CLAUDE.md — mxd-3d-web

Monorepo de la plataforma web MXD. Tres apps Next.js desde un solo repo;
cada una se despliega en Hostinger como sitio independiente.

## Estructura del monorepo

```
apps/vitrina/   → mxddrone.com            — visor 3D publico, catalogo, descargas
apps/pedidos/   → pedidos.mxddrone.com    — portal de pedidos de piezas para clientes
apps/interna/   → interno.mxddrone.com    — clon de vitrina + BOM, stock (detras de contrasena)
packages/datos/ → catalogo y tipos compartidos entre las tres apps
packages/ui/    → componentes y estilos MXD compartidos
```

Los dos `packages/` estan declarados pero **vacios** (`export {}`). Hoy nada se
comparte de verdad entre apps, y no es facil que se comparta: el zip que sube a
Hostinger lleva solo la carpeta de una app, sin `packages/` al lado, asi que una
dependencia local no se resolveria en el servidor.

Para levantar una app en local:

```
cd apps/vitrina && npm install && npm run dev   # puerto 3000
cd apps/pedidos && npm install && npm run dev   # puerto 3001
cd apps/interna && npm install && npm run dev   # puerto 3002
```

Para simular produccion exactamente antes de hacer push:

```
cd apps/vitrina && npm run build && npm run start
```

## Para que es cada app

Las tres sirven el mismo dron y el mismo visor 3D, pero no muestran lo mismo ni
al mismo publico. Es la decision que gobierna todo lo demas en este repo.

| App | Para quien | Que ve |
|-----|-----------|--------|
| vitrina | cualquiera; es material de venta | explora el dron en 3D y nada mas: nombres, descripcion, renders, despiece visual |
| interna | el equipo, con contrasena | todo: archivos, proveedores, numeros de parte, cotas, existencias |
| pedidos | clientes que necesitan una pieza | el despiece, para poder indicar exactamente que pieza requieren |

Lo que distingue a la vitrina no es que esconda botones: es que **los datos de
ingenieria no existen en lo que se le manda al navegador**. Lo que distingue a
interna no es el dominio: es que esta detras de contrasena.

pedidos sale del mismo contenido que las otras dos. Su pieza clave es el
despiece: de nada sirve un catalogo si el cliente no puede indicar cual de
cuatro piezas parecidas es la que se le rompio.

## La frontera entre publico e interno

### Por que no es una sola app con un flag

Lo intuitivo seria una sola app y una variable que encienda o apague los datos
internos. No funciona: **un flag esconde interfaz, no esconde datos.** Todo lo
que un componente de cliente recibe viaja serializado en el HTML de la pagina,
y los chunks de JavaScript son archivos estaticos que cualquiera puede pedir por
su URL. Si el catalogo con proveedores entra al bundle de la app publica, esta
publicado aunque ningun boton lo muestre.

De ahi que vitrina e interna sean dos apps y no una. Hoy eso se ve como
duplicacion; cuando interna tenga su propio modelo de datos y sus propias
paginas, se vera como lo que es.

### Los tres niveles de datos

El esquema de `Pieza` (`src/lib/esquema.ts`) es uno solo y tiene 25 campos de
todos los niveles mezclados. Cada app deberia poder cargar solo el suyo:

- **publico**: sku, nombre, slug, descripcion, jerarquia, y lo que el visor
  necesita para armar la escena (`nombresBlender`, `direccionExplosion`,
  `factorExplosion`)
- **pedidos**: lo anterior, mas numero de parte, cantidad por dron y descargas
- **interno**: lo anterior, mas cotas, material, acabado, proveedor, parte del
  proveedor, proceso de fabricacion, precio y existencias

Partir el esquema en estos tres niveles sigue pendiente. Mientras tanto, la
vitrina se protege recortando.

### Como se protege la vitrina

`apps/vitrina/src/lib/publico.ts` recorta cada pieza a lo publico, y se aplica
en `lib/catalogo.ts`, que es la unica puerta al catalogo de toda la app. Una
pagina nueva sale recortada sin que nadie tenga que acordarse.

La lista es de lo que **si** sale, no de lo que se quita. Un campo nuevo en el
esquema queda fuera por omision; con una lista de exclusiones se publicaria por
descuido.

Dos reglas que se siguen de esto:

1. **Ningun componente de cliente importa `lib/catalogo`.** Si necesita datos
   del catalogo, los recibe por props desde el servidor. Importarlo arrastra
   `data/mx80.ts` completo —con el JSON de especificaciones— a un chunk de
   `/_next/static`. Ya paso una vez: `EscenaPieza.tsx` lo importaba por una
   sola llamada a `obtenerSubpiezas()`.
2. **Las fichas tecnicas en PDF solo existen en interna.** Emiten el BOM con
   proveedores y numeros de parte del proveedor; en el dominio publico no
   tienen ninguna puerta.

Como comprobarlo despues de tocar la capa de datos:

```
cd apps/vitrina
# sembrar un valor centinela en src/data/especificaciones-mx80.json
npm run build
grep -rl CENTINELA .next/static .next/server/app
# debe devolver cero archivos. Solo puede aparecer en .next/server/chunks,
# que no se sirve al navegador.
```

### Como se protege interna

`apps/interna/src/proxy.ts`: autenticacion HTTP basica sobre **todo**, incluidas
las rutas `/api`, los GLB de `public/` y los chunks de `/_next/static`. Los
chunks importan porque son estaticos que se piden por URL y en esta app pueden
llevar dentro el catalogo interno.

- Necesita `INTERNA_USUARIO` e `INTERNA_CLAVE`. **Sin ellas responde 503 a
  todo**, a proposito: un olvido de configuracion no debe publicar el panel.
  Si interna devuelve 503, falta configurar esas variables en hPanel.
- Se leen en cada peticion y no se hornean en el bundle: cambiar la contrasena
  solo exige reiniciar el sitio, no reconstruir.
- En local van en `apps/interna/.env.local` (gitignored).
- El archivo se llama `proxy.ts` y no `middleware.ts` porque Next 16 renombro
  la convencion; el export tiene que llamarse `proxy`.

No es un sistema de cuentas, a proposito: para tres personas detras de HTTPS,
una contrasena compartida es la proteccion correcta por el esfuerzo que cuesta.
Cuando haya que saber QUIEN cambio cada dato, se reemplaza por cuentas de
verdad.

## Equipo

Eduardo, Francisco (`frank99quixoticelixer`) y Axel (`AxelEspitia77`).
Fotogrametria y modelos: Francisco y Axel. Estructura, roadmap y copy: Eduardo.
Ritmo: checkpoint semanal con demo desplegada en Hostinger.

## Stack

- Next.js 16.3.5, React 19, Tailwind 4, TypeScript.
- Visor 3D: `react-three-fiber` 9 + `drei` 10 + `three` 0.186.
- PDFs: `@react-pdf/renderer` — declarado en `serverExternalPackages` para que
  webpack no lo rompa (usa streams y Buffer de Node.js internamente).
- Deploy: Hostinger Business Web Hosting, `mxddrone.com`.
- Build: `next build --webpack` (Turbopack no corre en el glibc de Hostinger).
- Config: `next.config.mjs` (no `.ts`; el SWC binario falla en Hostinger).

## Archivos de modelos — donde vive cada cosa

| Tipo | Ruta en repo | Acceso en produccion |
|------|-------------|----------------------|
| GLB visor (brazo, frame) | `apps/vitrina/public/models/mx80/` | estatico `/models/mx80/...` |
| GLB piezas individuales | `apps/vitrina/public/models/mx80/piezas/` | estatico `/models/mx80/piezas/...` |
| GLB/STL descargas | `apps/vitrina/public/downloads/<SKU>/` | estatico `/downloads/<SKU>/<SKU>.glb` y `.stl` |
| PDFs fichas tecnicas | generados en el momento por `@react-pdf/renderer` | API `/api/ficha/...`, **solo en interna** |
| Renders JPG | `apps/vitrina/public/renders/` | estatico `/renders/...` |

Las descargas se commitearon en `public/downloads/` (56 archivos, 65 MB) y se
sirven como estaticos, sin pasar por ninguna ruta de API. Ya no hace falta
subirlas por FTP.

`contenido/` sigue gitignored y no existe en Hostinger. La ruta
`/api/descarga/[sku]/[formato]` todavia existe en el repo pero **la interfaz de
vitrina ya no la usa**; quedo como respaldo.

### interna comparte los assets de vitrina

`apps/interna` es un clon del catalogo de vitrina y usa los mismos GLB,
renders y descargas (103 MB). Esos archivos **no se duplican en git**:

- `apps/interna/public/` y `apps/interna/contenido/` estan gitignored.
- La fuente de verdad es siempre `apps/vitrina/public/`.
- `apps/interna/scripts/sincronizar-publico.mjs` los espeja. Lo corren
  `predev` y `prebuild`, asi que `npm run dev` y `npm run build` en interna
  ya los traen solos. La copia es incremental (compara tamanio y mtime).
- El workflow de deploy corre el script antes de empaquetar, porque el zip
  que sube a Hostinger lleva solo `apps/interna` y alla no hay vitrina.

Un asset nuevo para interna se pone en `apps/vitrina/public/` igual: el
espejo es unidireccional y lo que quede solo en interna se pierde.

## Como agregar o actualizar un GLB

Los GLB del visor y de piezas van en `apps/vitrina/public/models/` y se
commitean como **binarios reales**, sin Git LFS. Hostinger no soporta LFS.

La carpeta `apps/vitrina/public/models/` tiene su propio `.gitattributes` que
anula el filtro LFS para todos los GLB dentro de ella:

```
*.glb !filter !diff !merge -text
```

Flujo para actualizar un modelo:

1. Exporta el GLB desde Blender con Draco, nombre `{SKU}_v{n}.glb`.
2. Copia el archivo a `apps/vitrina/public/models/mx80/piezas/` (o a `mx80/`
   si es el ensamble principal).
3. Verifica que el filtro no aplica LFS:
   ```
   git check-attr filter apps/vitrina/public/models/mx80/piezas/MX80-007_v2.glb
   # debe decir: filter: unspecified
   ```
4. Si dice `filter: lfs`, NO hagas `git add`. Algo sobreescribio el
   `.gitattributes` local. Revisa y corrige antes de continuar.
5. Stagea solo ese archivo:
   ```
   git add apps/vitrina/public/models/mx80/piezas/MX80-007_v2.glb
   ```
6. Commit y push.

## Como hacer commits — reglas criticas

**Nunca `git add -A` ni `git add .`** en este repo. Hay GLBs pesados,
renders y backups que pueden entrar sin querer.

Siempre stagea por archivo o carpeta explicita:

```
git add apps/vitrina/src/data/mx80.ts
git add apps/vitrina/public/models/mx80/piezas/MX80-007_v2.glb
git add apps/pedidos/src/app/page.tsx
```

Antes de cada commit, revisa `git status --short` para confirmar que solo
entran los archivos que quieres.

## Despliegue en Hostinger

El despliegue lo hacen dos GitHub Actions en `.github/workflows/`, que se
disparan al llegar codigo a `main`. Empaquetan cada app aislada, la suben a
Hostinger por su API y lanzan el build alla. **No conectar los sitios al builder
de Git de hPanel**: con este monorepo no funciona (ver la nota del `workspaces`
en "Estado y pendientes"). El detalle completo esta en
[README.md](README.md).

| Sitio | Dominio | Workflow |
|-------|---------|----------|
| Vitrina | mxddrone.com | `deploy-vitrina.yml` |
| Interna | interno.mxddrone.com | `deploy-interna.yml` |
| Pedidos | pedidos.mxddrone.com | todavia no existe |

Rama de trabajo: `dev` (o ramas por feature). Merge a `main` dispara el
redeploy en Hostinger.

Las descargas GLB/STL si estan en git, en `apps/vitrina/public/downloads/`.
Viajan en el zip del deploy y no hay que subir nada por FTP.

## Estado y pendientes

### Donde esta cada cosa

> **El recorte de la vitrina y la contrasena de interna estan en la rama
> `separacion-vitrina-interna`, sin merge a `main` y por lo tanto sin
> desplegar.** Hasta que ese PR entre, mxddrone.com sigue publicando
> especificaciones e interno.mxddrone.com sigue abierto a cualquiera. Si lo que
> importa es cerrar eso, lo primero es mergear, y definir
> `INTERNA_USUARIO` e `INTERNA_CLAVE` en hPanel **antes** de que interna
> redespliegue, porque si faltan el sitio responde 503.

- **vitrina**: en linea. El recorte de datos y la baja de las rutas de ficha PDF
  estan hechos en la rama, pendientes de desplegar.
- **interna**: en linea, **todavia sin contrasena** hasta el merge. Su visor
  esta **adelante** del de vitrina: tiene el explorador in-place, que descompone
  el brazo en sus componentes reales (`giratorio`, `motor_giratorio`,
  `balanceador`, `helices`, `estatico`) y permite aislar un componente sin
  salir de la zona.
  Son unas 290 lineas de `EscenaFrame.tsx` que vitrina no tiene, mas el cambio
  de `piezaAislada` de `string` a `string[]` en el store: un componente logico
  abarca varios nodos del GLB (el motor es `motor_giratorio` + `estatico`).
  Ese es el arreglo de que al picar un brazo la camara mandaba al motor.
- **pedidos**: cascaron de 7 archivos, nunca instalado. Va en Next 15.3.3
  mientras las otras dos van en 16.3.5.
- **packages/**: declarados y vacios.

### Pendientes, en orden

1. Bajar el explorador in-place de interna a vitrina.
2. Partir el esquema en los tres niveles de datos.
3. Unificar el deploy de interna. `deploy-interna.yml` puede empaquetar
   `apps/vitrina` y subirlo a `interno.mxddrone.com`: la URL de subida la genera
   la API de Hostinger a partir del **dominio**, no del nombre de la carpeta, y
   el build corre alla leyendo las variables de cada sitio. Eso elimina
   `apps/interna` como copia y el script de espejo de assets.
4. Terminar interna: archivos, proveedores, numeros de parte, cotas.
5. Derivar pedidos del despiece de interna.

### Cosas sueltas que conviene saber

- **El `workspaces` del `package.json` raiz no lo usa nada y estorba.** No hay
  lockfile en la raiz; cada app tiene el suyo y se instala sola. Por culpa de
  ese campo, `npm ci` dentro de una app falla pidiendo un lockfile de la raiz:
  hay que correr `npm ci --no-workspaces`. Es tambien lo que rompio el deploy
  con un 503 (npm instala react y next fuera de la carpeta de la app y el output
  standalone no los encuentra en runtime), y la razon de que los workflows
  empaqueten cada app aislada.
- **Las fichas PDF fallan en produccion.** Cuando existian en vitrina,
  `/api/ficha/completo` y `/api/ficha/pieza/[sku]` devolvian 500 en
  mxddrone.com; en local devuelven 200. El problema es del entorno de Hostinger,
  no del codigo. Sigue sin resolver, ahora en interna.
- **`@react-pdf/renderer` sigue declarado en vitrina y ya nada lo usa.**
  Quitarlo regenera el `package-lock.json`, que es la entrada del build, asi
  que merece su propio commit.
- **Los dos avisos de `react-hooks/exhaustive-deps`** en `EscenaFrame.tsx` y
  `EscenaPieza.tsx` son previos y estan en las dos apps. No son errores.

### Relacion con el repo anterior

`eduardoalvarz/mxd-3d` y este repo **no comparten historia**: no hay ancestro
comun (`git merge-base` no devuelve nada). Este se empezo de cero como monorepo
y el trabajo anterior se copio como archivos. **No se puede hacer merge ni
rebase entre los dos.**

Lo que quedo solo en el repo viejo y aqui no existe:

- `Maestro_Partes_MX80.xlsx` y su `.csv`: la base de datos oficial de 114 partes
- los `scripts/` de Python que la generan y sincronizan (`maestro.py`,
  `sincronizar_maestro.py`, `enriquecer_maestro.py`, `asignar_zonas.py`)
- `docs/` y `plans/` de la raiz
- las fuentes de diseno: STEP, `.blend`, STL crudos

Si el maestro sigue siendo la fuente oficial de los numeros de parte, hoy vive
en un solo lugar y sin respaldo en el repo donde se trabaja.

## No-go zones

- **Nunca `git add -A`** — hay assets pesados a un descuido de entrar.
- **No meter fotos crudas ni proyectos COLMAP a git.** Viven en Google Drive.
- **No mencionar TopXGun** en copy ni en artefactos del usuario final.
- **No tocar el repo `mxd-3d` de Eduardo** (eduardoalvarz/mxd-3d) desde
  este repo; son frentes separados que pueden convivir.

## Como trabajar con Axel

El servidor de desarrollo lo arranca el. No lo levantes: entrega el comando y
dejalo correr. Compilar, tipar, lintear y revisar git si se puede hacer directo,
porque terminan solos.

## Convenciones

- Slugs kebab-case sin acentos.
- Sin emojis en UI ni en documentos.
- Verificacion antes de afirmar: no se dice "listo" sin correr el comando.
- Nombres de GLB: `{SKU}_v{n}.glb` para piezas, nombre descriptivo para
  ensambles (`MX80_brazo_CW_web.glb`, `frame_MX80_v3_web.glb`).
- La version del GLB sube cuando reexportas desde Blender. El codigo apunta
  al nombre en `apps/vitrina/src/config/modelos3d.ts`; cambia solo ahi.

## Contexto util fuera del repo

- BOM real del dron: `software-mxd/artifacts/manuales-revision/mx60-mant/data/bom_*.json`
- GLB del ensamble en repo anterior: `eduardoalvarz/mxd-3d` rama `despliegue-web`

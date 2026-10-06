# CLAUDE.md — mxd-3d-web

Monorepo de la plataforma web MXD. Tres apps Next.js desde un solo repo;
cada una se despliega en Hostinger como sitio independiente.

## Estructura del monorepo

```
apps/vitrina/   → mxddrone.com            — visor 3D publico, catalogo, descargas
apps/pedidos/   → pedidos.mxddrone.com    — portal de pedidos de piezas para clientes
apps/interna/   → interna.mxddrone.com    — BOM, modelos, stock (acceso interno)
packages/datos/ → catalogo y tipos compartidos entre las tres apps
packages/ui/    → componentes y estilos MXD compartidos
```

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

## Equipo

Eduardo, Francisco (`frank99quixoticelixer`) y Axel (`AxelEspitia77`).
Fotogrametria y modelos: Francisco y Axel. Estructura, roadmap y copy: Eduardo.
Ritmo: checkpoint semanal con demo desplegada en Hostinger.

## Stack

- Next.js 15, React 19, Tailwind 4, TypeScript.
- Visor 3D: `react-three-fiber` + `drei` + `three` 0.185.
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
| GLB/STL descargas | `apps/vitrina/contenido/piezas_MX80/descargas/` | API `/api/descarga/[sku]/[formato]` |
| PDFs fichas tecnicas | generados en el momento por `@react-pdf/renderer` | API `/api/ficha/...` |
| Renders JPG | `apps/vitrina/public/renders/` | estatico `/renders/...` |

`contenido/` es gitignored. No existe en Hostinger. Hay que subirlo por FTP
cada vez que se actualicen descargas de STL. La ruta en el servidor es la raiz
del proyecto Next.js tal como Hostinger la despliega.

La ruta `/api/descarga/[sku]/glb` tiene fallback a `public/models/mx80/piezas/`
cuando `contenido/` no existe — cubre el caso de Hostinger sin FTP.

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

Cada app es un sitio separado en hPanel. Todos apuntan al mismo repo y rama,
pero con distinto "Application root":

| Sitio en hPanel | Repo | Branch | Application root | Dominio |
|-----------------|------|--------|-----------------|---------|
| Vitrina | mxd-3d-web | main | apps/vitrina | mxddrone.com |
| Pedidos | mxd-3d-web | main | apps/pedidos | pedidos.mxddrone.com |
| Interna | mxd-3d-web | main | apps/interna | interna.mxddrone.com |

Build command para los tres: `npm run build`
Start command para los tres: `npm run start`

Rama de trabajo: `dev` (o ramas por feature). Merge a `main` dispara el
redeploy en Hostinger.

Los STL de descargas no estan en git. Subirlos a Hostinger por FTP/SFTP
con FileZilla a la carpeta `contenido/piezas_MX80/descargas/` en la raiz
del proyecto de vitrina en el servidor.

## No-go zones

- **Nunca `git add -A`** — hay assets pesados a un descuido de entrar.
- **No meter fotos crudas ni proyectos COLMAP a git.** Viven en Google Drive.
- **No mencionar TopXGun** en copy ni en artefactos del usuario final.
- **No tocar el repo `mxd-3d` de Eduardo** (eduardoalvarz/mxd-3d) desde
  este repo; son frentes separados que pueden convivir.

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

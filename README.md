# mxd-3d-web — despliegue

Como se publican las webs MXD y que hay que hacer para que un cambio llegue
a produccion.

Para levantar el proyecto en local, la estructura del monorepo y las
convenciones de codigo, ver [CLAUDE.md](CLAUDE.md).

## Las webs

| Web | Dominio | Codigo | Despliegue |
|-----|---------|--------|-----------|
| Vitrina | [mxddrone.com](https://mxddrone.com) | `apps/vitrina/` | automatico |
| Interna | [interno.mxddrone.com](https://interno.mxddrone.com) | `apps/interna/` | automatico |
| Pedidos | pedidos.mxddrone.com | `apps/pedidos/` | todavia no existe |

Las tres viven en el mismo repositorio y se despliegan por separado en
Hostinger.

**Vitrina e interna no muestran lo mismo, a proposito.** Vitrina es material de
venta: se explora el dron y nada mas. Las cotas, el material, el proveedor, el
numero de parte del BOM y las existencias se quedan en interna, y las fichas
tecnicas en PDF tambien: esas rutas solo existen ahi. Interna arranca del mismo
catalogo de vitrina y trae encendido el panel de diagnostico del visor, pero
entra por contrasena.

El recorte de vitrina esta en `apps/vitrina/src/lib/publico.ts`; la puerta de
interna, en `apps/interna/src/proxy.ts`.

Pedidos no tiene workflow: cuando lo necesite, se copia
`.github/workflows/deploy-interna.yml`, se cambia `DOMAIN` y los `paths`.

## Donde modificar cada web

Cada app es independiente. Un cambio en `apps/vitrina/` no afecta a interna
salvo que sea en `public/` (ver [Assets compartidos](#assets-compartidos)).

| Que quieres cambiar | Donde |
|---------------------|-------|
| Textos, portada, secciones de la web publica | `apps/vitrina/src/app/` |
| Lo mismo en la web interna | `apps/interna/src/app/` |
| Colores, logo, datos de contacto | `src/config/marca.ts` de cada app |
| Catalogo de piezas, SKUs, especificaciones | `src/data/` de cada app |
| Comportamiento del visor 3D | `src/features/viewer/` de cada app |
| Fichas tecnicas PDF | `src/features/ficha-pdf/` de interna (vitrina no las tiene) |
| Que GLB carga el visor | `src/config/modelos3d.ts` de cada app |
| Modelos 3D, renders, descargas | `apps/vitrina/public/` (para las dos webs) |
| Editor de etiquetas de piezas | `apps/vitrina/public/brand/etiqueta-editor.html` |

Las dos apps tienen hoy el mismo codigo pero son copias independientes: un
cambio en el catalogo de vitrina **no** se refleja en interna. Si quieres que
un cambio aparezca en las dos, hay que hacerlo en las dos.

La excepcion son los assets.

## Assets compartidos

`apps/vitrina/public/` es la fuente de verdad de los GLB, renders y
descargas de **las dos webs**. Son 103 MB y no se duplican en git:
`apps/interna/public/` esta gitignored y se llena copiando desde vitrina.

Esa copia la hace `apps/interna/scripts/sincronizar-publico.mjs`, que corre
solo antes de cada `npm run dev` y `npm run build` de interna. No hay que
invocarlo a mano.

Consecuencia practica: **un asset nuevo se pone siempre en
`apps/vitrina/public/`**, aunque sea solo para interna. El espejo es
unidireccional y lo que quede unicamente en `apps/interna/public/` se pierde
en el siguiente build.

## Como desplegar

El despliegue se dispara al llegar codigo a la rama `main`. No hay que
entrar a Hostinger ni subir archivos a mano.

1. Trabaja en tu rama (`dev` o una rama por feature).
2. Antes de abrir el PR, corre el build de la app que tocaste, para no
   descubrir el error en el runner:
   ```
   cd apps/vitrina && npm run build
   ```
3. Abre un PR hacia `main` y mergealo.
4. El merge arranca el workflow. Sigue el avance en la pestana **Actions**
   del repositorio en GitHub.
5. Suele tardar varios minutos: el build corre en el servidor de Hostinger,
   no en GitHub. Si el job termina en verde, la web ya esta actualizada: el
   ultimo paso del workflow verifica que el dominio responda 200 antes de
   darse por bueno.

Tambien se puede lanzar a mano sin tocar codigo, util para reconstruir el
sitio despues de cambiar una variable de entorno en Hostinger: pestana
**Actions**, elige el workflow, boton **Run workflow**.

## Que dispara que

Un push a `main` **no** despliega las dos webs. Cada workflow declara en
`paths:` que archivos le importan y GitHub solo lo arranca si el push toco
alguno de ellos.

| Lo que toca el push a `main` | Despliega vitrina | Despliega interna |
|------------------------------|-------------------|-------------------|
| `apps/vitrina/src/**` | si | no |
| `apps/interna/src/**` | no | si |
| `apps/vitrina/public/**` (un GLB nuevo) | si | si |
| `apps/pedidos/**`, `CLAUDE.md`, este archivo | no | no |

El unico caso donde salen las dos a la vez es un cambio en
`apps/vitrina/public/`, y es intencional: esa carpeta alimenta a las dos
webs, asi que un GLB reexportado tiene que llegar a ambas o interna se queda
con la version vieja.

Cuando se disparan las dos, son dos jobs independientes y en paralelo. No se
estorban: la URL de subida que pide cada uno es por dominio.

## Que hace el workflow por dentro

Los dos workflows son iguales salvo el dominio y un paso extra en interna.
Viven en [`.github/workflows/`](.github/workflows/).

1. **checkout** del repositorio.
2. **Sincronizar assets** — solo interna. Copia `apps/vitrina/public/` a
   `apps/interna/public/`. Tiene que pasar aqui porque el paquete que se
   sube a Hostinger lleva solo `apps/interna` y alla no hay ninguna carpeta
   de vitrina al lado.
3. **Empaquetar** la app en `app.zip`, sin `node_modules`, `.next` ni
   `.env`.
4. **Subir** el zip a Hostinger por su API publica (protocolo TUS).
5. **Lanzar el build** de Node.js en el servidor: Node 22, `npm run build`,
   salida en `.next`.
6. **Esperar el resultado**, sondeando cada 15 segundos hasta 10 minutos. Si
   el build falla, el workflow imprime los logs de Hostinger en el log del
   job y termina en rojo.
7. **Verificar** que `https://<dominio>/` responda 200.

Por eso un deploy roto se nota en Actions en vez de aparecer como un 503 en
la web.

### Por que no se usa el builder de Git de Hostinger

Hostinger puede construir desde GitHub directamente, pero no funciona con
este monorepo: npm workspaces instala `react`, `react-dom` y `next` en la
raiz del repositorio, fuera de `apps/vitrina`, y el output standalone de
Next.js no los encuentra en runtime. El sitio levanta y responde 503.

Los workflows existen para evitar eso: empaquetan cada app aislada, con su
propio `package-lock.json`, sin ningun `package.json` de monorepo de por
medio. No conectar los sitios al builder de Git en hPanel.

## Configuracion que vive fuera del repositorio

| Que | Donde | Para que |
|-----|-------|----------|
| `HOSTINGER_API_TOKEN` | GitHub, Settings > Secrets and variables > Actions | autentica al workflow contra la API de Hostinger |
| `NEXT_PUBLIC_SITIO_URL` | hPanel, variables de entorno del sitio | URL publica en metadatos y Open Graph |
| `NEXT_PUBLIC_DIAGNOSTICO_3D` | hPanel, variables de entorno del sitio | panel de piezas del GLB sin coincidencia en el catalogo. `false` en vitrina, `true` en interna |
| `INTERNA_USUARIO` | hPanel, variables de entorno del sitio de interna | usuario del acceso al panel interno. **Sin el, interna responde 503 a todo** |
| `INTERNA_CLAVE` | hPanel, variables de entorno del sitio de interna | contrasena del acceso al panel interno. Idem |

A diferencia de las `NEXT_PUBLIC_*`, `INTERNA_USUARIO` e `INTERNA_CLAVE` se leen
en cada peticion y no se hornean en el bundle: cambiarlas surte efecto al
reiniciar el sitio, sin reconstruir.

Las variables `NEXT_PUBLIC_*` se hornean en el bundle durante el build, no se
leen en tiempo de ejecucion. **Cambiar una en hPanel no surte efecto hasta
que corre un build nuevo**: lanza el workflow a mano desde Actions.

El archivo `.env` no viaja en el paquete que sube el workflow, a proposito.
La configuracion de produccion vive en Hostinger.

## Si el deploy falla

1. Abre el job en rojo en la pestana **Actions**.
2. Busca el paso que fallo:
   - **Empaquetar** o **Subir archivo** — problema de credenciales o de la
     API. Revisa que `HOSTINGER_API_TOKEN` siga vigente.
   - **Esperar resultado del build** — el build fallo en el servidor. Los
     logs de Hostinger estan impresos ahi mismo en el log del job. Lo mas
     comun es un error de TypeScript o una dependencia que falta.
   - **Verificar que el sitio responde** — el build paso pero la app no
     levanta. Suele ser una variable de entorno faltante.
3. Arregla y mergea otra vez. No hace falta revertir nada en Hostinger: el
   siguiente deploy sobreescribe el paquete anterior.

## Lo que no es automatico

- **Los STL de descarga.** `contenido/` esta gitignored y no existe en
  Hostinger. Se suben por FTP o SFTP a
  `contenido/piezas_MX80/descargas/` en la raiz del proyecto en el servidor.
  Mientras no esten, `/api/descarga/[sku]/glb` cae a
  `public/models/mx80/piezas/`.
- **Las fotos crudas y los proyectos COLMAP.** Viven en Google Drive, nunca
  en git.
- **Pedidos.** Sin workflow todavia.

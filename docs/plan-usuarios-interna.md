# Cuentas de usuario en interna: plan y registro de avance

Documento vivo. **Quien trabaje en esto (persona o Claude) lo actualiza al
terminar cada sesion**: marca el checklist, agrega una entrada al registro del
final y corrige "Siguiente paso". Es lo primero que se lee al retomar.

- Estado: login y BOM en base **desplegados en `main`** (2026-11-17, commit
  "demostracion"). Desde el 2026-11-18 produccion tiene su **propia base**
  (`u352406053_interno_prod`). Lo que falta para el uso real esta marcado con
  `[ ]` y resumido en "Siguiente paso". La rama `interna-cuentas` ya no tiene
  trabajo propio: todo lo suyo esta en `main`.
- **Relevo mas reciente: [relevo-2026-11-23.md](relevo-2026-11-23.md)**: lo
  hecho el 2026-11-23 sin desplegar (rama `interna-bom-origen`) y lo que falta,
  en orden. Leerlo antes de seguir.
- Decision de fondo: [ADR 0006](lineamientos/decisiones/0006-cuentas-individuales-en-interna.md).
- interna es el banco de pruebas. Si funciona aqui, vitrina y pedidos pueden
  reutilizarlo despues.

## Para que se hace

Antes: una sola contrasena compartida (autenticacion HTTP basica) con
`INTERNA_USUARIO` e `INTERNA_CLAVE` en hPanel. No se sabia quien entro ni quien
cambio cada dato, y quitarle el acceso a una persona obligaba a cambiar la
contrasena de todos.

Ahora: cada persona entra con su correo y contrasena, y cada edicion del BOM
queda registrada con quien la hizo.

## Decisiones tomadas

1. **Personas:** alrededor de 6 al inicio, con tendencia a crecer. Por eso cuentas
   reales en base de datos y no un hash por variable de entorno.
2. **Privilegios:** todos los usuarios activos tienen los mismos. No hay roles por
   ahora. Todo usuario activo puede descargar GLB/STL, ver todo lo de interna y
   editar los campos del BOM.
3. **Registro:** se guarda quien edito que y cuando (el motivo principal de salir
   de la contrasena compartida).
4. **Otras apps:** de momento solo interna. El esquema no debe impedir que
   vitrina o pedidos lo reutilicen.
5. **Libreria:** Better Auth (no `jose` con sesion propia, que era la otra
   opcion). Se usa solo desde el servidor con `auth.api.*`; su ruta HTTP
   `/api/auth/*` no se monta. Sin registro publico: las cuentas las crea el
   equipo con `npm run usuarios -- crear`.
6. **Base de datos:** MySQL de Hostinger. El BOM pasa a la base (ver mas abajo).
7. **Registro con aprobacion manual (2026-11-18):** quien necesite acceso lo
   solicita en `/registro` (nombre, empresa, correo y su propia contrasena). La
   cuenta nace inactiva (`activo = 0`); un administrador la aprueba en
   `/usuarios`. Sin contrasenas por correo. Los administradores son Francisco y
   Axel, con una marca `esAdmin`. Cada cuenta tiene un `estado` (pendiente,
   activa, rechazada, baja) y el login dice cual es; una solicitud rechazada se
   conserva y puede reabrirse. El correo (Hostinger Email, plan gratis 12
   meses) queda para despues: avisar la aprobacion y recuperar contrasenas.
   Cuidar: spam del formulario (limite por IP y campo trampa), correo sin
   verificar, aviso de privacidad. La ruta de registro de Better Auth sigue
   cerrada: la cuenta se crea desde una accion del servidor.

## Estado (checklist)

### Autenticacion

- [x] Libreria elegida (Better Auth) y ADR 0006.
- [x] Base MySQL de desarrollo creada y accesible: `u352406053_interno_dev`.
- [x] `src/lib/db.ts`: pool MySQL, solo servidor, null si falta configuracion.
- [x] `src/lib/auth.ts`: configuracion, sesion de 7 dias, cache de cookie de 60 s,
      cuenta inactiva no abre sesion.
- [x] Tablas de cuentas (`user`, `session`, `account`, `verification`) creadas en
      la base de desarrollo con `npm run db:migrar -- --aplicar`.
- [x] `/login` (formulario HTML que funciona sin JavaScript) y `cerrarSesion`.
- [x] Limite de intentos en memoria (`src/lib/limite-acceso.ts`).
- [x] `src/proxy.ts` exige sesion en todo; 503 si falta configuracion.
- [x] Segunda puerta `exigirSesion()` en `guardarEspecificaciones`.
- [x] Scripts `db:migrar` y `usuarios` (crear, desactivar, activar, listar).
- [x] Probado contra el servidor de desarrollo: sin sesion 307/401, login malo
      303 a `/login?error`, login bueno 303 a `/` con cookie, con cookie 200.
- [x] Probado en navegador (2026-11-11): el login funciona y entra al panel.
- [ ] Probar el limite de intentos, el boton de salir y la caducidad de la cache
      de sesion (cuenta desactivada con sesion abierta entra hasta 60 s).
- [x] `/login` y `/registro` ya no muestran el menu ni el BOM (2026-11-18,
      `OcultarEnRutaPublica`).
- [x] `/registro` y `/usuarios` construidos (ADR 0007): solicitud de acceso,
      aprobar, rechazar (con segunda oportunidad), desactivar, borrar, marca de
      administrador y salvaguardas. Probado en navegador en local el 2026-11-18
      solo la primera version; los estados, el boton Ver y el historial estan
      verificados por script y falta verlos en el navegador. Falta desplegar
      (antes: `db:migrar` en `_prod` y marcar administradores).
- [x] Boton "Ver/Ocultar" en los campos de contrasena (script en linea: estas
      paginas no cargan JavaScript porque el proxy bloquea los chunks), efecto
      de pulsado en los botones y circulo que gira al enviar: script en linea
      en `/login` y `/registro` (`BotonEnviar`), `useFormStatus` en `/cuenta`
      (`BotonEnviarEstado`).
- [x] `/historial`: quien cambio que en el BOM (`leerCambios` en `lib/bom.ts`).
- [x] `/cuenta` (2026-11-18): el encabezado muestra quien esta dentro (inicial y
      nombre) y enlaza a su cuenta, donde se ve su dato y se cambia la
      contrasena (`cuenta/acciones.ts`). Pide la actual, cuenta contra el mismo
      limite de intentos del login y cierra las demas sesiones. Verificado por
      script: contrasena mala no cambia, buena si, la vieja deja de entrar y
      las otras sesiones quedan fuera de la base. Por la cache de cookie de 60 s,
      otro dispositivo puede seguir entrando hasta un minuto.
- [x] Campo "Ensamble" en el catalogo de interna: en la ficha de cada subpieza
      (de lo general a lo especifico, con el SKU del inmediato) y en sus
      tarjetas dentro de "Piezas de ...". Sale de `parteDe`, sin migracion.
      vitrina no se toco.
- [x] El login distingue tres casos (2026-11-18, `login/acciones.ts`): credenciales
      malas (cuenta para el limite), cuenta inactiva con la contrasena correcta
      (mensaje propio) y falla del servidor o la base (mensaje propio, no cuenta
      para el limite). Verificado con una cuenta temporal inactiva; falta verlo
      en el navegador.

### El BOM pasa a la base de datos

Codigo escrito, desplegado y con la migracion e importacion aplicadas
(2026-11-17): `bom_piezas` tiene las 66 filas del Excel. Quedan sin fila las 88
piezas del GLB v5 (`bom:agregar` ve 154 piezas en el catalogo). La edicion de
fichas, el conflicto de version y la descarga del Excel **todavia no se han
probado contra la base**.

- [x] `src/lib/bom-tablas.ts`: DDL de `bom_piezas` y `bom_cambios`.
- [x] `db:migrar` tambien crea las tablas del BOM.
- [x] `src/lib/bom.ts` reescrito sobre la base: `leerBom`, `leerPieza`,
      `leerVersionBom`, `escribirPieza` (transaccion, `FOR UPDATE`), `ConflictoBom`
      y `cargarFilasIniciales`.
- [x] `escribirPieza` recibe el autor (`{id, correo}`) y escribe una fila en
      `bom_cambios` por campo que de verdad cambio, en la misma transaccion. Si no
      cambio nada, no sube la version ni escribe historial.
- [x] Control de version: la ficha manda `version` oculta; si cambio, devuelve
      `{ok:false}` y la interfaz avisa con "Descartar mis cambios y recargar".
- [x] Todo escritor exige sesion: `guardarEspecificaciones` y `guardarCruces`
      (`maestro/acciones.ts`) usan `exigirSesion()` y pasan el autor.
- [x] Se revalidan `/catalogo` (layout) y la ficha al guardar.
- [x] `catalogo/[slug]/page.tsx` pasa a `force-dynamic` (antes se prerenderizaba en
      el build y habria congelado el BOM).
- [x] `src/lib/bom-excel.ts` (importar y generar Excel) y `/api/bom/descargar`
      genera el Excel desde la base.
- [x] `scripts/importar-bom.ts`: `npm run bom:importar` (Excel a base) y
      `npm run bom:agregar` (suma al BOM las piezas del catalogo sin fila).
- [x] Aplicado el 2026-11-17: `db:migrar -- --aplicar` (2 tablas) y
      `bom:importar -- --aplicar` (66 filas).
- [ ] Decidir con el equipo si se corre `bom:agregar -- --aplicar` para dar fila
      a las 88 piezas del GLB v5.
- [ ] Probar contra la base: lectura, edicion desde la ficha, historial en
      `bom_cambios`, conflicto de version (dos navegadores), descarga del Excel
      y que el numero de filas coincida con el Excel original.
- [x] Vista del historial de cambios (quien, cuando, campo, antes y despues):
      `/historial`, con enlace a la ficha de cada pieza.
- [x] Retirado `scripts/migrar-a-bom.ts` y `bom:migrar` (2026-11-23).
- [x] Origen de las piezas (`maestro` / `agregada`), Restaurar en `/historial` y
      `/cortes` (fotos del BOM descargables), en produccion desde el 2026-11-24
      (PR #10).
- [x] **El maestro de partes en la base** (2026-11-24, PR #11): tabla
      `maestro_partidas` con las 113 partidas y sus 39 columnas
      (`lib/maestro-base.ts`, `npm run maestro:a-base`). Vive en la base y no en
      el repo porque el repo es publico.
- [x] **El Excel del BOM en el formato del maestro** (`lib/bom-maestro-excel.ts`):
      Tabla de Excel con orden y filtro en todas las columnas, numero de parte MXD
      como llave, columnas azules (maestro), verdes (ficha) y grises (sistema), SKU
      al final, hoja `Catalogo de Codigos` y menus desplegables. Un dato editado en
      la web gana; si no, el del maestro; si el maestro dice PENDIENTE, el de la
      web. Las piezas sin partida van al final (`SIN NUMERO` si no tienen numero).
- [x] Catalogo de codigos (`data/catalogo-codigos.ts`) y numero de parte al
      agregar una pieza al BOM, con sugerencia del siguiente consecutivo libre.
- [ ] Probar en produccion con una sesion abierta: abrir el Excel en Excel de
      verdad, crear un corte, agregar una pieza con numero de parte, Restaurar.
- [ ] Cruces con el maestro (`/maestro`): confirmar los `propuesto` y cruzar el
      resto (hoy muchas piezas salen `SIN NUMERO`).
- [ ] Importar el Excel de vuelta con el formato nuevo (hoy `bom:importar` lee el
      formato viejo; el flujo actual es base -> Excel).

### Produccion

- [x] Base de datos de produccion propia: `u352406053_interno_prod` (2026-11-18,
      con las tablas de cuentas y del BOM). Produccion ya no usa la `_dev`. Las
      credenciales estan en `.env.produccion.local` de la raiz (gitignored por
      `.env.*.local`). La BOM de demostracion (66 piezas, 2 cambios) se copio de
      `_dev` a `_prod` tal cual.
- [x] Variables en hPanel puestas el 2026-11-13 por la API de Hostinger (DB_*,
      `DB_HOST=127.0.0.1`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` nuevo, 32+
      caracteres). La API reemplaza el juego completo y oculta los valores: para
      cambiar una hay que mandar todas.
- [x] Las tablas de cuentas ya existian en la base (creadas desde local).
- [ ] Crear las cuentas reales del equipo. En `_prod` existe solo
      `fhernandez@dronesmxd.com.mx`. Falta Axel: se resuelve con `/registro` y
      `/usuarios` (decision 7). Las cuentas de `_dev` NO pasaron a `_prod`.
- [x] `INTERNA_USUARIO` e `INTERNA_CLAVE` quitadas de hPanel el 2026-11-18 (el
      reemplazo del juego de variables las elimino; ya nada las leia).
- [x] Login real probado en produccion el 2026-11-18 con la cuenta de `_prod`.
- [x] Probado con `next build --webpack` (rama `interna-login`). `next start`
      local no se pudo por la IP; el CSS de `/login` si sale por
      `/_next/static/css/` en produccion.
- [x] Revisado `deploy-interna.yml`: sin cambios necesarios.
- [x] Comprobado en produccion (2026-11-13) sin sesion: `/` 401 (307 a `/login`
      si el cliente pide HTML), GLB, descargas, ficha PDF, BOM y `/api/auth/*`
      401, chunks JS 401, `/login`, su CSS y el logo 200, y la contrasena vieja
      ya no entra. (El inicio de sesion real se probo el 2026-11-18.)
- [x] `_prod` migrada el 2026-11-24: tablas `bom_cortes` y `maestro_partidas`
      (113 partidas importadas). `bom_piezas` (67), `bom_cambios` (16) y `user`
      (3) no cambiaron. La IP se autorizo solo para eso y se quito.
- [ ] Respaldo: los respaldos de hPanel mas una exportacion periodica del BOM a
      Excel guardada fuera del servidor. Guardar tambien una copia del Excel del
      maestro (`Maestro_Partes_MX80-ah.xlsx`, fuera de git).

### Cierre

- [x] Actualizar `CLAUDE.md` y `README.md` (2026-11-24): describen el login con
      cuentas y las variables `DB_*` y `BETTER_AUTH_*`. `apps/vitrina/AGENTS.md`
      no habla de esto (es el bloque que genera `next dev`): no necesita cambio.
- [ ] `.github/workflows/deploy-interna.yml` (lineas ~117-126) todavia avisa que un
      503 es por `INTERNA_USUARIO`/`INTERNA_CLAVE`. Ya no aplica: ahora son `DB_*`
      y `BETTER_AUTH_*`. Solo cambia el texto del aviso; no se toco.
- [x] PR #10 (`interna-bom-origen`) y PR #11 (`interna-maestro-en-base`)
      mergeados y desplegados el 2026-11-24.

## Esquema del BOM en la base (decidido)

El BOM vive hoy en `apps/interna/contenido/BOM_MX80.xlsx`. El zip que se sube a
Hostinger lleva la app completa, asi que una edicion escrita a disco puede
perderse en el siguiente despliegue, y dos personas editando a la vez se pisan.
Por eso la fuente de verdad pasa a MySQL.

- `bom_piezas`: `sku` (llave), `datos` (JSON con los campos de `COLUMNAS` en
  `lib/bom.ts`), `version`, `actualizado_por`, `actualizado_en`. JSON y no una
  columna por campo: agregar un campo al BOM sigue siendo una entrada en
  `COLUMNAS`, sin `ALTER TABLE`.
- `bom_cambios`: `sku`, `campo`, `anterior`, `nuevo`, `usuario_id`, `fecha`. Una
  fila por campo cambiado.
- Solo se reemplazan `leerBom`, `leerPieza` y `escribirPieza`; las paginas no
  cambian (misma idea que `lib/catalogo.ts`).
- Las paginas que muestran el BOM leen en cada peticion.
- vitrina no se toca: su catalogo sigue siendo estatico y recortado.

## Siguiente paso

Trabajo por hacer para dejarlo listo para uso real. Hay un respaldo del Excel
original en `contenido/BOM_MX80.respaldo-antes-de-migrar-2026-11-09.xlsx`.

> **Actualizacion 2026-11-24 (cierre del dia).** Ya estan en `main` y desplegados
> el registro con aprobacion, `/usuarios`, `/historial`, el BOM en la base, el
> arreglo del login, `/cortes`, el maestro en la base y el Excel en el formato
> del maestro (PR #10 y #11). Lo que falta esta en
> [relevo-2026-11-23.md](relevo-2026-11-23.md), seccion "Pendientes": probar todo
> eso en produccion con una sesion abierta, decidir el merge del visor sin sombra
> de luz (`interna-visor-sin-sombra-de-luz`), confirmar cruces en `/maestro`, y
> las cuentas (Axel, correo, respaldo). Los puntos 1 a 3 de abajo y el "registro
> con aprobacion" son historia de antes de ese merge.

**Registro con aprobacion (decision 7), ya hecho.** `/registro` (formulario
publico: nombre, empresa, correo, contrasena; crea la cuenta con `activo = 0`),
`/usuarios` (solo administradores: pendientes, aprobar, rechazar, desactivar),
la marca `es_admin` en `user`, y que `proxy.ts` deje pasar `/registro` sin
sesion. Limite por IP y campo trampa contra spam. Si despues se quiere distinguir
"pendiente" de "dada de baja", hace falta un campo `estado` (hoy `activo` no
alcanza). El correo viene despues.

**Codigo** (en `apps/interna`):

1. Ocultar el encabezado y el pie en `/login`. Idea: un componente cliente que
   devuelva `null` si `usePathname()` es `/login`, envolviendo `<Encabezado />` y
   `<PieDePagina />` en `src/app/layout.tsx`, y poner el logo dentro del
   formulario de login.
2. Vista del historial (`/historial`): leer `bom_cambios` (quien, cuando, campo,
   antes y despues, con enlace a la ficha) con una funcion nueva `leerCambios` en
   `lib/bom.ts`, pagina `force-dynamic`, y un enlace en `NavegacionPrincipal.tsx`.
3. Retirar `scripts/migrar-a-bom.ts` y la entrada `bom:migrar` de `package.json`.
   Nadie mas los referencia (`bom:agregar` ya apunta a `importar-bom.ts`).

**Pruebas contra la base** (dejar las tablas como estaban al terminar):

4. En el navegador: abrir una ficha, editar un campo y ver el renglon en
   `bom_cambios`; abrir la misma ficha en dos sesiones y guardar en ambas para
   provocar el conflicto de version; descargar el Excel y comprobar que tiene
   las 66 filas del original.
5. Probar el limite de intentos, el boton de salir y la caducidad de la cache de
   sesion (ver Autenticacion).

**Produccion** (necesita decision o datos de ustedes):

6. Cuentas reales del equipo: hoy se crean con el registro (ver arriba). Mientras
   no exista, `npx tsx --env-file=../../.env.produccion.local scripts/usuarios.ts
   crear <correo> "<Nombre>"` desde `apps/interna` (pide la contrasena en
   terminal; hay que autorizar la IP en la base antes, ver "Como retomar").
7. Respaldo: los respaldos de hPanel mas una exportacion periodica del BOM a
   Excel (`/api/bom/descargar`) guardada fuera del servidor.
8. Decidir si se corre `bom:agregar` (88 piezas del GLB v5).
9. Correo (Hostinger Email, plan "Empezar", gratis 12 meses y luego se cobra) para
   avisar aprobaciones y recuperar contrasenas. No contratado.

**Cierre:** actualizar la seccion "Como se protege interna" de `CLAUDE.md`, que
aun describe la autenticacion HTTP basica, y `apps/vitrina/AGENTS.md`.

## Como retomar (lo que hay que saber)

### Donde esta la base de datos

No hay base local: ni `mysql`, ni `mariadb`, ni `docker` en la maquina de
desarrollo. `npm run dev` se conecta por internet a la base de Hostinger
`u352406053_interno_dev` en `srv902.hstgr.io:3306`. Hostinger solo deja entrar
desde fuera a la IP autorizada (`hosting_databases_list-remote-connections`); si
tu IP cambia, el login local falla con error de conexion y hay que autorizar la
nueva (`hosting_databases_create-remote-connection`). Las credenciales estan en
`apps/interna/.env.local` (gitignored); la plantilla es `.env.example`. En
produccion la app se conecta a `127.0.0.1`, nunca al host `srvNNNN`.

### Acceso desde la maquina local (IP)

La app en produccion usa `127.0.0.1` y no depende de ninguna IP. Solo tu maquina
(`npm run dev`, scripts de cuentas, migraciones) entra por internet, y para eso
Hostinger exige la IP publica autorizada. Esa IP cambia cuando te mueves de red.
Por eso **no se deja ninguna autorizada**: se autoriza al empezar una sesion
(`hosting_databases_create-remote-connection`) y se quita al terminar
(`hosting_databases_delete-remote-connection`). Si sale `Access denied ...
@'<ip>'`, es esto.

Las credenciales de la base de produccion estan en `.env.produccion.local` de la
raiz (gitignored). Se usan asi, desde `apps/interna`:
`npx tsx --env-file=../../.env.produccion.local scripts/usuarios.ts listar`.

### Comandos

```
cd apps/interna
npm run db:migrar                      # muestra que haria
npm run db:migrar -- --aplicar         # lo aplica (solo agrega, no borra)
npm run usuarios -- crear <correo> "<Nombre>"   # pide la contrasena en terminal
npm run usuarios -- listar | desactivar <correo> | activar <correo>
npm run usuarios -- admin <correo> | quitar-admin <correo>
npm run maestro:a-base -- ruta/al/Maestro.xlsx           # maestro -> base, en seco
npm run maestro:a-base -- ruta/al/Maestro.xlsx --aplicar # lo aplica (reemplaza la tabla)
npm run maestro:importar -- ruta/al/Maestro.xlsx         # regenera data/maestro-mx80.json
npm run dev                            # lo arranca Axel, no Claude (puerto 3002)
```

### Como se probo (se puede repetir)

Con `npm run dev` ya corriendo, y sin levantar otro servidor:

- `curl -i -H "Accept: text/html" http://localhost:3002/` debe dar 307 a `/login`.
- Una cuenta temporal creada con un script que use `auth.$context` y
  `internalAdapter` (como `scripts/usuarios.ts`), un POST multipart a `/login` con
  el campo oculto `$ACTION_ID_...` que trae el HTML, y despues borrar la cuenta.
  Dejar siempre las tablas como estaban.
- Llamar a `proxy()` directamente NO basta: no pasa por Next y no detecta errores
  como el de `Location`. Probar siempre tambien contra el servidor.

### Trampas ya encontradas

- **La base es MariaDB 11.8, no MySQL.** `JSON` es alias de `LONGTEXT` y el driver
  devuelve texto, no objeto: `lib/bom.ts` (`leerDatos`) acepta las dos formas.

- **Scripts con `tsx`:** el paquete compila a CJS, asi que no se puede usar `await`
  de nivel superior. Envolver en `async function main()`.
- **`Location` del proxy:** Next 16 lo procesa con `new URL()`; una ruta relativa
  lanza "Invalid URL" y la pagina da 404. Se arma con `BETTER_AUTH_URL`.
- **CSS de `/login`:** vive en `/_next/static/css/` en produccion (webpack) y en
  `/_next/static/chunks/` en desarrollo (Turbopack). El proxy abre cualquier
  `.css` bajo `/_next/static/`.
- **`public/brand/` tiene herramientas internas:** el proxy abre solo
  `/brand/logo-mxd.svg` e `/icon.svg`, no la carpeta.
- **`BETTER_AUTH_URL=http://localhost:3002`:** entrar por la IP de red redirige a
  `localhost`. Si hace falta abrirlo desde otro equipo, cambiar esa variable.
- Los chunks `.js` devuelven 401 en `/login` (a proposito): el formulario funciona
  sin JavaScript y la consola muestra esos errores.
- **Tablas nuevas: primero la base, despues el merge.** Si se despliega antes de
  `db:migrar --aplicar` (y de `maestro:a-base --aplicar`), la descarga del Excel
  falla porque consulta una tabla que no existe.
- **El maestro no va al repo.** `Maestro_Partes_MX80*.xlsx` esta en `.gitignore`: el
  repo es publico y el archivo trae numeros OEM, proveedores y notas de calidad.

## Registro de avance

Una entrada por sesion, la mas reciente arriba. Formato: fecha, que se hizo, que
quedo pendiente.


### 2026-11-24: Excel en el formato del maestro, maestro en la base, a produccion

- Limpieza: se quito el worktree `MXD-WEB-login` y 8 ramas locales ya mergeadas.
  Se aclaro que `MXD-WEB` (rama vieja) y `MXD-WEB-commit` son carpetas distintas.
- Desplegado el PR #10: arreglo del login (`esErrorDeApi`, contadores en
  `globalThis`), origen del BOM, Excel legible, Restaurar, `/cortes`, visor mas
  ligero. Se migro `_prod` (`bom_cortes`).
- Desplegado el PR #11: numero de parte al agregar una pieza al BOM, catalogo de
  codigos completo, maestro en la base (`maestro_partidas`, 113 partidas) y el
  Excel del BOM en el formato del maestro. Se migro e importo en `_prod` antes
  del merge.
- Verificado: `tsc` y `eslint` limpios; el Excel generado se comparo con el
  original celda por celda (openpyxl); en produccion, sin sesion, `/` y `/cortes`
  dan 307, `/login` 200 y `/api/bom/descargar` 401; los logs no muestran errores.
- **NO verificado:** nada con una sesion abierta en produccion, ni el Excel abierto
  en Excel, ni el visor sin sombra de luz en produccion (esa rama no esta
  mergeada; en local se vio mas fluido).
- Pendiente: lo de "Siguiente paso" y el relevo. La IP de esta maquina sigue
  autorizada en `_dev`.

### 2026-11-23: origen de las piezas del BOM, sesion unica por navegador, Excel legible

- Rama `interna-bom-origen`, sin commitear ni desplegar. `tsc` y `eslint` limpios;
  sin probar contra la base ni en el navegador.
- **Origen en el BOM:** dos columnas nuevas al final (`origen_bom`, `origen_nota`).
  Vacio o `maestro` = viene del maestro original; `agregada` = alguien la sumo a
  mano. Una fila nueva (por el boton, por editar una pieza sin fila, por
  `guardarCruces` o por `bom:agregar`) nace `agregada` con quien y cuando, y el
  cambio queda en `bom_cambios`. La ficha muestra un aviso ambar: en una pieza sin
  fila ofrece "Agregar al BOM maestro" (`agregarAlBom`); en una agregada dice que
  no viene del maestro. En el Excel sale la columna "Origen en el BOM" y la fila
  va en ambar. Las 66 filas existentes cuentan como maestro sin tocar la base.
- **Sesion unica por navegador:** `iniciarSesion` mira la sesion antes de crear
  otra. Misma cuenta: pasa de largo; otra cuenta: error `otra-sesion` (hay que
  Salir). Era una pestana con /login abierto desde antes. No limita sesiones en
  varios dispositivos.
- **Limite de intentos:** la logica pasa la prueba directa (el 6.o intento queda
  bloqueado), asi que no se encontro el fallo; los contadores ahora viven en
  `globalThis` por si Next evaluaba el modulo mas de una vez. Falta repetir la
  prueba en el navegador. Si en produccion sigue sin frenar, el siguiente paso es
  llevar el conteo a la base.
- **Excel:** ajuste de texto en todas las celdas, ancho segun el contenido (20 a
  60), filas altas segun el texto, primeras dos columnas inmovilizadas.
- Limpieza: retirado `bom:migrar`; `leerVersionBom` paso a `leerEstadoBom`.
- **Versionado basico** (no un git: `bom_cambios` ya es el registro):
  - `/historial` tiene "Restaurar" en el cambio mas reciente de cada campo
    (`restaurarCambio` en `lib/bom.ts`). Escribe un cambio nuevo a nombre de
    quien restaura; se rechaza si alguien toco el campo despues. No restaura
    `sku`, `nombre` ni el origen.
  - `/cortes` guarda una foto con nombre del BOM completo y la baja como Excel
    (`lib/bom-cortes.ts`, tabla `bom_cortes`, `/api/bom/cortes/<id>`).
  - **Antes de desplegar:** `npm run db:migrar -- --aplicar` en `_prod` crea
    `bom_cortes`. Sin ella `/cortes` avisa en vez de romperse.
- **Login en produccion (2026-11-23), causa encontrada:** una contrasena mala
  salia como "No pudimos comprobar tu acceso" (caso `servicio`) y no contaba para
  el limite de intentos. El log de ejecucion lo mostro: `Fallo al iniciar sesion
  (no es de credenciales): APIError: Invalid email or password`. Era un `APIError`
  legitimo, pero `e instanceof APIError` daba false en el build de produccion
  (dos copias del paquete); en desarrollo si funcionaba. Tambien afectaba a la
  cuenta inactiva (salia como falla del servidor en vez de "pendiente") y al
  cambio de contrasena. Arreglo: `lib/error-auth.ts` (`esErrorDeApi`, por nombre
  y estado), usado en `login/acciones.ts` y `cuenta/acciones.ts`. Regla: no usar
  `instanceof` con clases de Better Auth. Sin desplegar; repetir la prueba de 6
  contrasenas malas en produccion despues. Ya no hace falta el cambio a
  `globalThis` de `limite-acceso.ts` para esto, pero se deja: no estorba.

### 2026-11-19: "Salir" rompia la pagina en produccion

- Sintoma: al pulsar Salir en produccion, "This page couldn't load". En local
  no pasaba (el servidor de desarrollo no esta detras del proxy de Hostinger).
  Despues del primer arreglo (PR #7) seguia fallando en el navegador normal y
  funcionaba en incognito: el problema era de `/login`, no solo de Salir.
- Causa REAL (consola del navegador): `Refused to execute script ...
  /_next/static/chunks/app/login/page-<hash>.js ... MIME type text/plain` y
  `ChunkLoadError: Loading chunk 139 failed`. El HTML de /login pide 11
  chunks .js y el proxy responde 401 a todos si no hay sesion (a proposito).
  Un navegador que ya uso el panel tiene casi todos en cache (inmutables, un
  anio), los ejecuta, Next intenta hidratar /login, le falta el chunk de la
  pagina (401) y muestra el error. Incognito no tiene nada en cache, no ejecuta
  nada y por eso cargaba. Afectaba a cualquiera que hubiera usado el panel.
- Hallazgo secundario (log de ejecucion en hPanel): `failed to get redirect
  response TypeError: fetch failed` tras la accion `cerrarSesion` (el fetch
  interno con el que Next trae /login). Real, pero no era la causa de que la
  pagina se rompiera.
- Arreglo 1 (PR #7): `app/salir/route.ts` (POST, 303 a /login), `BotonSalir`
  es un formulario HTML hacia /salir, `proxy.ts` deja pasar POST /salir sin
  sesion. `cerrarSesion` se elimino. Su parte de detectar navegaciones
  internas por la cabecera `rsc` NO funciona (Next la quita antes del proxy) y
  se retiro en el arreglo 2.
- Arreglo 2: `proxy.ts` manda `Content-Security-Policy: script-src 'none'` con
  /login y /registro. El navegador no ejecuta ningun script en esas paginas,
  haya lo que haya en cache, y se comporta siempre como incognito. No abre
  ningun chunk: la proteccion de /_next/static no cambia.
- Regla: /login y /registro tienen que funcionar sin JavaScript (formulario HTML,
  sin componentes de cliente). Si algun dia necesitan JS, hay que abrir sus
  chunks en el proxy y decidirlo en un ADR. Y en interna no usar `redirect()`
  desde una accion de servidor que llame JavaScript.
- Pendiente: probar en el navegador normal que /login carga, y Salir recien
  logueado y con mas de 60 s. Falta saber como se comporta una navegacion
  interna de Next con la sesion caducada (da 401 de texto).

### 2026-11-18: base de produccion propia y mensajes de login

- El login de produccion fallaba con "contrasena incorrecta" y luego con el
  limite de intentos. Los logs de Hostinger mostraron `Invalid password` x5:
  era la contrasena, no la infraestructura. (Se sospecho de la IP, pero la IP
  solo afecta a la maquina local.)
- Se creo `u352406053_interno_prod`, se migraron sus 6 tablas, se creo la cuenta
  de Francisco con el script y se cambiaron las variables de hPanel (secreto de
  sesion nuevo: las sesiones abiertas se cerraron). Probado: `/` 307, `/login`
  200, GLB sin sesion 401 y el login real funciona.
- **Incidente, ya corregido:** el cambio de variables dejo a produccion leyendo
  un `bom_piezas` vacio, porque el BOM de la demostracion (66 piezas, 2 cambios)
  estaba en `_dev`, que era la base de produccion hasta ese momento. Se copio de
  `_dev` a `_prod` en una transaccion y se comprobo fila por fila (66 identicas).
  Las cuentas de `_dev` no se copiaron (Francisco con Gmail y una cuenta de
  prueba `prueba-temporal@example.invalid`, activa, que conviene borrar).
- Se quitaron todas las IPs autorizadas de las dos bases. Nada queda autorizado.
- `login/acciones.ts` y `login/page.tsx`: mensajes distintos para cuenta inactiva
  y para falla del servidor; solo las credenciales malas cuentan para el limite.
- Ruido conocido, sin consecuencia: cada redireccion de una accion de servidor
  deja `failed to get redirect response TypeError: fetch failed` en el log.
- Pendiente: `/registro` y `/usuarios` (decision 7), historial del BOM, pruebas
  del BOM en el navegador, `CLAUDE.md`, y decidir el correo.

### 2026-11-17: BOM en base, desplegado para la demostracion

- Commit "demostracion" a `main` (`41317e4`): BOM en `bom_piezas` y
  `bom_cambios`, scripts `bom:importar` y `bom:agregar`. Deploy en verde; sin
  sesion `/` y `/catalogo` dan 401 y `/login` 200. El login funciona en
  produccion (confirmado por Francisco).
- Se aplico en la base `_dev` (compartida con produccion): `db:migrar` (2 tablas)
  y `bom:importar` (66 filas).
- Pendiente: todo lo de "Siguiente paso". Se decidio dejarlo como notas por
  ahora, sin implementarlo.

### 2026-11-13: el login, en produccion

- El login se separo del BOM y se desplego: rama `interna-login` (commit
  `0e3e2b4`), PR #5 a `main`, deploy en verde. Produccion lee el BOM del Excel
  como antes; el BOM en base **no esta desplegado** y sigue solo en la rama
  `interna-cuentas` (sin commitear).
- Hay que rebasar `interna-cuentas` sobre `main` (ya trae el login) antes de
  seguir con el BOM. Los archivos del login son identicos, pero este documento
  y `db-migrar.ts` difieren. El arbol de trabajo auxiliar `../MXD-WEB-login` se
  puede quitar con `git worktree remove`.
- La IP publica de la maquina cambio (de 38.224.27.5 a 201.144.33.141) y la
  base rechazo la conexion: se agrego la nueva con la API de Hostinger. Si
  vuelve a fallar con `Access denied ... @'<ip>'`, es esto (ver "Trampas").
- `.env.local` tenia `BETTER_AUTH_SECRET` con el texto de ejemplo; funciona pero
  no es un secreto. Reemplazarlo en local.
- Pendiente: probar un login real en produccion, crear las cuentas del equipo,
  quitar `INTERNA_*`, y la base de produccion aparte.

### 2026-11-11 (segunda parte): BOM a la base, codigo escrito

- `bom.ts` ahora lee y escribe en `bom_piezas`; lo de Excel paso a `bom-excel.ts`.
- Historial por campo en `bom_cambios`, control de version y autor en cada
  escritura. `guardarCruces` tambien exige sesion.
- `/catalogo/[slug]` ahora es dinamica (leia el BOM en el build).
- Scripts `bom:importar` y `bom:agregar`; `db:migrar` crea las tablas del BOM.
- Verificado: `tsc` y `eslint` limpios; pruebas en seco de los tres scripts.
- NO verificado: nada contra datos reales, porque no se aplico la migracion ni la
  importacion. Pendiente: pasos 1 a 5 de "Siguiente paso".

### 2026-11-11

- Se encontro y arreglo el error de `await` de nivel superior en `db-migrar.ts` y
  `usuarios.ts`.
- Se aplico la migracion de cuentas en la base de desarrollo (4 tablas).
- Prueba de punta a punta con cuenta temporal: proxy, login, cookie, cuenta
  inactiva. Todo paso.
- Error de `Invalid URL` en la redireccion a `/login` (la prueba directa del proxy
  no lo detecto; salio al abrirlo en el navegador). Corregido con `BETTER_AUTH_URL`.
- `/login` se veia sin estilo: el proxy bloqueaba el CSS de desarrollo y el logo.
  Corregido.
- Confirmado en navegador que el login funciona y que el panel se ve normal.
- Pendiente: todo el bloque del BOM en la base de datos y el de produccion.

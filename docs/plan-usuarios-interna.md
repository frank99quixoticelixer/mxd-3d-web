# Cuentas de usuario en interna: plan y registro de avance

Documento vivo. **Quien trabaje en esto (persona o Claude) lo actualiza al
terminar cada sesion**: marca el checklist, agrega una entrada al registro del
final y corrige "Siguiente paso". Es lo primero que se lee al retomar.

- Estado: login y BOM en base **desplegados en `main`** (2026-11-17, commit
  "demostracion"). Se uso para una demostracion; lo que falta para el uso real
  esta marcado con `[ ]` y resumido en "Siguiente paso".
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
- [ ] `/login` muestra el encabezado completo con la navegacion; ocultarlo.

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
- [ ] Vista del historial de cambios (quien, cuando, campo, antes y despues).
- [ ] Retirar o actualizar `scripts/migrar-a-bom.ts` (`bom:migrar`), que genera el
      Excel desde el catalogo y ya no es el camino normal.

### Produccion

- [ ] Crear una base de datos de produccion, distinta de la `_dev`. **Hoy
      produccion usa `u352406053_interno_dev`**, la misma que local (decision
      del 2026-11-13, para una prueba): las cuentas y, cuando llegue, el BOM se
      comparten. Con la clave de desarrollo. Cambiar antes del uso real.
- [x] Variables en hPanel puestas el 2026-11-13 por la API de Hostinger (DB_*,
      `DB_HOST=127.0.0.1`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` nuevo, 32+
      caracteres). La API reemplaza el juego completo y oculta los valores: para
      cambiar una hay que mandar todas.
- [x] Las tablas de cuentas ya existian en la base (creadas desde local).
- [ ] Crear las cuentas reales del equipo (hoy solo existe la de Francisco).
- [ ] Quitar `INTERNA_USUARIO` e `INTERNA_CLAVE` de hPanel (ya no se usan; se
      conservaron para no cortar el sitio durante el deploy). Hacerlo cuando
      alguien confirme que el login funciona en el navegador.
- [x] Probado con `next build --webpack` (rama `interna-login`). `next start`
      local no se pudo por la IP; el CSS de `/login` si sale por
      `/_next/static/css/` en produccion.
- [x] Revisado `deploy-interna.yml`: sin cambios necesarios.
- [x] Comprobado en produccion (2026-11-13) sin sesion: `/` 401 (307 a `/login`
      si el cliente pide HTML), GLB, descargas, ficha PDF, BOM y `/api/auth/*`
      401, chunks JS 401, `/login`, su CSS y el logo 200, y la contrasena vieja
      ya no entra. **Falta probar un inicio de sesion real en produccion.**
- [ ] Respaldo: los respaldos de hPanel mas una exportacion periodica del BOM a
      Excel guardada fuera del servidor.

### Cierre

- [ ] Actualizar `CLAUDE.md` (la seccion "Como se protege interna" aun describe la
      autenticacion HTTP basica) y `apps/vitrina/AGENTS.md`.
- [ ] Commit por archivos (nunca `git add -A`) y PR a `main`.

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

Trabajo por hacer para dejarlo listo para uso real (notas; nada de esto esta
hecho). Hay un respaldo del Excel original en
`contenido/BOM_MX80.respaldo-antes-de-migrar-2026-11-09.xlsx`.

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

6. Cuentas reales del equipo: `npm run usuarios -- crear <correo> "<Nombre>"`
   (pide la contrasena en terminal). Hoy solo existe la de Francisco.
7. Probar un inicio de sesion real en `interno.mxddrone.com`, y despues quitar
   `INTERNA_USUARIO` e `INTERNA_CLAVE` de hPanel. La API de Hostinger reemplaza
   el juego completo de variables y oculta los valores: hay que mandar todas.
8. Base de produccion aparte de `_dev` (hoy comparten base, y el BOM de
   demostracion tambien). Implica crearla, cambiar las variables `DB_*` en hPanel
   y correr `db:migrar`, `bom:importar` y `usuarios` contra ella.
9. Respaldo: los respaldos de hPanel mas una exportacion periodica del BOM a
   Excel (`/api/bom/descargar`) guardada fuera del servidor.
10. Decidir si se corre `bom:agregar` (88 piezas del GLB v5).

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

### Comandos

```
cd apps/interna
npm run db:migrar                      # muestra que haria
npm run db:migrar -- --aplicar         # lo aplica (solo agrega, no borra)
npm run usuarios -- crear <correo> "<Nombre>"   # pide la contrasena en terminal
npm run usuarios -- listar | desactivar <correo> | activar <correo>
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

## Registro de avance

Una entrada por sesion, la mas reciente arriba. Formato: fecha, que se hizo, que
quedo pendiente.

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

# Cuentas de usuario en interna: plan y registro de avance

Documento vivo. **Quien trabaje en esto (persona o Claude) lo actualiza al
terminar cada sesion**: marca el checklist, agrega una entrada al registro del
final y corrige "Siguiente paso". Es lo primero que se lee al retomar.

- Rama: `interna-cuentas` (sin merge a `main`, sin desplegar).
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

Codigo escrito y que compila (`tsc` y `eslint` limpios). **Todavia NO se aplico
la migracion ni la importacion en la base, asi que nada de esto esta probado
contra datos reales.** Hecho en seco: `db:migrar` lista las 2 tablas por crear,
`bom:importar` lee 66 filas del Excel y `bom:agregar` ve 154 piezas en el catalogo
(es decir, 88 sin fila: las del GLB v5).

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
- [ ] **Aplicar**: `npm run db:migrar -- --aplicar`, luego
      `npm run bom:importar -- --aplicar`, luego decidir si correr `bom:agregar`.
- [ ] Probar contra la base: lectura, edicion desde la ficha, historial en
      `bom_cambios`, conflicto de version (dos navegadores), descarga del Excel
      y que el numero de filas coincida con el Excel original.
- [ ] Vista del historial de cambios (quien, cuando, campo, antes y despues).
- [ ] Retirar o actualizar `scripts/migrar-a-bom.ts` (`bom:migrar`), que genera el
      Excel desde el catalogo y ya no es el camino normal.

### Produccion

- [ ] Crear una base de datos de produccion, distinta de la `_dev`.
- [ ] Variables en hPanel: `DB_HOST=127.0.0.1`, `DB_PUERTO`, `DB_NOMBRE`,
      `DB_USUARIO`, `DB_CLAVE`, `BETTER_AUTH_SECRET` (32 caracteres o mas, distinto
      al de desarrollo), `BETTER_AUTH_URL=https://interno.mxddrone.com`.
      **Definirlas antes de que interna redespliegue**: sin ellas el sitio
      responde 503.
- [ ] Correr la migracion contra la base de produccion y crear las cuentas reales.
- [ ] Quitar `INTERNA_USUARIO` e `INTERNA_CLAVE` de hPanel (ya no se usan).
- [ ] Probar con `next build --webpack` y `next start`: que el CSS de `/login`
      pase por `/_next/static/css/`, y que `better-auth` y `mysql2` sobrevivan al
      trazado de Hostinger (ver `outputFileTracingIncludes` en
      `next.config.mjs`).
- [ ] Revisar `deploy-interna.yml`.
- [ ] Comprobar en produccion que sin sesion todo responde 401 o redirige,
      incluidos GLB y chunks.
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

Aplicar y probar el BOM en la base de desarrollo, en este orden:

1. `cd apps/interna && npm run db:migrar -- --aplicar` (crea `bom_piezas` y
   `bom_cambios`).
2. `npm run bom:importar -- --aplicar` (carga las 66 filas del Excel). Hay un
   respaldo del Excel en `contenido/BOM_MX80.respaldo-antes-de-migrar-2026-11-09.xlsx`.
3. Decidir con el equipo si se corre `npm run bom:agregar -- --aplicar` para dar
   fila a las 88 piezas del GLB v5.
4. Probar en el navegador: abrir una ficha, editar, ver el cambio en `bom_cambios`,
   y provocar un conflicto abriendo la misma ficha en dos sesiones.
5. Despues, la vista del historial.

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

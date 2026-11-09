# 0006. Interna tiene una cuenta por persona

- Fecha: 2026-11-09
- Estado: Aceptada
- Decide: Francisco

## Contexto

Interna estaba detras de una sola contrasena compartida (`INTERNA_USUARIO` e
`INTERNA_CLAVE`). CLAUDE.md lo justificaba: "para tres personas detras de HTTPS,
una contrasena compartida es la proteccion correcta por el esfuerzo que cuesta.
Cuando haya que saber QUIEN cambio cada dato, se reemplaza por cuentas".

Ese momento llego. Interna ya edita datos (el BOM, las existencias, el maestro
de partes) y con una cuenta compartida no se sabe quien hizo cada cambio ni se
puede quitar el acceso a una persona sin cambiar la contrasena de todos.
`docs/plan-usuarios-vitrina.md` ya describia dos fases: la 1 son varias cuentas
con el mismo mecanismo; la 2, login propio con sesion y base de datos.

## Decision

Se implementa la **fase 1** en interna. Cada persona tiene una entrada en
`INTERNA_USUARIOS`: `usuario:sal:hash`, con el hash de scrypt (N=16384, r=8,
p=1) de su contrasena. Se generan con `npm run hash-clave -- <usuario>`, que pide
la contrasena sin mostrarla. Alta o baja = editar la variable en hPanel y
reiniciar.

Detalles que importan (todo en `src/proxy.ts` y `src/lib/cuentas.ts`):

- **Se conserva el par antiguo como respaldo.** Si `INTERNA_USUARIOS` no esta
  definida, se sigue usando `INTERNA_USUARIO` / `INTERNA_CLAVE`: desplegar este
  codigo no cierra el sitio. Si esta definida, el par antiguo se ignora, para que
  quitar a alguien de la lista le quite el acceso de verdad.
- **Sigue cerrando si no hay configuracion** (503), tambien cuando
  `INTERNA_USUARIOS` solo trae entradas mal formadas, y el mensaje dice cual.
- **Cache de credenciales verificadas, 10 minutos.** Basic manda las
  credenciales en cada peticion (cada chunk, cada GLB) y scrypt cuesta ~50 ms a
  proposito: sin cache, una pagina serian decenas de scrypt. La clave es un
  SHA-256 de la cabecera con un secreto que nace con el proceso.
- **Limite de 10 intentos fallidos por IP cada 5 minutos** (429 sin calcular
  scrypt). Una cabecera ya rechazada cuenta una sola vez, porque un navegador
  con una contrasena vieja manda decenas de peticiones iguales y se bloquearia a
  si mismo. Quien ya entro no se ve afectado.
- Si el usuario no existe se calcula igual el scrypt, para que el tiempo de
  respuesta no delate quien existe.
- **Registro:** una linea por inicio de sesion (`[interna] acceso usuario=...`) y
  una por intento fallido. Nunca la contrasena ni el hash; el usuario solo si
  existe, porque lo que alguien teclea en "usuario" a veces es una contrasena.
- **`x-mxd-usuario`:** el proxy le dice al resto de la app quien entro. Siempre
  la sobrescribe, para que nadie se haga pasar por otro mandandola. Todavia
  nada la lee; queda lista para registrar quien cambia cada dato.

## Consecuencias

- Se sabe quien entra y se le quita el acceso a una persona sin avisar a las
  demas.
- Para entrar o salir alguien hay que tocar hPanel y reiniciar el sitio. A
  proposito: no hay base de datos. Hasta unas 10 personas conocidas es
  manejable.
- Sigue siendo autenticacion basica del navegador: **no hay cierre de sesion**,
  ni roles (todos ven y editan lo mismo), ni autoservicio, ni cambio de
  contrasena por la propia persona. Eso es la fase 2.
- Las contrasenas se normalizan (NFKC) y se leen como UTF-8, asi que funcionan
  con acentos y eñe.
- **Limite conocido del bloqueo:** es en memoria y por proceso, y se reinicia con
  cada despliegue. Si Hostinger entregara siempre la misma IP, 10 fallos de
  alguien bloquearian los inicios de sesion nuevos de todos hasta por 5
  minutos. Hay que comprobar en produccion que la IP sea la real (el mismo punto
  pendiente del ADR 0005).
- La vitrina no cambia: sigue con una sola cuenta.

## Alternativas descartadas

- **Fase 2 ya (login propio, sesion, MySQL):** 3 a 5 dias y sin necesidad
  todavia. Se pasa a ella cuando haga falta autoservicio, roles distintos o
  auditoria detallada.
- **Guardar contrasenas en claro o con un hash rapido (SHA-256):** quien lea la
  variable de entorno las obtendria. scrypt es lento a proposito.
- **Verificar con scrypt en cada peticion, sin cache:** decenas de scrypt por
  pagina cargada en un servidor compartido.
- **Mantener el par antiguo siempre valido junto a las cuentas:** quitar a
  alguien de la lista no le quitaria el acceso si conoce la contrasena vieja.

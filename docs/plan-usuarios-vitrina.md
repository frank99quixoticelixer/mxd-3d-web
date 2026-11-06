# Plan: varios usuarios en la vitrina

Estado actual: una sola cuenta compartida (autenticacion HTTP basica en
`apps/vitrina/src/proxy.ts`), con `VITRINA_USUARIO` y `VITRINA_CLAVE` en las
variables de entorno de hPanel. La contrasena no va en el repo (es publico).

Limite de esto: no se sabe quien entro, y para quitarle el acceso a una persona
hay que cambiar la contrasena de todos.

## Fase 1 - varias cuentas con el mismo mecanismo (1 dia)

Una variable `VITRINA_USUARIOS` con una lista `usuario:hash` (un hash por
cuenta, nunca la contrasena en claro). El proxy compara contra todas.

- Sin base de datos y sin sesiones: el navegador sigue usando el cuadro basico.
- Alta o baja de una persona = editar la variable en hPanel y reiniciar.
- Hashes con scrypt (`node:crypto`); un script `npm run hash-clave` los genera.
- Se conserva el comportamiento de cerrar si no hay configuracion (503).
- Registro minimo: el proxy escribe en el log el usuario y la ruta, para saber
  quien entra.

Cuando alcanza: hasta unas 10 personas conocidas, sin autoservicio.

## Fase 2 - cuentas reales con sesion (3 a 5 dias)

Pagina de inicio de sesion propia, cookie de sesion firmada y usuarios en base
de datos (Hostinger incluye MySQL; el proyecto ya preve una base en "Fase 2").

- Libreria: Auth.js (credenciales) o sesion propia con `jose` para la cookie.
- Tabla `usuarios`: correo, hash, rol, activo, ultimo acceso.
- Roles minimos: `visor` (ve la vitrina) y `admin` (da de alta y baja).
- Pantalla de administracion para crear, desactivar y reiniciar contrasenas.
- Limite de intentos por IP y por cuenta, y cookie `httpOnly`, `secure`.
- Registro de accesos por persona.
- Interna y pedidos podrian reutilizar las mismas cuentas con roles propios.

## Recomendacion

Hacer la fase 1 ya (es barata y cubre "varios usuarios"). Pasar a la fase 2
solo cuando se necesite autoservicio, roles distintos o auditoria por persona.

## Decisiones que hay que tomar antes

1. Cuantas personas y quienes (equipo, clientes, inversionistas).
2. Si todas ven lo mismo o hay niveles de acceso.
3. Si hace falta saber quien vio que (registro de accesos).
4. Si las cuentas se comparten con interna y pedidos.

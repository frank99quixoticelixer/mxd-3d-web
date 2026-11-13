# 0006. Interna pasa de una contrasena compartida a cuentas individuales

- Fecha: 2026-11-10
- Estado: Propuesta
- Decide: por confirmar (el equipo)

## Contexto

Interna entra hoy por autenticacion HTTP basica con una sola contrasena
(`INTERNA_USUARIO` / `INTERNA_CLAVE`). SEGURIDAD.md seccion 6 dice que esto es
correcto para tres personas y que se reemplaza por cuentas individuales cuando
haga falta saber quien cambio cada dato, con un ADR antes.

Ya hace falta:

- seran alrededor de 6 personas y van a ser mas;
- todas pueden descargar los GLB/STL y editar los campos del BOM;
- una contrasena compartida no dice quien edito que, y quitarle el acceso a
  una persona obliga a cambiarla para todos;
- el BOM vive en `contenido/BOM_MX80.xlsx`, un archivo dentro del despliegue:
  una edicion puede perderse en el siguiente deploy y dos personas editando a
  la vez se pisan.

El plan completo esta en [plan-usuarios-interna.md](../../plan-usuarios-interna.md).

## Decision

1. **Cuentas individuales con correo y contrasena y sesion por cookie**, con
   [Better Auth](https://www.better-auth.com), sobre la base MySQL que incluye
   Hostinger. Las altas las hace el equipo con un script; no hay registro
   publico.
2. **Todos los usuarios activos tienen los mismos privilegios.** No hay roles.
3. **El BOM pasa a la base de datos**, con historial de cada cambio (quien,
   cuando, valor anterior y nuevo). El Excel se genera desde la base.
4. `proxy.ts` sigue siendo la puerta de todo (paginas, `/api`, `/models`,
   `/renders` y `/_next/static`): sin sesion valida redirige a `/login` o
   responde 401. Se conserva el cierre ante configuracion faltante (503).

## Consecuencias

- Aparece una dependencia con estado: la base de datos. Si cae, nadie entra.
  Se respalda (hPanel) y el BOM se exporta a Excel periodicamente.
- Baja de una persona = marcarla inactiva. Surte efecto en cuanto vence la
  cache de sesion de su navegador (60 segundos).
- Ya no se usan `INTERNA_USUARIO` ni `INTERNA_CLAVE`. Hay variables nuevas
  (`DB_*`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`); sin ellas el sitio
  responde 503.
- El limite de intentos de inicio de sesion es en memoria (por IP y correo):
  se reinicia con cada despliegue y cada proceso lleva el suyo, igual que el
  de ADR 0005.
- La pagina de acceso necesita CSS sin sesion, asi que `/_next/static/css/`
  queda abierto. No lleva datos del catalogo; los chunks JavaScript siguen
  cerrados.
- Para volver a la contrasena compartida basta restaurar el `proxy.ts` anterior.

## Alternativas descartadas

- **Varias cuentas con autenticacion basica** (`INTERNA_USUARIOS` con hashes):
  no escala a mas personas ni dice quien edito.
- **Auth.js (NextAuth v5):** sigue en beta y en mantenimiento solo de
  seguridad; su equipo paso al de Better Auth.
- **Sesion propia con `jose`:** mas codigo de seguridad nuestro por mantener.
- **Enlace por correo en lugar de contrasena:** depende de que el SMTP de
  Hostinger entregue bien. Se puede agregar despues sin cambiar las tablas.

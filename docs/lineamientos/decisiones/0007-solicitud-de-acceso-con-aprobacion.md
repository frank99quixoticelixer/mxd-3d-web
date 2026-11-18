# 0007. El acceso a interna se solicita en la pagina y lo aprueba un administrador

- Fecha: 2026-11-18
- Estado: Propuesta
- Decide: Francisco y Axel (administradores)

## Contexto

El ADR 0006 dejo las altas en manos del equipo con un script
(`npm run usuarios -- crear`) y dijo "no hay registro publico". Con varias
personas por incorporar, eso obliga a que alguien con terminal, la clave de la
base y la IP autorizada cree cada cuenta.

Un registro abierto no sirve: interna guarda proveedores, numeros de parte,
precios y existencias, y quien se registre entraria a verlos.

## Decision

1. **Solicitud de acceso en `/registro`.** Formulario publico: nombre, empresa,
   correo y la contrasena que la persona elige. La cuenta se crea **inactiva**
   (`activo = 0`): con la contrasena correcta no entra, y el login le dice que
   su cuenta aun no esta activa (ADR 0006: el hook de sesion ya lo impide).
2. **Un administrador la aprueba en `/usuarios`.** Ve las solicitudes
   pendientes con sus datos, y las aprueba o las rechaza. Tambien desactiva
   cuentas, las borra (solo inactivas) y da o quita la marca de administrador.
   Un administrador puede quitarle el acceso a otro; no a si mismo ni al ultimo.
3. **Cada cuenta tiene un `estado`** (`pendiente`, `activa`, `rechazada`,
   `baja`) que solo informa; quien manda para entrar sigue siendo `activo`. El
   login, cuando la contrasena es correcta pero la cuenta no esta activa, dice
   cual es: en revision, rechazada (puede volver a solicitar) o dada de baja.
   Una solicitud rechazada **se conserva**: si la persona vuelve a solicitar con
   el mismo correo, se reabre como pendiente con los datos y la contrasena
   nuevos. Una pendiente, activa o de baja no se toca desde `/registro`.
4. **Administradores:** una marca `esAdmin` en la tabla `user`. Solo los scripts
   del equipo y otros administradores la cambian. Los demas privilegios siguen
   iguales para todos (ADR 0006, punto 2). Los primeros administradores son
   Francisco y Axel.
5. **La ruta de registro de Better Auth sigue cerrada** (`disableSignUp`, y
   `/api/auth/*` no se monta). La cuenta la crea una accion de servidor con el
   adaptador interno, igual que el script, para que ningun campo (`activo`,
   `esAdmin`) lo pueda fijar quien llena el formulario.
6. **No se manda ninguna contrasena por correo.** Cada persona elige la suya al
   solicitar. El correo (avisar la aprobacion, recuperar contrasenas) queda para
   despues y no cambia las tablas.

## Consecuencias

- `/registro` es publico: su pagina y su accion pasan por `proxy.ts` sin sesion.
  Es la unica superficie nueva abierta, y escribe en la base. Se acota con:
  limite de solicitudes por IP (en memoria, igual que el de inicio de sesion),
  un tope de solicitudes pendientes, un campo trampa contra bots, y largos
  maximos en todos los campos.
- **El correo no se verifica.** Alguien puede solicitar con un correo ajeno. Lo
  que protege es que un administrador decide: aprobar solo a quien reconozca o
  confirme por otro medio. Se verifica de verdad cuando haya correo.
- La respuesta del formulario es la misma exista o no el correo, para no
  revelar quien tiene cuenta. Una solicitud con un correo ya registrado no
  cambia nada.
- Hay datos personales (nombre, empresa, correo). El formulario trae un aviso
  corto de para que se usan. Una solicitud rechazada se conserva para poder
  decirle a la persona que fue rechazada; un administrador la borra a peticion
  (`/usuarios`, "Borrar").
- Antes de desplegar hay que agregar las columnas `esAdmin`, `empresa` y
  `estado` a `user` (`npm run db:migrar -- --aplicar`, solo agrega) y marcar a los
  primeros administradores; sin eso el codigo nuevo falla al leer la tabla.
- Si un administrador se desactiva a si mismo o quita al ultimo administrador,
  nadie podria entrar a `/usuarios`: la accion lo impide.

## Alternativas descartadas

- **Registro abierto con acceso inmediato:** expone el BOM a cualquiera.
- **Contrasena aleatoria por correo al aprobar:** exige contratar y configurar
  correo antes de poder usar nada, y obliga a una pagina de cambio de
  contrasena obligatoria. Se puede sumar despues.
- **Seguir solo con el script:** cada alta depende de una persona con terminal,
  credenciales de la base y la IP autorizada.

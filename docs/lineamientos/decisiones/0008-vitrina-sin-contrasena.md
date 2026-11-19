# 0008. La vitrina se abre sin contrasena

- Fecha: 2026-11-19
- Estado: Aceptada (por ahora)
- Decide: Francisco

## Contexto

La vitrina (mxddrone.com) estaba detras de autenticacion HTTP basica con una
contrasena compartida (`src/proxy.ts`, `VITRINA_USUARIO` y `VITRINA_CLAVE`),
puesta mientras el sitio estaba en desarrollo. El plan era moverla a cuentas
individuales con aprobacion, como interna (ADR 0006 y 0007).

Se decidio quitar la contrasena por ahora y dejar las cuentas para despues.
La vitrina es material de venta: es el sitio publico, y la contrasena
compartida nunca fue su estado final.

## Decision

1. Se elimina `apps/vitrina/src/proxy.ts`. Nada pide credenciales en la vitrina.
2. Las variables `VITRINA_USUARIO` y `VITRINA_CLAVE` ya no se leen. Pueden
   borrarse de hPanel; dejarlas no hace dano.
3. El deploy ya aceptaba un 200 en `/` (`deploy-vitrina.yml`), no cambia.
4. Interna no cambia: sigue detras de cuentas (ADR 0006 y 0007).

## Lo que protege los datos, ahora que la contrasena no esta

La contrasena nunca fue lo que separa lo publico de lo interno. Lo que lo
separa es la frontera de datos (CLAUDE.md, "Como se protege la vitrina"):

- `lib/publico.ts` recorta cada pieza a una lista de lo que SI sale, y se aplica
  en `lib/catalogo.ts`, la unica puerta al catalogo. Proveedores, numeros de
  parte, cotas, precios y existencias no existen en lo que llega al navegador.
- Las fichas tecnicas en PDF y las descargas GLB/STL no existen en la vitrina.
- La comprobacion con un valor centinela (`grep -rl CENTINELA .next/static
  .next/server/app`) debe dar cero archivos.

## Lo que SI se pierde

- **El modelo 3D es descargable por cualquiera.** El visor tiene que pedir el
  GLB para funcionar, y sin sesion no hay forma de distinguir a quien lo ve de
  quien lo baja. Lo que queda (ADR 0005) frena el uso casual, no a quien quiera
  el archivo: limite de 30 GLB por minuto por IP, `Cache-Control: private` y 403
  a la navegacion directa. Si el modelo es propiedad intelectual que no debe
  salir, esa es la razon para volver a ponerle cuentas a la vitrina o para
  servir una version simplificada.
- **Los renders (`/renders`) tambien son publicos**, con su limite por IP.
- El ADR 0005 y la nota de CLAUDE.md dicen que estas rutas "pasan por la
  contrasena". Eso sigue siendo cierto en interna y ya no en la vitrina.
- Se pierde el filtro de "quien conoce la clave": cualquier visitante y los
  buscadores pueden ver el sitio. Si no se quiere que se indexe, hace falta
  `robots`/`noindex`, que este ADR no agrega.

## Alternativas descartadas

- **Dejar la contrasena compartida:** fue lo que se pidio quitar.
- **Cuentas con aprobacion ahora (copiar interna):** es la ruta del plan, pero
  requiere base de datos propia de la vitrina y se decidio hacerla despues. Si
  se retoma: base separada de la de interna, para que un cliente aprobado en
  vitrina no pueda entrar a interna.

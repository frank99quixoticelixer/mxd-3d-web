# Seguridad

Basado en OWASP Top 10 y en el nivel 1 de OWASP ASVS (ver
[REFERENCIAS.md](REFERENCIAS.md)), aterrizado a lo que este repo es: tres
sitios Next.js en hosting compartido, sin base de datos y con un catalogo en
codigo.

## 1. La frontera de datos

Es la regla que mas importa en este repo.

- **Todo lo que recibe un componente de cliente es publico.** Viaja
  serializado en el HTML y en los archivos `.rsc`, aunque la interfaz no lo
  muestre. Esconder un boton no esconde un dato.
- **Los chunks de `/_next/static` son publicos.** Cualquiera los pide por URL.
  Un modulo de datos importado desde un componente de cliente queda publicado
  completo.
- **El recorte es por lista de lo que si sale** (`lib/publico.ts`), nunca por
  lista de lo que se quita. Un campo nuevo queda fuera por omision.
- **Un componente de cliente no importa `lib/catalogo`.** Recibe por props
  solo los campos que usa. Ejemplos: `FichaEnlace` en el visor (sku, slug,
  nombre) y `SubpiezaVisor` en la ficha.
- **Ni los nombres de los campos internos.** Pasar la pieza entera, aunque
  recortada, publicaba `"precio_mxn":null`. Se pasa un objeto con solo lo
  que se usa.

Comprobacion obligatoria al tocar datos, props de componentes de cliente o el
esquema:

```
cd apps/vitrina
npm run build
grep -rl -e numeroBom -e parte_proveedor -e precio_mxn .next/static .next/server/app
# debe devolver cero archivos
```

Para un valor nuevo, sembrar un CENTINELA en `src/data/especificaciones-mx80.json`
y buscarlo igual (procedimiento en CLAUDE.md).

## 2. Superficie expuesta

- **Cada ruta de API que no se usa se borra.** Una ruta "de respaldo" es
  codigo que nadie revisa y que si responde.
- Una ruta que lee archivos valida tres cosas: el formato del parametro (lista
  cerrada o regex), la extension, y que la ruta resuelta quede dentro de la
  carpeta permitida (sin `../`).
- Nunca se sirven archivos de fabricacion (`.blend`, `.step`, `.stp`) desde
  ninguna app publica.

## 3. Cabeceras

Definidas en `next.config.mjs` de cada app:

| Cabecera | Valor | Para que |
|----------|-------|----------|
| `X-Content-Type-Options` | `nosniff` | El navegador no adivina tipos de archivo |
| `X-Frame-Options` | `DENY` | Nadie mete el sitio en un iframe (clickjacking) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No filtrar rutas completas a otros sitios |
| `Permissions-Policy` | camara, microfono, ubicacion y pago apagados | El sitio no los necesita |
| `Strict-Transport-Security` | `max-age=31536000` | Solo HTTPS |
| `Content-Security-Policy` | ver config | Que scripts, estilos y conexiones se permiten |
| `X-Powered-By` | apagada (`poweredByHeader: false`) | No anunciar el framework |

La CSP de vitrina esta en modo `Report-Only`. Pasa a obligatoria cuando la
consola del navegador quede limpia en inicio, catalogo y ficha.

## 4. Secretos y configuracion

- Nada secreto en el repo: claves, contrasenas, tokens ni IP de la red local.
  Van en `.env.local` (ignorado por git) o en las variables de hPanel.
- Las variables se leen en tiempo de ejecucion cuando cambiarlas no debe
  exigir reconstruir (ver `apps/interna/src/proxy.ts`).
- Ante una configuracion faltante, se falla cerrado: interna responde 503 sin
  credenciales, no se abre.
- Una variable `NEXT_PUBLIC_*` es publica: termina en el bundle.

## 5. Dependencias

- Antes de agregar una dependencia: que se mantenga activamente, que no
  duplique algo que ya hay y que se use en mas de un lugar.
- Las dependencias sin uso se quitan, cada una en su propio commit, porque
  regenerar el `package-lock.json` cambia la entrada del build.
- `npm audit` antes de cada release. Lo `high` y lo `critical` se resuelven o
  se documenta por que no aplica.
- Los recursos de terceros en tiempo de ejecucion (por ejemplo el
  decodificador Draco de gstatic) se sirven desde el propio sitio cuando se
  pueda.

## 6. Autenticacion (interna)

- Autenticacion basica sobre todo, incluidos estaticos y API, y solo sobre
  HTTPS.
- Es la proteccion correcta para tres personas. Cuando haga falta saber quien
  cambio cada dato, se reemplaza por cuentas individuales; eso se registra en
  un ADR antes de hacerlo.

## 7. Datos personales (pedidos)

- Solo se pide lo necesario para atender el pedido.
- Aviso de privacidad visible antes de enviar (LFPDPPP, Mexico).
- Los formularios llevan proteccion contra spam y limite de envios.

## 8. Revision de seguridad de un PR

- [ ] Ningun componente de cliente nuevo importa datos del catalogo
- [ ] Las props nuevas de componentes de cliente llevan solo campos publicos
- [ ] Prueba centinela o grep de campos internos en cero
- [ ] No hay secretos, IP ni credenciales en el diff
- [ ] Las rutas de API nuevas validan su entrada
- [ ] Las cabeceras siguen presentes (`curl -I` contra `npm run start`)

## 9. Reportar una falla

Si alguien del equipo encuentra un dato interno publicado o una ruta abierta:

1. Avisar en el canal del equipo de inmediato, sin esperar al checkpoint.
2. Si el dato es sensible (proveedores, precios), se corrige y se despliega
   antes que cualquier otra tarea.
3. Despues, un ADR o una nota en este archivo con la causa, para que no se
   repita.

# Desarrollo web

## 1. Servidor y cliente

- Por omision todo es componente de servidor. `"use client"` solo donde hay
  interaccion, estado del navegador o three.js.
- Los datos se leen en el servidor y bajan por props, recortados a lo que el
  componente usa (ver [SEGURIDAD.md](SEGURIDAD.md)).
- three.js se carga con `dynamic(..., { ssr: false })`: no corre en el
  servidor y asi no pesa en la carga inicial de quien no abre el visor.
- Next 16 cambio convenciones (`proxy.ts` en vez de `middleware.ts`, entre
  otras). Antes de usar una API de Next se revisa
  `node_modules/next/dist/docs/` de la app.

## 2. Estado en la URL

Lo que el usuario querria compartir o recuperar con el boton Atras va en la
URL, no solo en memoria. En el visor: `?zona=brazo-cw&pieza=motor`, y
`?sku=MX80-007` para llegar desde una ficha. El estado de Zustand manda y la
URL lo sigue (ver `features/viewer/VisorFrame.tsx`).

## 3. Rendimiento

Metas (Core Web Vitals, medido en movil con 4G):

| Metrica | Meta |
|---------|------|
| LCP (carga del contenido principal) | < 2.5 s |
| INP (respuesta a una interaccion) | < 200 ms |
| CLS (saltos de diseno) | < 0.1 |

- GLB comprimidos (meshopt o Draco) y optimizados con `npm run glb:optimizar`.
  Meta: el ensamble principal por debajo de 10 MB.
- Un GLB nuevo sube de version en el nombre (`_v2`). Asi se podra cachear como
  inmutable.
- Imagenes con `next/image` y tamano declarado, para que no salte el diseno.
- Nada de trabajo pesado en el render de React: lo que corre cada cuadro va en
  `useFrame` y lee refs, no estado.

## 4. Accesibilidad (WCAG 2.2 AA)

- Todo lo que se puede hacer con el mouse en el lienzo 3D tambien se puede
  hacer fuera de el con teclado. Ejemplo: la lista de zonas y piezas junto al
  visor.
- Botones con texto o `aria-label`. Estados con `aria-pressed` o
  `aria-current`.
- Contraste minimo 4.5:1 en texto normal. El gris de apoyo no baja de eso
  sobre blanco.
- El foco siempre visible (`focus-visible`).
- Si el 3D falla (sin WebGL, GLB roto), sale un mensaje y el resto de la
  pagina sigue funcionando (`LimiteError`).

## 5. Visor 3D

- **Mundo contra local.** Una direccion o distancia medida en el mundo
  (`Box3.setFromObject`, `getWorldPosition`) se pasa al espacio del padre
  antes de sumarla a `position`. El GLB del MX80 trae padres con escala 106
  (tren) y 0.376 (brazo); ignorarlo manda piezas fuera del cuadro.
- Los nombres de nodo del GLB son contrato con el codigo:
  `OBJETOS_POR_ZONA` en `EscenaFrame.tsx` y las expresiones de
  `componentes.ts`. Al cambiar el GLB se revisa que sigan existiendo (ver
  CLAUDE.md, "Como agregar o actualizar un GLB").
- Hover y clic salen de la misma funcion (`objetivoDe`), para que no puedan
  apuntar a cosas distintas.
- En pantallas tactiles no hay hover: ninguna accion puede depender de haber
  pasado el cursor antes.
- `prepararMateriales` clona por malla. Resaltar se hace sobre esos clones,
  nunca sobre el material del cache de `useGLTF`.
- Los GLB son binarios: `.gitattributes` los marca `-text`, y
  `npm run glb:validar` revisa que esten enteros. Un GLB truncado no avisa en
  el build; solo aparece en la consola del navegador como "Invalid typed array
  length" y el visor en blanco.

## 6. Codigo

- TypeScript estricto. Sin `any`; si hace falta, `unknown` y se valida.
- Datos externos validados con Zod en la frontera (`lib/catalogo.ts`).
- Comentarios que explican **por que**, no que hace la linea. Cuando algo se
  arreglo, el comentario dice que fallaba antes.
- Nombres en espanol, sin acentos en identificadores. Slugs en kebab-case.
- Sin emojis en interfaz ni en documentos.
- Cero errores de `npm run typecheck` y `npm run lint`. Los avisos nuevos se
  resuelven; los existentes no se multiplican.

## 7. Verificacion antes de decir "listo"

```
npm run typecheck
npm run lint
npm run build
```

Ademas, para cambios visibles: probarlo en el navegador (escritorio y
celular) con `npm run dev`. Para cambios de datos: la prueba centinela de
[SEGURIDAD.md](SEGURIDAD.md).

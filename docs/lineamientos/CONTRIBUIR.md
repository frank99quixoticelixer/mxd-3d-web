# Contribuir

## Ramas

- `main` es produccion: cada merge despliega en Hostinger.
- Se trabaja en una rama por tema (`vitrina-visor-catalogo`,
  `pedidos-formulario`). Nombre en kebab-case, sin acentos.
- Una rama vive poco. Si pasa de una semana, se parte.

## Commits

- **Nunca `git add -A` ni `git add .`.** Se stagea por archivo o carpeta y se
  revisa `git status --short` antes de cada commit.
- Mensaje en espanol, en presente, que diga que cambia para el usuario o para
  el equipo: "Agrega la lista de piezas al visor", no "fix".
- Si implementa un requerimiento, lo nombra: `(vitrina RF-05)`. Ver
  `requerimientos/`.
- Los GLB siguen el flujo de CLAUDE.md (sin LFS, nombre versionado).
- Una dependencia que se agrega o se quita va en su propio commit.

## Pull request

La descripcion dice:

1. Que cambia y por que (enlace al requerimiento o al ADR).
2. Como se probo: comandos corridos y que se vio en el navegador.
3. Riesgos: que podria romperse en produccion.

### Lista de revision

- [ ] `npm run typecheck`, `npm run lint` y `npm run build` sin errores
- [ ] Revision de seguridad de [SEGURIDAD.md](SEGURIDAD.md), seccion 8
- [ ] Probado en el navegador, escritorio y celular, si cambia algo visible
- [ ] Documentacion al dia: CLAUDE.md, lineamientos o ADR si cambio una regla
- [ ] Estado del requerimiento actualizado en `requerimientos/`
- [ ] Sin archivos ajenos al cambio en el diff

## Definicion de listo

Un cambio esta listo cuando:

- cumple sus criterios de aceptacion (seccion 9 del documento de
  requerimientos de la app),
- paso la lista de revision,
- esta mergeado a `main` y se vio funcionando en el dominio real.

"Funciona en mi maquina" no es listo.

## Checkpoint semanal

- Demo en el sitio desplegado, no en local.
- Se revisan las preguntas abiertas de los requerimientos y se deciden dos o
  tres.
- Lo que se decide y cambia una regla se registra como ADR.

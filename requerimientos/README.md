# Requerimientos

Una especificacion por app:

| Archivo | App |
|---------|-----|
| `requerimientos-vitrina.docx` | mxddrone.com |
| `requerimientos-interna.docx` | interno.mxddrone.com |
| `requerimientos-pedidos.docx` | pedidos.mxddrone.com |

## Niveles

Cada documento va de lo general a lo concreto, y cada requerimiento dice de
cual deriva:

| Prefijo | Nivel | Pregunta |
|---------|-------|----------|
| RAN | Alto nivel | Que necesita lograr el negocio o el usuario |
| RS | Sistema | Que debe ser el sistema: plataforma, componentes, datos, interfaces |
| RF | Funcional | Que hace el sistema, observable por el usuario |
| RNF | No funcional | Que tan bien lo hace, y como se comprueba |
| RBN | Bajo nivel | Como se implementa, atado a un archivo del repo |

Prioridad MoSCoW: Debe, Deberia, Podria, No por ahora.
Estado: Hecho, Hecho en rama, Parcial, Pendiente, Por definir.

## Reglas

- Los IDs no se reutilizan. Un requerimiento que se descarta se marca como
  descartado, no se borra ni se renumera.
- Un commit o PR que implementa un requerimiento lo nombra en el mensaje:
  `Agrega busqueda por numero de parte (interna RF-11)`.
- Si un cambio de codigo contradice un RBN, el documento se actualiza en el
  mismo PR.
- Las preguntas abiertas (seccion 10) se revisan en el checkpoint semanal.
  Al decidir una, se actualizan los requerimientos que dependen de ella y se
  sube la version del documento.

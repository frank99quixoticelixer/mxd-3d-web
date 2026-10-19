# Registro de decisiones (ADR)

Una decision por archivo, numerada y que no se borra. Si una decision se
revierte, se escribe otra que la reemplaza y se marca la vieja como
"Reemplazada por NNNN".

Se escribe un ADR cuando la decision:

- cambia una regla de los lineamientos,
- quita o agrega una funcion visible,
- es dificil de deshacer (estructura del repo, despliegue, datos),
- o alguien va a preguntar "por que se hizo asi" en seis meses.

| # | Decision | Estado |
|---|----------|--------|
| [0001](0001-retirar-explorador.md) | Retirar el explorador 3D de la vitrina | Aceptada |
| [0002](0002-vista-del-visor-en-la-url.md) | La vista del visor vive en la URL | Aceptada |
| [0003](0003-descargas-solo-en-interna.md) | Las descargas de modelos 3D son solo de interna | Aceptada |
| [0004](0004-un-solo-glb.md) | Un solo GLB para todo lo que se muestra | Aceptada |

Plantilla: [plantilla.md](plantilla.md).

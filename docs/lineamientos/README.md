# Lineamientos de desarrollo

Reglas que sigue todo cambio en este repo, lo haga una persona o un agente.
CLAUDE.md las referencia, asi que cualquier sesion de Claude Code las carga.

| Documento | Que cubre |
|-----------|-----------|
| [SEGURIDAD.md](SEGURIDAD.md) | Frontera de datos, cabeceras, secretos, dependencias, como reportar una falla |
| [DESARROLLO-WEB.md](DESARROLLO-WEB.md) | Arquitectura servidor/cliente, rendimiento, accesibilidad, visor 3D, estilo de codigo |
| [CONTRIBUIR.md](CONTRIBUIR.md) | Ramas, commits, revision de PR y definicion de listo |
| [REFERENCIAS.md](REFERENCIAS.md) | Estandares externos (OWASP, WCAG, Core Web Vitals) y que tomar de cada uno |
| [decisiones/](decisiones/) | Registro de decisiones de arquitectura (ADR): que se decidio y por que |

## Orden de prioridad

Cuando dos reglas chocan, gana la de arriba:

1. **Seguridad de los datos.** Un dato interno nunca llega al navegador de la
   vitrina, aunque eso cueste una funcion.
2. **Que funcione en produccion.** Hostinger tiene restricciones propias
   (webpack, sin LFS, zip aislado por app). Algo que solo corre en local no
   esta hecho.
3. **Accesibilidad y rendimiento.** El sitio lo usan clientes en campo, en
   celular y con mala senal.
4. **Mantenibilidad.** Codigo que el equipo de tres pueda entender en seis
   meses.

## Como se actualizan

- Un lineamiento nuevo o cambiado entra por PR, igual que el codigo.
- Si una decision cambia una regla, se escribe primero el ADR en
  `decisiones/` y despues se ajusta el lineamiento que corresponda.
- Si el codigo contradice un lineamiento, se corrige uno de los dos en el
  mismo PR. No se deja la contradiccion.

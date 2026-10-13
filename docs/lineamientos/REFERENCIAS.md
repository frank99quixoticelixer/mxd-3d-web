# Referencias externas

Estandares en los que se basan los lineamientos. No se copian aqui: se enlazan
y se dice que tomar de cada uno.

| Estandar | Enlace | Que tomamos |
|----------|--------|-------------|
| OWASP Top 10 | https://owasp.org/www-project-top-ten/ | Las categorias de riesgo con que se revisa cada PR. Las que mas aplican aqui: control de acceso roto (interna), exposicion de datos (vitrina), mala configuracion (cabeceras) y componentes vulnerables (dependencias). |
| OWASP ASVS | https://owasp.org/www-project-application-security-verification-standard/ | Nivel 1 como lista de verificacion minima. Nivel 2 para pedidos cuando maneje datos de clientes. |
| OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ | Valores recomendados para las cabeceras de [SEGURIDAD.md](SEGURIDAD.md). |
| OWASP Cheat Sheet Series | https://cheatsheetseries.owasp.org/ | Guias puntuales: CSP, validacion de entrada, subida de archivos, autenticacion. |
| MDN, Content Security Policy | https://developer.mozilla.org/docs/Web/HTTP/CSP | Como escribir y depurar la CSP. |
| Next.js, guias de seguridad | `apps/vitrina/node_modules/next/dist/docs/01-app/02-guides/` | `content-security-policy.md` y las guias de datos. Es la version instalada, mas fiable que la web para Next 16. |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Nivel AA como meta de accesibilidad. |
| Core Web Vitals | https://web.dev/articles/vitals | Metas de LCP, INP y CLS de [DESARROLLO-WEB.md](DESARROLLO-WEB.md). |
| glTF Transform | https://gltf-transform.dev/ | Optimizacion de GLB (`npm run glb:optimizar`). |
| ADR (Michael Nygard) | https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions | Formato del registro de decisiones. |
| LFPDPPP | https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf | Datos personales de clientes en pedidos. |

## Herramientas

- **Lighthouse** (en Chrome DevTools): rendimiento, accesibilidad y buenas
  practicas por pagina.
- **securityheaders.com**: revisa las cabeceras de un dominio desplegado.
- **`npm audit`**: dependencias con vulnerabilidades conocidas.

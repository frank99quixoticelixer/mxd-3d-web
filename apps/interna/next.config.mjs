const esDesarrollo = process.env.NODE_ENV === "development";

/**
 * Politica de contenido. La misma de la vitrina (ver su next.config.mjs para
 * el porque de cada entrada), en Report-Only mientras se comprueba en el
 * navegador que no bloquea el visor ni las fichas PDF.
 */
const politicaContenido = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${esDesarrollo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob: data: https://www.gstatic.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Archivos que las fichas PDF leen del disco en tiempo de ejecucion y que el
 * trazado de Next no detecta solo.
 *
 * Hostinger no instala node_modules completo: copia lo que Next marca como
 * usado. pdfkit carga sus fuentes estandar (Helvetica, Courier...) y su perfil
 * de color con rutas armadas en tiempo de ejecucion, asi que quedaban fuera y
 * las fichas fallaban con "Cannot find module .../standard-fonts/Helvetica.cjs"
 * en produccion, aunque en local funcionaban.
 */
const ARCHIVOS_FICHA_PDF = [
  "./public/brand/logo-mxd.png",
  "./public/renders/**",
  "./node_modules/pdfkit/js/standard-fonts/**/*.cjs",
  "./node_modules/pdfkit/js/data/*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // No anunciar el framework en cada respuesta.
  poweredByHeader: false,

  // @react-pdf/renderer usa streams y Buffer de Node.js internamente.
  // Si webpack intenta empaquetarlo lo rompe; hay que dejarlo como modulo
  // externo para que Next.js lo cargue directamente desde node_modules.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Origenes de la red local que pueden abrir el servidor de desarrollo
  // (probar en el celular). Van en .env.local, separados por coma, para no
  // dejar las IP del equipo en el repo.
  allowedDevOrigins: (process.env.IP_LAN ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),

  outputFileTracingIncludes: {
    // Las descargas se leen del disco en cada peticion (ver su route.ts).
    "/api/descargas/**": ["./descargas/**"],
    // Las claves son globs (picomatch): "[sku]" se leeria como clase de
    // caracteres y no coincidiria con la ruta, por eso va "**".
    "/api/ficha/**": ARCHIVOS_FICHA_PDF,
  },

  async redirects() {
    return [
      // El explorador 3D se retiro (ADR 0001): el visor de la portada hace lo mismo.
      { source: "/explorador", destination: "/", permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          // Panel interno: ningun buscador lo indexa aunque encuentre el dominio.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy-Report-Only", value: politicaContenido },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

const esDesarrollo = process.env.NODE_ENV === "development";

/**
 * Politica de contenido de la vitrina.
 *
 * Va como Report-Only mientras se comprueba en el navegador que no bloquea
 * nada del visor: las violaciones salen en la consola sin romper la pagina.
 * Cuando la consola este limpia en inicio, catalogo y ficha, se cambia la
 * clave a "Content-Security-Policy".
 *
 * - gstatic.com: drei descarga de ahi el decodificador Draco de los GLB. Si se
 *   sirve desde public/draco/, esa entrada sobra.
 * - blob: en worker-src: el decodificador corre en un worker creado de un blob.
 * - wasm-unsafe-eval: el decodificador Draco es WebAssembly.
 * - unsafe-inline en script-src: Next mete scripts en linea para hidratar. La
 *   alternativa son nonces, que obligan a renderizar cada pagina por peticion.
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // No anunciar el framework en cada respuesta.
  poweredByHeader: false,

  // Origenes de la red local que pueden abrir el servidor de desarrollo
  // (probar en el celular). Se definen en .env.local, separados por coma, para
  // no dejar las IP del equipo en el repo.
  allowedDevOrigins: (process.env.IP_LAN ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),

  async redirects() {
    return [
      // El explorador 3D se retiro: el visor de la portada hace lo mismo.
      // Temporal y no permanente por si vuelve con otra forma.
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
          { key: "Content-Security-Policy-Report-Only", value: politicaContenido },
        ],
      },
    ];
  },

  /**
   * Los GLB y los renders ya no son estaticos de public/: los entregan las
   * rutas /api/modelos y /api/renders desde protegido/ (ver lib/protegido.ts).
   * Se reescriben para que las URLs que ya usa todo el codigo sigan siendo
   * /models/... y /renders/.... proxy.ts corre antes de las reescrituras y ve la
   * URL original, asi que las protege igual.
   *
   * Aqui estaba la cabecera "public, max-age=0" de /models/*. Se quito: "public"
   * permite que un CDN o proxy guarde el GLB y lo sirva sin pasar por la
   * contrasena. Las rutas mandan "private" por su cuenta.
   */
  async rewrites() {
    return [
      { source: "/models/:path*", destination: "/api/modelos/:path*" },
      { source: "/renders/:archivo", destination: "/api/renders/:archivo" },
    ];
  },

  // Las rutas leen protegido/ del disco en cada peticion. El trazado de Next no
  // lo ve (no hay un import) y en Hostinger la carpeta no llegaria al build.
  // Las claves son globs: "[...ruta]" se leeria como clase de caracteres, por eso "**".
  outputFileTracingIncludes: {
    "/api/modelos/**": ["./protegido/models/**"],
    "/api/renders/**": ["./protegido/renders/*.jpg"],
  },
};

export default nextConfig;

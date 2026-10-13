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

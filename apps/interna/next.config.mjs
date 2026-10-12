/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // @react-pdf/renderer usa streams y Buffer de Node.js internamente.
  // Si webpack intenta empaquetarlo lo rompe; hay que dejarlo como modulo
  // externo para que Next.js lo cargue directamente desde node_modules.
  serverExternalPackages: ["@react-pdf/renderer"],

  allowedDevOrigins: [
    "192.168.1.46", // Axel
    "192.168.1.124", // Francisco
    ...(process.env.IP_LAN ? [process.env.IP_LAN] : []),
  ],

  outputFileTracingIncludes: {
    "/api/modelo/[...ruta]": ["./contenido/piezas_MX80/visualizacion/**/*_web.glb"],
    "/api/descarga/[sku]/[formato]": ["./contenido/piezas_MX80/descargas/**"],
    "/api/ficha/pieza/[sku]": ["./public/brand/logo-mxd.png", "./public/renders/**"],
    "/api/ficha/seccion/[seccion]": ["./public/brand/logo-mxd.png", "./public/renders/**"],
    "/api/ficha/completo": ["./public/brand/logo-mxd.png", "./public/renders/**"],
  },

  async headers() {
    return [
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

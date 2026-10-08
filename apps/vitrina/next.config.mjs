import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // En el monorepo, "npm install" en la raiz hostea react/react-dom/next al
  // node_modules de la raiz. Sin esto, el output standalone solo rastrea
  // dependencias dentro de apps/vitrina y falla en runtime con "Cannot find
  // module 'react'" cuando el build corre via auto-deploy de Git (clona el
  // repo completo). El deploy manual por archivo no lo sufria porque
  // instalaba aislado dentro de apps/vitrina.
  outputFileTracingRoot: path.join(__dirname, "../../"),

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

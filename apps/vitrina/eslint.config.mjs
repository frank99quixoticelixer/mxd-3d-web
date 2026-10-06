import next from "eslint-config-next";

/**
 * Configuracion plana de ESLint (formato nuevo, ESLint 9+).
 * eslint-config-next 16 ya exporta configuracion plana, no hace falta compatibilidad.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      // Cualquier .next anidado: una salida de build perdida en una subcarpeta
      // hacia que el lint revisara los bundles de node_modules y fallara.
      "**/.next/**",
      "contenido/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  ...next,
  {
    rules: {
      // react-three-fiber usa propiedades que React no conoce (position, intensity,
      // args...) sobre elementos en minuscula que no son etiquetas HTML.
      "react/no-unknown-property": "off",
    },
  },
  {
    // ---------------------------------------------------------------
    // Excepcion acotada al visor 3D.
    //
    // three.js funciona mutando objetos de la escena (posiciones, materiales,
    // camara). Ese es el modelo de programacion de react-three-fiber y no hay
    // forma declarativa equivalente. La regla react-hooks/immutability, pensada
    // para datos de React, marca esas mutaciones como error.
    //
    // La excepcion se limita a esta carpeta y todas las mutaciones ocurren
    // dentro de efectos o del bucle de render (useFrame), nunca durante el
    // render de React, que es la condicion que la regla protege de verdad.
    // ---------------------------------------------------------------
    files: ["src/features/viewer/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  {
    // ---------------------------------------------------------------
    // Fichas PDF: el <Image> de @react-pdf/renderer no es el <img> del DOM.
    //
    // jsx-a11y/alt-text se dispara con cualquier componente que se llame
    // "Image", pero este dibuja dentro de un PDF: no existe un atributo alt
    // que poner, y pasarselo seria una prop desconocida para react-pdf.
    // La excepcion se limita a esta carpeta, que es la unica que usa ese
    // componente; el <Image> de next/image sigue vigilado en todo lo demas.
    // ---------------------------------------------------------------
    files: ["src/features/ficha-pdf/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
];

export default eslintConfig;

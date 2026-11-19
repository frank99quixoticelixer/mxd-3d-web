/**
 * Datos del Manual de Usuario MX80 V1.0 (public/manuales/mx80/).
 *
 * POR QUE VIVE APARTE DEL CATALOGO: es informacion PUBLICA, la que MXD le
 * entrega a cualquier cliente con el dron, y no forma parte del esquema de
 * Pieza (que mezcla datos internos y se recorta en lib/publico.ts). Aqui solo
 * entra lo que ya esta impreso en el manual de usuario; nada de cotas de
 * fabricacion, materiales de proveedor ni precios.
 *
 * Cada dato lleva la pagina del manual de donde sale, para poder verificarlo
 * cuando salga una version nueva del manual.
 */

export const MANUAL_MX80: {
  version: string;
  /**
   * Ruta del PDF publicado, o null mientras no este publicado. Con null los
   * datos se siguen mostrando (citando el manual) pero sin enlace de descarga.
   * Para publicarlo: poner el PDF en public/manuales/mx80/ y su ruta aqui.
   */
  archivo: string | null;
  /** Peso del PDF, para avisar antes de descargarlo. */
  tamano: string;
} = {
  version: "V1.0",
  archivo: null,
  tamano: "5 MB",
};

export interface Dato {
  etiqueta: string;
  valor: string;
}

/** Cifras del dron completo para la portada. Pag. 61-64. */
export const CIFRAS_MX80: Dato[] = [
  { etiqueta: "Tanque de aspersión", valor: "80 L" },
  { etiqueta: "Ancho de aspersión", valor: "6 a 10 m" },
  { etiqueta: "Empuje por motor", valor: "≈ 75 kg" },
  { etiqueta: "Hélices plegables", valor: "63 in" },
  { etiqueta: "Caudal máximo", valor: "40 L/min" },
  { etiqueta: "Peso máx. de despegue", valor: "141.2 kg" },
];

/** Lo que el manual destaca del MX80. Pag. 10, 28-29 y 62. */
export const CARACTERISTICAS_MX80: { titulo: string; texto: string }[] = [
  {
    titulo: "Fibra de carbono y brazos plegables",
    texto:
      "Estructura de fibra de carbono, más ligera y resistente. Los cuatro brazos se pliegan para transportarlo en una caja de 1333 × 903 × 935 mm.",
  },
  {
    titulo: "Hecho para lavarse",
    texto:
      "Resistente al agua, al polvo y a la corrosión. La aspersión, el radar y la propulsión tienen clasificación IP67.",
  },
  {
    titulo: "Precisión centimétrica",
    texto:
      "GNSS de doble redundancia con orientación por doble antena. Con RTK, el vuelo estacionario se mantiene dentro de ±10 cm.",
  },
  {
    titulo: "Ve el terreno y los obstáculos",
    texto:
      "Radar de onda milimétrica para seguir el terreno de 1 a 30 m y LiDAR que detecta obstáculos de 1 a 60 m al frente y a los lados.",
  },
  {
    titulo: "Aspersión de alto caudal",
    texto:
      // Gota de 50 a 500 µm y recirculacion de 30 L/min: datos del equipo
      // (2026-11-14); el manual dice 30 a 500 µm y no menciona la recirculacion.
      "Dos bombas peristálticas dosificadoras de 20 L/min (40 L/min en total), bomba de recirculación de 30 L/min y cuatro atomizadores centrífugos con gota seleccionable de 50 a 500 μm.",
  },
  {
    titulo: "Batería de cambio rápido",
    texto:
      // Bateria de 30 Ah (confirmado por el equipo, 2026-11-18; ficha del
      // proveedor: 600 ciclos). El manual describe una de 34 Ah.
      "Batería inteligente de 30 000 mAh a 68.4 V, de conexión directa y hasta 600 ciclos. Una batería de respaldo mantiene el control de vuelo 5 minutos durante el cambio.",
  },
];

/** Especificaciones generales del dron, agrupadas. Pag. 61-64. */
export const ESPECIFICACIONES_MX80: { grupo: string; datos: Dato[] }[] = [
  {
    grupo: "Dimensiones y peso",
    datos: [
      { etiqueta: "En operación", valor: "3577 × 3384 × 873 mm" },
      { etiqueta: "Distancia entre ejes de motores", valor: "2640 mm" },
      // Equipo (2026-11-14): 61.2 kg en vacio + 80 L de mezcla = 141.2 kg de
      // despegue. El manual dice 66.2 kg (pag. 63).
      { etiqueta: "Peso en vacío", valor: "61.2 kg" },
      { etiqueta: "Peso máximo de despegue", valor: "141.2 kg" },
    ],
  },
  {
    grupo: "Vuelo",
    datos: [
      { etiqueta: "Velocidad máxima de operación", valor: "10 m/s" },
      { etiqueta: "Velocidad máxima de vuelo", valor: "13.8 m/s" },
      // El tiempo de vuelo estacionario del manual (5.5 min con carga) se midio
      // con la bateria de 34 Ah: no aplica a la de 30 Ah. Se publica cuando se
      // mida con la bateria actual.
      { etiqueta: "Altitud máxima de despegue", valor: "2000 m" },
    ],
  },
  {
    grupo: "Operación",
    datos: [
      { etiqueta: "Temperatura", valor: "0 a 40 °C" },
      { etiqueta: "Viento máximo recomendado", valor: "8 m/s" },
      // Datos del equipo (2026-11-14). El manual dice 10 km (pag. 18) o 15 km
      // (pag. 63) de comunicacion y 3 km de imagen: no son los reales.
      { etiqueta: "Telemetría", valor: "5 km" },
      { etiqueta: "Transmisión de imagen", valor: "1 km" },
    ],
  },
];

/**
 * Datos y cuidados de cada pieza del catalogo, por SKU. Solo las piezas que el
 * manual describe; las demas no llevan esta seccion.
 */
export const MANUAL_POR_PIEZA: Record<
  string,
  { datos: Dato[]; cuidados: string[]; paginas: string }
> = {
  "MX80-007": {
    datos: [
      { etiqueta: "Modelo", valor: "X75" },
      { etiqueta: "Tamaño del estator", valor: "156 × 23 mm" },
      { etiqueta: "Valor KV", valor: "45 RPM/V" },
      { etiqueta: "Potencia nominal", valor: "5000 W" },
      { etiqueta: "Empuje máximo", valor: "≈ 75 kg por motor" },
    ],
    cuidados: [
      "Después de operar, limpia el exterior con un paño húmedo y tibio.",
      "No uses lavado a alta presión: el agua dentro del motor acorta su vida útil.",
      "Si notas resistencia, ruido anormal o juego, deja de volar y contacta a servicio.",
    ],
    paginas: "61 y 54",
  },
  "MX80-004": {
    datos: [
      { etiqueta: "Material", valor: "Fibra de carbono" },
      { etiqueta: "Diámetro", valor: "63 in (1608 mm)" },
      { etiqueta: "Paso", valor: "24 in" },
      { etiqueta: "Sentido de giro", valor: "Motores 1 y 3: CW · Motores 2 y 4: CCW" },
    ],
    cuidados: [
      "Reemplázalas de inmediato si están agrietadas: pierden sustentación y vibran.",
      "No las intercambies: las CW van en los motores 1 y 3, las CCW en los 2 y 4.",
      "Limpia los residuos de pesticida al terminar cada jornada.",
      "Despliégalas a 180° antes de volar y asegúralas con sus sujetadores para transportar.",
    ],
    paginas: "61, 55 y 32",
  },
  "MX80-009": {
    datos: [
      { etiqueta: "Voltaje de operación", valor: "68.4 V (18S LiPo)" },
      { etiqueta: "Corriente nominal", valor: "100 A" },
      { etiqueta: "Potencia nominal", valor: "5000 W" },
      { etiqueta: "Variadores por dron", valor: "4" },
    ],
    cuidados: [
      "Revisa que los conectores entren por completo: uno flojo se sobrecalienta.",
      "Si un conector se ennegrece o hace chispa, reemplázalo.",
    ],
    paginas: "61 y 57",
  },
  "MX80-012": {
    datos: [
      // El manual dice 75 L nominales y 80 L maximos; el tanque es de 80 L
      // (confirmado por el equipo y por el maestro de partes, AGR-PZA-001).
      { etiqueta: "Capacidad", valor: "80 L" },
      { etiqueta: "Bombas", valor: "2 peristálticas dosificadoras, 20 L/min cada una" },
      { etiqueta: "Boquillas", valor: "4 centrífugas, IP67" },
    ],
    cuidados: [
      "Al terminar el día, enjuaga tanque, tuberías y boquillas con agua limpia.",
      "Vacíalo para almacenarlo o transportarlo.",
      "Evita polvos humectables y concentrados muy espesos: tapan los conductos.",
      "No uses el tanque para otra cosa después de mezclar herbicidas.",
    ],
    paginas: "61 y 57",
  },
  "MX80-011": {
    datos: [
      { etiqueta: "Material", valor: "Fibra de carbono" },
      { etiqueta: "Distancia entre ejes", valor: "2640 mm" },
      { etiqueta: "Desplegado", valor: "3577 × 3384 × 873 mm" },
      { etiqueta: "Plegado (caja)", valor: "1333 × 903 × 935 mm" },
    ],
    cuidados: [
      "Revisa con regularidad que todos los tornillos estén apretados.",
      "Para transportarlo, fija los brazos plegados en sus abrazaderas.",
      "Cuidado con los dedos al plegar y desplegar los brazos.",
      "No lo sumerjas al limpiarlo: lleva electrónica de precisión.",
    ],
    paginas: "61, 54 y 59",
  },
  "MX80-008": {
    datos: [{ etiqueta: "Material", valor: "Fibra de carbono" }],
    cuidados: [
      "Antes de volar, confirma que el brazo esté desplegado y su seguro bien ajustado.",
      "Si el tubo presenta daño, contacta a servicio para reemplazarlo.",
    ],
    paginas: "6 y 54",
  },
  "MX80-006": {
    datos: [{ etiqueta: "Función", valor: "Protege el motor de la neblina y los químicos" }],
    cuidados: [
      "Limpia con un paño húmedo y tibio después de operar.",
      "No laves a alta presión hacia el interior del motor.",
    ],
    paginas: "30 y 54",
  },
};

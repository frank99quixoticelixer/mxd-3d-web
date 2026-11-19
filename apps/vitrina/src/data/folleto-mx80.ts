/**
 * Folleto comercial del MX80 (PDF de dos paginas, material de venta).
 *
 * Lo genera `npm run folleto:generar` (scripts/folleto/generar.tsx). Cada dato
 * dice de donde sale: la pagina del Manual de Usuario MX80 V1.0, o "equipo"
 * cuando lo corrigio el equipo de MXD (2026-11-14: telemetria 5 km, imagen
 * 1 km, gota de 50 a 500 micras, bomba de recirculacion de 30 L/min). Al
 * cambiar un dato, se regenera el PDF y se commitea.
 *
 * Reglas del folleto (pedidas por el equipo):
 * - Sin renders ni fotos del dron: los que hay no son del modelo actual.
 * - No promociona ninguna pagina web: solo correo y telefono de contacto.
 * - Bateria de 30 Ah (equipo, 2026-11-18). El tiempo de vuelo estacionario del
 *   manual se midio con una de 34 Ah: no se publica hasta medirlo con la actual.
 *
 * El PDF vive en public/ (como el manual) y se descarga sin contrasena: aqui
 * solo entra lo que ya es publico.
 */

export const FOLLETO_MX80 = {
  /** Ruta publica del PDF. El script lo escribe en public/ con esta ruta. */
  archivo: "/folletos/mx80/folleto-mx80.pdf",
  /** Peso aproximado, para avisarlo junto al enlace. Lo reporta el script. */
  tamano: "186 KB",
  /** Nombre con el que se guarda al descargarlo. */
  nombreDescarga: "MXD-MX80-folleto.pdf",
} as const;

export interface DatoFolleto {
  etiqueta: string;
  valor: string;
}

/** Frase de portada. */
export const LEMA_FOLLETO = "Dron agrícola de aspersión de alto caudal";

/** Portada: las cifras grandes. */
export const CIFRAS_FOLLETO: DatoFolleto[] = [
  { valor: "80 L", etiqueta: "Tanque de aspersión" }, // pag. 61
  { valor: "40 L/min", etiqueta: "Caudal de aspersión" }, // pag. 61
  { valor: "6–10 m", etiqueta: "Ancho de aspersión" }, // pag. 62
  { valor: "50–500 µm", etiqueta: "Gota seleccionable" }, // equipo
  { valor: "±10 cm", etiqueta: "Precisión con RTK" }, // pag. 63
  { valor: "60 m", etiqueta: "Detección LiDAR" }, // pag. 62
];

/** Portada: el sistema de aspersion, en cuatro bloques. */
export const ASPERSION_FOLLETO: { cifra: string; titulo: string; texto: string }[] = [
  {
    cifra: "2 × 20 L/min",
    titulo: "Dos bombas dosificadoras",
    texto: "Bombas peristálticas de 20 L/min cada una: 40 L/min en total.", // pag. 61
  },
  {
    cifra: "30 L/min",
    titulo: "Bomba de recirculación",
    texto: "Mantiene la mezcla en movimiento dentro del tanque.", // equipo
  },
  {
    cifra: "4 aspersores",
    titulo: "Atomizadores centrífugos",
    texto: "Gota seleccionable de 50 a 500 micras según el producto y el cultivo. IP67.", // equipo, pag. 61
  },
  {
    cifra: "6–10 m",
    titulo: "Ancho de aspersión",
    texto: "Con tanque de 80 L para cubrir más superficie en cada vuelo.", // pag. 61-62
  },
];

/**
 * Evasion de obstaculos (pag. 51 y 62): el LiDAR ve de 1 a 60 m al frente y a
 * los lados; el frenado tiene tres etapas segun la distancia al obstaculo.
 */
export const EVASION_FOLLETO = {
  texto:
    "LiDAR de 1 a 60 m al frente y a los lados, y radar de onda milimétrica al frente. Con la evasión autónoma activada, el MX80 rodea el obstáculo por la izquierda o la derecha sin intervención del piloto.",
  etapas: [
    { distancia: "Más de 30 m", accion: "Detecta el obstáculo y reduce la velocidad" },
    { distancia: "Menos de 30 m", accion: "Alerta amarilla: baja a 2 m/s" },
    { distancia: "Menos de 8 m", accion: "Alerta roja: frena por completo" },
  ],
};

/** Reverso: lo que el MX80 hace bien, en tarjetas cortas. */
export const DESTACADOS_FOLLETO: { titulo: string; texto: string }[] = [
  {
    titulo: "Sigue el terreno",
    texto: "Radar de onda milimétrica que mantiene la altura de 1 a 30 m sobre el cultivo, con precisión de 0.1 m.", // pag. 62
  },
  {
    titulo: "Precisión centimétrica",
    texto: "GNSS con orientación por doble antena. Con RTK, el vuelo estacionario se mantiene dentro de ±10 cm.", // pag. 63-64
  },
  {
    titulo: "Hecho para lavarse",
    texto: "Aspersión, radar, LiDAR y control de vuelo con protección IP67 contra agua y polvo.", // pag. 61-63
  },
  {
    titulo: "Fibra de carbono y plegable",
    texto: "Estructura y hélices de fibra de carbono. Plegado cabe en 1333 × 903 × 935 mm.", // pag. 61
  },
];

/** Reverso: funciones de vuelo inteligente (manual, cap. 2.3 y 2.4). */
export const FUNCIONES_FOLLETO: { titulo: string; texto: string }[] = [
  {
    titulo: "Operación autónoma",
    texto: "Mapeo de campo, obstáculos y waypoints en la app MXD; la ruta óptima se genera sola y al final queda un reporte.", // pag. 43-44
  },
  {
    titulo: "Reanuda donde se quedó",
    texto: "Si se acaba el líquido o la batería, registra el punto de interrupción y regresa a él para continuar la ruta.", // pag. 45-46
  },
  {
    titulo: "Nivel de líquido en tiempo real",
    texto: "Sensor de peso en el tanque para decidir cuándo y dónde recargar.", // pag. 45
  },
  {
    titulo: "Terreno plano, agua o montaña",
    texto: "El radar ajusta su estrategia para mantener la altura constante sobre el cultivo.", // pag. 47
  },
  {
    titulo: "Protección de batería en dos niveles",
    texto: "Al 30 % avisa; al 10 % aterriza solo. Umbrales y acciones configurables.", // pag. 48
  },
  {
    titulo: "Regreso al origen",
    texto: "Si se pierde la señal del control, aterriza, se queda en estacionario o regresa al punto de origen.", // pag. 49
  },
];

/** Reverso: especificaciones agrupadas. */
export const ESPECIFICACIONES_FOLLETO: { grupo: string; datos: DatoFolleto[] }[] = [
  {
    grupo: "Aspersión",
    datos: [
      { etiqueta: "Tanque", valor: "80 L" }, // pag. 61
      { etiqueta: "Bombas dosificadoras", valor: "2 × 20 L/min = 40 L/min" }, // pag. 61
      { etiqueta: "Bomba de recirculación", valor: "30 L/min" }, // equipo
      { etiqueta: "Atomizadores centrífugos", valor: "4 × 10 L/min, IP67" }, // pag. 61
      { etiqueta: "Tamaño de gota", valor: "50 a 500 µm, seleccionable" }, // equipo
      { etiqueta: "Ancho de aspersión", valor: "6 a 10 m" }, // pag. 62
    ],
  },
  {
    grupo: "Propulsión",
    datos: [
      { etiqueta: "Motores", valor: "4 × X75, 5000 W c/u" }, // pag. 61
      { etiqueta: "Empuje máximo", valor: "aprox. 75 kg por motor" }, // pag. 61
      { etiqueta: "Hélices", valor: "63 in, fibra de carbono" }, // pag. 61
      { etiqueta: "Voltaje", valor: "68.4 V (18S)" }, // pag. 61
    ],
  },
  {
    grupo: "Vuelo",
    datos: [
      { etiqueta: "Velocidad máx. de operación", valor: "10 m/s" }, // pag. 63
      { etiqueta: "Velocidad máx. de vuelo", valor: "13.8 m/s" }, // pag. 63
      { etiqueta: "Ascenso / descenso", valor: "5 m/s / 3 m/s" }, // pag. 63
      { etiqueta: "Altitud máx. de despegue", valor: "2000 m" }, // pag. 63
    ],
  },
  {
    grupo: "Sensores y enlace",
    datos: [
      { etiqueta: "LiDAR (evasión)", valor: "1 a 60 m, frente y lados" }, // pag. 62
      { etiqueta: "Radar (evasión)", valor: "1 a 40 m, frente" }, // pag. 62
      { etiqueta: "Radar (terreno)", valor: "1 a 30 m" }, // pag. 62
      { etiqueta: "Telemetría", valor: "5 km" }, // equipo
      { etiqueta: "Transmisión de imagen", valor: "1 km" }, // equipo
      { etiqueta: "Cámara FPV", valor: "720p, hasta 1080p" }, // pag. 63
    ],
  },
  {
    grupo: "Dimensiones y peso",
    datos: [
      { etiqueta: "En operación", valor: "3577 × 3384 × 873 mm" }, // pag. 61
      { etiqueta: "Plegado", valor: "1333 × 903 × 935 mm" }, // pag. 61
      { etiqueta: "Entre ejes de motores", valor: "2640 mm" }, // pag. 61
      // Equipo (2026-11-14): 61.2 kg en vacio + 80 L de mezcla = 141.2 kg de
      // despegue. El manual dice 66.2 kg (pag. 63).
      { etiqueta: "Peso en vacío", valor: "61.2 kg" },
      { etiqueta: "Peso máx. de despegue", valor: "141.2 kg" }, // pag. 63
    ],
  },
  {
    grupo: "Operación",
    datos: [
      { etiqueta: "Control remoto", valor: "Pantalla de 7 in, 8 a 10 h" }, // pag. 64
      { etiqueta: "Cargador", valor: "12 000 W" }, // pag. 64
      { etiqueta: "Batería", valor: "30 000 mAh, 68.4 V" }, // equipo 2026-11-18
      { etiqueta: "Temperatura", valor: "0 a 40 °C" }, // pag. 63
    ],
  },
];

/** Nota al pie del reverso. */
export const NOTA_FOLLETO =
  "Alcances sin interferencia ni obstrucciones.";

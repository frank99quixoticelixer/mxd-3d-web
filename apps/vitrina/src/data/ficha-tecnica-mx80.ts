/**
 * Ficha tecnica del MX80 (PDF, material de venta).
 *
 * Lo genera `npm run ficha:generar` (scripts/folleto/ficha.tsx) con el mismo
 * diseno del folleto. Base: "FICHA DRON AGRICOLA.pdf" del equipo (Word, 6 de
 * noviembre de 2026). Cada dato dice de donde sale:
 *   ficha  = esa ficha del equipo
 *   pag. N = Manual de Usuario MX80 V1.0
 *   equipo = correccion del equipo MXD (2026-11-14), la misma que usa el folleto
 * Cuando la ficha y una correccion del equipo no coinciden, manda la
 * correccion (es mas reciente) y se anota.
 *
 * Mismas reglas que el folleto: sin fotos, sin enlaces a paginas web, y solo
 * datos publicos (se descarga sin contrasena desde public/). El modelo de la
 * controladora no se publica (la ficha lo deja en blanco).
 *
 * Bateria: 30 Ah (equipo, 2026-11-18), con los datos de su ficha de proveedor.
 * El manual describe una de 34 Ah; su tiempo de vuelo estacionario (5.5 min
 * con carga) se midio con esa, asi que no se publica hasta medirlo con la de
 * 30 Ah.
 */

export const FICHA_TECNICA_MX80 = {
  /** Ruta publica del PDF. El script lo escribe en public/ con esta ruta. */
  archivo: "/folletos/mx80/ficha-tecnica-mx80.pdf",
  /** Peso aproximado, para avisarlo junto al enlace. Lo reporta el script. */
  tamano: "196 KB",
  /** Nombre con el que se guarda al descargarlo. */
  nombreDescarga: "MXD-MX80-ficha-tecnica.pdf",
} as const;

/** Un renglon de tabla, o un subtitulo dentro de la seccion. */
export type FilaFicha = { p: string; v: string } | { sub: string };

export interface SeccionFicha {
  titulo: string;
  /** "Opcional" para los sistemas que no vienen de serie. */
  marca?: string;
  filas: FilaFicha[];
}

/** Cifras de la cabecera. */
export const CIFRAS_FICHA: { valor: string; etiqueta: string }[] = [
  { valor: "80 L", etiqueta: "Tanque" }, // ficha
  { valor: "40 L/min", etiqueta: "Caudal" }, // ficha
  { valor: "6–10 m", etiqueta: "Ancho útil" }, // ficha (ancho de aspersión)
  { valor: "4 × 75 kg", etiqueta: "Empuje máximo" }, // ficha
  { valor: "141.2 kg", etiqueta: "Despegue máx." }, // pag. 63
];

export const SECCIONES_FICHA: SeccionFicha[] = [
  {
    titulo: "Estructura y peso",
    filas: [
      { p: "Distancia simétrica entre ejes de motores", v: "2640 mm" }, // ficha
      { p: "Dimensiones en operación", v: "3577 × 3384 × 873 mm" }, // pag. 61
      { p: "Dimensiones plegado (embalaje)", v: "1333 × 903 × 935 mm" }, // pag. 61
      { p: "Material", v: "Fibra de carbono, brazos plegables" }, // pag. 10
      { p: "Peso en vacío", v: "61.2 kg" }, // equipo (el manual dice 66.2 kg)
      { p: "Peso máximo de despegue", v: "141.2 kg (aspersión) / 147.2 kg (esparcido)" }, // pag. 63
    ],
  },
  {
    titulo: "Propulsión",
    filas: [
      { sub: "Motor de potencia" },
      { p: "Número de motores", v: "4" }, // ficha
      { p: "Potencia", v: "5000 W por motor" }, // ficha
      { p: "Empuje máximo", v: "Aprox. 75 kg por motor" }, // ficha
      { sub: "ESC de potencia" },
      { p: "Voltaje de operación", v: "68.4 V (LiPo 18S)" }, // ficha
      { p: "Corriente nominal de operación", v: "100 A" }, // ficha
      { p: "Potencia nominal", v: "5000 W" }, // ficha
      { sub: "Hélice plegable" },
      { p: "Diámetro", v: "63 in / 1608 mm" }, // ficha
      { p: "Paso y material", v: "24 in, fibra de carbono" }, // pag. 61
    ],
  },
  {
    titulo: "Sistema de aspersión",
    filas: [
      { p: "Capacidad máxima del tanque", v: "80 L" }, // ficha
      { p: "Tipo de bomba", v: "Peristáltica dosificadora" }, // ficha
      { p: "Caudal máximo", v: "40 L/min (2 bombas de 20 L/min)" }, // ficha
      { p: "Bomba de recirculación", v: "30 L/min" }, // equipo
      { p: "Boquillas", v: "4 centrífugas, IP67" }, // ficha
      { p: "Capacidad máxima de atomización", v: "40 L/min (10 L/min por boquilla)" }, // ficha
      { p: "Ancho de pulverización", v: "6–10 m" }, // ficha
      { p: "Tamaño de gota", v: "50–500 µm, seleccionable" }, // equipo (la ficha dice 30–500 µm)
    ],
  },
  {
    titulo: "Sistema de esparcido",
    marca: "Opcional",
    filas: [
      { p: "Capacidad del tanque", v: "120 L" }, // ficha
      { p: "Carga útil máxima", v: "80 kg" }, // ficha
      { p: "Alimentación", v: "Dosificación por tornillo sin fin" }, // ficha
      { p: "Siembra", v: "Disco centrífugo" }, // ficha
      { p: "Ancho de esparcido", v: "5–10 m" }, // ficha
      { p: "Temperatura de operación recomendada", v: "0 a 40 °C" }, // ficha
    ],
  },
  {
    titulo: "Elevación de carga",
    marca: "Opcional",
    filas: [
      { p: "Carga útil", v: "85 kg" }, // ficha
      { p: "Longitud del cable", v: "15 m (configuración estándar)" }, // ficha
      { p: "Liberación de carga de emergencia", v: "Compatible" }, // ficha
      { p: "Liberación automática del gancho al aterrizar", v: "Compatible" }, // ficha
      { p: "Temperatura de trabajo", v: "0 a 40 °C" }, // ficha
      { p: "Aplicaciones", v: "Agricultura, silvicultura, ganadería y pesca" }, // ficha
    ],
  },
  {
    titulo: "Sensores",
    filas: [
      { sub: "Radar de ondas milimétricas" },
      { p: "Precisión de medición de distancia", v: "0.1 m" }, // ficha
      { p: "Seguimiento del terreno", v: "1–30 m" }, // ficha
      { p: "Evasión de obstáculos", v: "Frontal, 1–40 m" }, // pag. 62
      { p: "Seguimiento del terreno, dirección", v: "Frontal oblicua y directamente abajo" }, // pag. 62
      { p: "Condición de operación", v: "Altura de vuelo mayor a 2 m" }, // pag. 62
      { p: "Modos de terreno", v: "Plano, superficie de agua, montañoso" }, // pag. 47
      { p: "Protección", v: "IP67" }, // ficha
      { sub: "LiDAR" },
      { p: "Precisión de medición de distancia", v: "0.1 m" }, // ficha
      { p: "Evasión de obstáculos", v: "Frente y lados, 1–60 m" }, // pag. 62
      { p: "Protección", v: "IP67" }, // ficha
      { sub: "Cámara FPV" },
      { p: "Sensor", v: "2 megapíxeles" }, // pag. 18
      { p: "Campo de visión", v: "Horizontal 86° / vertical 52°" }, // ficha
      { p: "Resolución", v: "720p, hasta 1080p" }, // pag. 63
      { p: "Cámara inferior", v: "Compatible" }, // pag. 63
    ],
  },
  {
    titulo: "Parámetros de vuelo",
    filas: [
      { p: "Vuelo estacionario (GNSS)", v: "Horizontal ±1.0 m / vertical ±0.5 m" }, // ficha
      { p: "Vuelo estacionario con RTK", v: "Horizontal ±10 cm / vertical ±10 cm" }, // ficha
      { p: "Vuelo estacionario con radar", v: "Vertical ±0.1 m" }, // ficha
      { p: "Velocidad máxima de vuelo", v: "13.8 m/s" }, // ficha
      { p: "Velocidad máxima de operación", v: "10 m/s" }, // ficha
      { p: "Ascenso / descenso máximo", v: "5 m/s / 3 m/s" }, // pag. 63
      { p: "Límite de distancia horizontal", v: "1000 m" }, // ficha
      { p: "Límites de fábrica (configurables)", v: "Altura 20 m, radio 999 m" }, // pag. 38
      { p: "Altitud máxima de despegue", v: "2000 m" }, // ficha
      { p: "Temperatura de operación recomendada", v: "0 a 40 °C" }, // ficha
    ],
  },
  {
    titulo: "Controladora de vuelo",
    filas: [
      { p: "Voltaje de entrada", v: "30–80 V" }, // ficha
      { p: "Potencia nominal", v: "20 W (sin radar, bomba ni periféricos)" }, // ficha
      { p: "Interfaces", v: "CANBus, RS485, PWM, USB" }, // ficha
      { p: "Protección", v: "IP67 (con los conectores externos apretados)" }, // ficha
      { p: "Temperatura de operación", v: "−10 a 45 °C" }, // ficha
    ],
  },
  {
    titulo: "Control remoto y enlace",
    filas: [
      { p: "Frecuencias de operación", v: "2400–2476 MHz / 5725–5829 MHz" }, // ficha
      { p: "Telemetría", v: "5 km" }, // equipo (la ficha dice 10 km)
      { p: "Transmisión de video", v: "1 km" }, // equipo (la ficha dice 3 km)
      { p: "Marcación de puntos RTK", v: "Compatible" }, // ficha
      { p: "Precisión de posicionamiento (RTK fijo)", v: "Horizontal ±0.1 m / vertical ±0.1 m" }, // ficha
      { p: "Bluetooth", v: "2.400–2.4835 GHz" }, // pag. 18
      { p: "Pantalla", v: "7 in táctil capacitiva, 1920 × 1200" }, // pag. 18
      { p: "Sistema", v: "Android" }, // pag. 18
      { p: "Batería", v: "13 500 mAh, 7.4 V" }, // ficha
      { p: "Carga / autonomía", v: "Aprox. 2 h / 8 a 10 h" }, // pag. 18 y 64
      { p: "Temperatura de operación", v: "-15 a 40 °C" }, // pag. 18
      { p: "Peso", v: "Aprox. 1220 g" }, // pag. 64
    ],
  },
  {
    titulo: "GNSS y RTK",
    filas: [
      { p: "Vuelo estacionario sin RTK (RMS)", v: "Horizontal ±0.6 m / vertical ±0.3 m" }, // ficha
      { p: "Vuelo estacionario con RTK fijo (RMS)", v: "Horizontal ±0.1 m / vertical ±0.1 m" }, // ficha
      { p: "Precisión de orientación (RMS)", v: "0.4°" }, // ficha
    ],
  },
  {
    titulo: "Cargador",
    filas: [
      { p: "Voltaje de entrada", v: "CA trifásica 175–450 V; CA monofásica 90–260 V" }, // ficha
      { p: "Frecuencia de entrada", v: "50/60 Hz" }, // ficha
      { p: "Voltaje de salida", v: "CC 78.3 V (máx.)" }, // ficha
      { p: "Corriente de salida", v: "170 A (máx.)" }, // ficha
      { p: "Potencia de salida", v: "12 000 W (trifásica 380 V o monofásica 220 V); 6000 W (monofásica 110 V)" }, // ficha
      { p: "Modo de carga", v: "Potencia constante" }, // pag. 28
      { p: "Protecciones", v: "Sobrecorriente, sobretemperatura, sobrevoltaje, cortocircuito" }, // pag. 28
      { p: "Comunicación", v: "Bluetooth / CAN" }, // pag. 28
      { p: "Operación", v: "-5 a 45 °C, humedad 0–75 %" }, // pag. 28
      { p: "Dimensiones", v: "330 × 280 × 370 mm" }, // pag. 64
      { p: "Peso neto / bruto", v: "15.2 kg / 16.6 kg" }, // pag. 64
    ],
  },
  {
    titulo: "Batería",
    filas: [
      // 30 Ah (equipo, 2026-11-18): datos de la ficha del proveedor, los mismos
      // de la seccion de accesorios del sitio (data/accesorios.ts).
      { p: "Tipo", v: "Ion de litio NCM, 18S, conexión directa" }, // proveedor
      { p: "Voltaje nominal", v: "68.4 V" }, // ficha
      { p: "Capacidad", v: "30 000 mAh (2052 Wh)" }, // equipo / proveedor
      { p: "Tasa de descarga / carga", v: "8C / 4C" }, // proveedor
      { p: "Vida útil", v: "600 ciclos" }, // proveedor
      { p: "Protección", v: "IP56 (instalada en el dron)" }, // ficha
      { p: "Batería de respaldo", v: "Mantiene el control de vuelo 5 min durante el cambio" }, // pag. 55
      { p: "Dimensiones", v: "175 × 275 × 309 mm" }, // proveedor
      { p: "Peso", v: "13.5 kg" }, // proveedor
    ],
  },
  {
    titulo: "Funciones de vuelo inteligente",
    filas: [
      { p: "Modo GNSS", v: "Para parcelas chicas o irregulares; el caudal sigue a la velocidad y se detiene en estacionario" }, // pag. 43
      { p: "Modo totalmente autónomo", v: "Mapeo de campo, obstáculos y waypoints en la app MXD; ruta óptima automática y reporte de operación" }, // pag. 43-44
      { p: "Nivel de líquido", v: "Sensor de peso en el tanque, en tiempo real" }, // pag. 45
      { p: "Reanudar desde punto de interrupción", v: "Por falta de líquido, batería baja o evasión; regresa y continúa la ruta" }, // pag. 45-46
      { p: "Evasión de obstáculos", v: "Baja a 2 m/s a menos de 30 m y frena por completo a menos de 8 m; rodeo autónomo" }, // pag. 51
      { p: "Protección por batería baja", v: "Nivel I al 30 % (aviso); nivel II al 10 % (aterrizaje automático); configurables" }, // pag. 48
      { p: "Protección contra fallas", v: "Al perder la señal: aterrizar, estacionario o regreso al origen (RTH)" }, // pag. 49
      { p: "RTK", v: "RTK de red; orientación por doble antena como respaldo de la brújula" }, // pag. 52
    ],
  },
];

export const NOTAS_FICHA = [
  "Unidades del Sistema Internacional salvo indicación expresa.",
  "Alcances del control remoto sin obstáculos ni interferencia, en entorno agrícola típico.",
];

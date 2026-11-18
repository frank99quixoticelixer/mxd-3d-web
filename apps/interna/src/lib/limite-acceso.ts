/**
 * Limite de intentos de inicio de sesion.
 *
 * Frena a quien prueba contrasenas: 5 fallos por cuenta y 20 por IP en 15
 * minutos. Un acierto borra el contador de la cuenta.
 *
 * Es en memoria, con los mismos limites que lib/protegido.ts (ADR 0005): se
 * reinicia con cada despliegue y cada proceso lleva el suyo. Para un solo
 * proceso en Hostinger alcanza; frena la fuerza bruta casual, no a alguien con
 * paciencia que espere entre intentos. El limite que importa de verdad es la
 * longitud minima de la contrasena (12).
 */

const VENTANA_MS = 15 * 60 * 1000;
const MAXIMO_POR_CUENTA = 5;
const MAXIMO_POR_IP = 20;
const MAXIMO_ENTRADAS = 5000;

type Ventana = { inicio: number; fallos: number };

const ventanas = new Map<string, Ventana>();

function vigente(clave: string, ahora: number): Ventana | undefined {
  const v = ventanas.get(clave);
  if (!v) return undefined;
  if (ahora - v.inicio >= VENTANA_MS) {
    ventanas.delete(clave);
    return undefined;
  }
  return v;
}

/** true si la cuenta o la IP ya agotaron sus intentos; no cuenta nada. */
export function accesoBloqueado(ip: string, correo: string): boolean {
  const ahora = Date.now();
  return (
    (vigente(`cuenta:${correo}`, ahora)?.fallos ?? 0) >= MAXIMO_POR_CUENTA ||
    (vigente(`ip:${ip}`, ahora)?.fallos ?? 0) >= MAXIMO_POR_IP
  );
}

function sumar(clave: string, ahora: number) {
  const actual = vigente(clave, ahora);
  if (actual) actual.fallos += 1;
  else ventanas.set(clave, { inicio: ahora, fallos: 1 });
}

/** Cuenta un intento fallido contra la cuenta y contra la IP. */
export function registrarFallo(ip: string, correo: string): void {
  const ahora = Date.now();
  if (ventanas.size > MAXIMO_ENTRADAS) {
    for (const [clave, v] of ventanas) {
      if (ahora - v.inicio >= VENTANA_MS) ventanas.delete(clave);
    }
  }
  sumar(`cuenta:${correo}`, ahora);
  sumar(`ip:${ip}`, ahora);
}

/** Un acierto borra el contador de la cuenta (el de la IP sigue su curso). */
export function registrarAcierto(correo: string): void {
  ventanas.delete(`cuenta:${correo}`);
}

/**
 * Solicitudes de acceso (/registro, ADR 0007): 5 por IP por hora. Cuenta cada
 * solicitud, valida o no, porque lo que se frena es llenar la base de basura.
 * En memoria, con las mismas limitaciones que el de arriba.
 */
const VENTANA_SOLICITUDES_MS = 60 * 60 * 1000;
const MAXIMO_SOLICITUDES_POR_IP = 5;
const solicitudes = new Map<string, Ventana>();

function solicitudesVigentes(ip: string, ahora: number): Ventana | undefined {
  const v = solicitudes.get(ip);
  if (!v) return undefined;
  if (ahora - v.inicio >= VENTANA_SOLICITUDES_MS) {
    solicitudes.delete(ip);
    return undefined;
  }
  return v;
}

/** true si esta IP ya agoto sus solicitudes de la hora; no cuenta nada. */
export function solicitudesAgotadas(ip: string): boolean {
  return (solicitudesVigentes(ip, Date.now())?.fallos ?? 0) >= MAXIMO_SOLICITUDES_POR_IP;
}

/** Cuenta una solicitud de acceso hecha desde esta IP. */
export function registrarSolicitud(ip: string): void {
  const ahora = Date.now();
  if (solicitudes.size > MAXIMO_ENTRADAS) {
    for (const [clave, v] of solicitudes) {
      if (ahora - v.inicio >= VENTANA_SOLICITUDES_MS) solicitudes.delete(clave);
    }
  }
  const actual = solicitudesVigentes(ip, ahora);
  if (actual) actual.fallos += 1;
  else solicitudes.set(ip, { inicio: ahora, fallos: 1 });
}

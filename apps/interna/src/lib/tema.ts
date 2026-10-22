/**
 * Modo claro / oscuro / automatico.
 *
 * "automatico" no guarda un valor fijo: quita el atributo data-theme y deja
 * que decida @media (prefers-color-scheme) en globals.css, asi que sigue al
 * sistema operativo incluso si este cambia mientras la pestana esta abierta.
 */
export type Tema = "claro" | "oscuro" | "automatico";

export const CLAVE_TEMA = "mxd-tema";

const TEMAS_VALIDOS: readonly Tema[] = ["claro", "oscuro", "automatico"];

function esTemaValido(valor: string | null): valor is Tema {
  return valor !== null && TEMAS_VALIDOS.includes(valor as Tema);
}

/** Pone o quita data-theme en <html>. Es lo unico que lee globals.css. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === "automatico") {
    raiz.removeAttribute("data-theme");
  } else {
    raiz.setAttribute("data-theme", tema === "oscuro" ? "dark" : "light");
  }
}

export function leerTemaGuardado(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    return esTemaValido(guardado) ? guardado : "automatico";
  } catch {
    return "automatico";
  }
}

function guardarTema(tema: Tema): void {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Almacenamiento no disponible (modo privado, cuotas). El tema se
    // aplica igual, solo no sobrevive a un refresco.
  }
}

type Escucha = () => void;
const escuchas = new Set<Escucha>();

/**
 * Para useSyncExternalStore: localStorage es un sistema externo a React, asi
 * que SelectorTema se suscribe en vez de leerlo con un setState en un
 * efecto (eso causaria un repintado en cascada y ademas un parpadeo en el
 * primer render, antes de que el efecto corra).
 */
export function suscribirseATema(escucha: Escucha): () => void {
  escuchas.add(escucha);
  window.addEventListener("storage", escucha);
  return () => {
    escuchas.delete(escucha);
    window.removeEventListener("storage", escucha);
  };
}

/** Snapshot para el render en el servidor: ahi no hay localStorage ni DOM. */
export function leerTemaServidor(): Tema {
  return "automatico";
}

/** Guarda, aplica al documento y avisa a quien este suscrito (el propio SelectorTema). */
export function cambiarTema(tema: Tema): void {
  guardarTema(tema);
  aplicarTema(tema);
  escuchas.forEach((escucha) => escucha());
}

/**
 * Se inserta inline en <head> (ver layout.tsx) y corre antes de que React
 * hidrate. Sin esto, con "oscuro" u "claro" forzado, la pagina pintaria
 * primero con el tema del sistema y recien saltaria al guardado un
 * instante despues.
 */
export function scriptTemaInline(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});if(t==="claro"||t==="oscuro"){document.documentElement.setAttribute("data-theme",t==="oscuro"?"dark":"light");}}catch(e){}})();`;
}

/**
 * Icono por item del riel de PanelAccesorios.tsx, por id ("bateria",
 * "generador"...; null = el MX80 completo). Trazo simple (stroke,
 * currentColor) para heredar el color del boton sin tocarlo aparte.
 */
export function IconoAccesorio({
  id,
  className = "h-5 w-5",
}: {
  id: string | null;
  className?: string;
}) {
  if (id === "bateria") return <IconoBateria className={className} />;
  if (id === "generador") return <IconoGenerador className={className} />;
  if (id === "cargador") return <IconoCargador className={className} />;
  if (id === null) return <IconoDron className={className} />;
  return <IconoGenerico className={className} />;
}

/** MX80 completo: cuerpo central, cuatro brazos y sus rotores. */
function IconoDron({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="6" height="6" rx="1.4" />
      <line x1="9.3" y1="9.3" x2="4.4" y2="4.4" />
      <line x1="14.7" y1="9.3" x2="19.6" y2="4.4" />
      <line x1="9.3" y1="14.7" x2="4.4" y2="19.6" />
      <line x1="14.7" y1="14.7" x2="19.6" y2="19.6" />
      <circle cx="4" cy="4" r="2" />
      <circle cx="20" cy="4" r="2" />
      <circle cx="4" cy="20" r="2" />
      <circle cx="20" cy="20" r="2" />
    </svg>
  );
}

/** Bateria: cuerpo, terminal y dos barras de carga. */
function IconoBateria({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="2"
        y="7"
        width="18"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <rect x="20.5" y="10" width="1.7" height="4" rx="0.6" fill="currentColor" />
      <rect x="5.5" y="10" width="2" height="4" rx="0.4" fill="currentColor" />
      <rect x="9.5" y="10" width="2" height="4" rx="0.4" fill="currentColor" />
    </svg>
  );
}

/** Generador / estacion de carga: rayo dentro de un marco redondeado. */
function IconoGenerador({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3.5"
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path d="M13 6.5l-5.5 7h3.8l-1.1 4.5 5.8-7h-3.8z" fill="currentColor" />
    </svg>
  );
}

/**
 * Generico: caja simple. Doble uso: item sin icono propio dentro del riel,
 * y el distintivo "Equipo adicional" de SeccionAccesorios.tsx (una caja
 * tambien le queda bien a ese rotulo general).
 */
/** Cargador: caja con un rayo y el cable que sale hacia la bateria. */
function IconoCargador({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="6" width="12" height="13" rx="1.6" />
      <path d="M10 9.5l-2.5 3.5h3l-2.5 3.5" />
      <path d="M15 12.5h2.5a2 2 0 0 1 2 2V18" />
      <line x1="18.5" y1="18" x2="20.5" y2="18" />
    </svg>
  );
}

export function IconoGenerico({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
    </svg>
  );
}

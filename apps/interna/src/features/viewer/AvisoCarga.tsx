"use client";

import { useProgress } from "@react-three/drei";
import { useEffect } from "react";

/**
 * Aviso de carga (y de error) de un visor 3D, dibujado ENCIMA del lienzo como
 * HTML normal.
 *
 * POR QUE NO VA DENTRO DEL <Canvas>: antes era un <Html> de drei en el
 * fallback del Suspense. <Html> monta su propia raiz de React y la desmonta en
 * cuanto el modelo termina de cargar, a mitad del render del lienzo. React 19
 * lo reporta ("Attempted to synchronously unmount a root while React was
 * already rendering") y, cuando el nodo ya no estaba, tronaba con
 * "Failed to execute 'removeChild' on 'Node'". Fuera del lienzo no hay
 * segunda raiz que desmontar.
 *
 * useProgress lee un store global de drei, asi que funciona aqui afuera.
 */
export function AvisoCarga({
  texto,
  listo,
  fallo,
}: {
  /** "Cargando chasis", "Cargando pieza"... */
  texto: string;
  /** El modelo ya se monto: el aviso desaparece. */
  listo: boolean;
  /** No se pudo cargar: se muestra el mensaje de error en vez del progreso. */
  fallo?: boolean;
}) {
  const { progress } = useProgress();
  if (listo && !fallo) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="whitespace-nowrap rounded-md bg-mxd-fondo/80 px-2 py-1 text-xs font-medium tracking-wide text-mxd-gris">
        {fallo ? "No se pudo cargar el modelo 3D" : `${texto} ${Math.round(progress)}%`}
      </span>
    </div>
  );
}

/**
 * Se pone DENTRO del Suspense, junto al modelo: monta cuando el modelo ya
 * cargo y avisa. Si el modelo vuelve a suspenderse (otra pieza), se desmonta y
 * el aviso de carga vuelve a aparecer.
 */
export function MarcaCargado({ alCambiar }: { alCambiar: (listo: boolean) => void }) {
  useEffect(() => {
    alCambiar(true);
    return () => alCambiar(false);
  }, [alCambiar]);
  return null;
}

"use client";

import { useState } from "react";

import { urlModelo } from "@/config/modelos3d";
import type { Accesorio } from "@/data/accesorios";
import type { FichaEnlace } from "@/features/viewer/componentes";
import { VisorAccesorio } from "@/features/viewer/VisorAccesorio";
import type { GrupoMaterial } from "@/features/viewer/materiales";
import { VisorFrame } from "@/features/viewer/VisorFrame";

import { FichaAccesorio } from "./FichaAccesorio";
import { PanelAccesorios } from "./PanelAccesorios";

/**
 * Envuelve el visor de /explorar con una barra de seleccion DEBAJO: el MX80
 * completo (el VisorFrame de siempre) o uno de los accesorios que se venden
 * con el. Un accesorio no es una pieza del chasis -no vive en el GLB del
 * dron- asi que usa su propio visor (VisorAccesorio) en vez de aislar un
 * nodo del ensamble.
 */
export function SeccionAccesorios({
  fichas,
  accesorios,
  gruposMaterial,
}: {
  /** Piezas del catalogo para enlazar desde el VisorFrame del MX80. */
  fichas: FichaEnlace[];
  accesorios: Accesorio[];
  /** Tipo de material escrito en las fichas, para el filtro del visor. */
  gruposMaterial?: Readonly<Record<string, GrupoMaterial>>;
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const accesorioActivo = activo
    ? accesorios.find((a) => a.id === activo) ?? null
    : null;

  const items = [
    { id: null as string | null, nombre: "MX80 completo" },
    ...accesorios.map((a) => ({ id: a.id, nombre: a.nombre })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {/*
        El visor del MX80 (12 MB, ~350 nodos) se queda SIEMPRE montado, solo
        oculto con CSS: desmontarlo al cambiar de pestana repetiria el
        clonado del GLB y la reconstruccion del arbol de colision en cada
        clic. "activo" pausa su render loop mientras esta oculto, para no
        seguir gastando GPU en una escena que no se ve.
      */}
      <div className={accesorioActivo ? "hidden" : ""}>
        <VisorFrame
          fichas={fichas}
          gruposMaterial={gruposMaterial}
          activo={!accesorioActivo}
          className="h-[78dvh] min-h-[460px] w-full sm:h-[72dvh] lg:h-[62vh]"
        />
      </div>

      {accesorioActivo && (
        <VisorAccesorio
          url={accesorioActivo.glb ? urlModelo(accesorioActivo.glb) : null}
          nombre={accesorioActivo.nombre}
          className="h-[56dvh] min-h-[360px] w-full sm:h-[52dvh] lg:h-[46vh]"
        />
      )}

      <PanelAccesorios items={items} activo={activo} onSeleccionar={setActivo} />

      {accesorioActivo && <FichaAccesorio accesorio={accesorioActivo} />}
    </div>
  );
}

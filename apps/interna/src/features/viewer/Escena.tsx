"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, Html, Preload, useProgress } from "@react-three/drei";
import * as THREE from "three";

import {
  MODELOS,
  urlModelo,
  type ModeloDron,
} from "@/config/modelos3d";
import type { Pieza } from "@/lib/esquema";

import { CamaraControles } from "./CamaraControles";
import { ContornoPantalla } from "./ContornoPantalla";
import { EnsamblajeDemo } from "./EnsamblajeDemo";
import { EnsamblajeGLB } from "./EnsamblajeGLB";
import { Escenario } from "./Escenario";
import { LimiteError } from "./LimiteError";

/** Indicador de carga con porcentaje real del archivo. */
function Cargando() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex w-44 flex-col items-center gap-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-mxd-borde">
          <div
            className="h-full rounded-full bg-mxd-verde transition-[width] duration-200"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <span className="text-xs font-medium tracking-wide text-mxd-gris">
          Cargando modelo {Math.round(progress)}%
        </span>
      </div>
    </Html>
  );
}

export function Escena({
  catalogo,
  modelo,
}: {
  catalogo: Pieza[];
  modelo: ModeloDron;
}) {
  const config = MODELOS[modelo];
  const url = urlModelo(config.ensamble);

  const contenido = config.disponible ? (
    <LimiteError respaldo={<EnsamblajeDemo catalogo={catalogo} />}>
      <Suspense fallback={<Cargando />}>
        <EnsamblajeGLB url={url} catalogo={catalogo} />
      </Suspense>
    </LimiteError>
  ) : (
    <EnsamblajeDemo catalogo={catalogo} />
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 35, position: [1.8, 1.0, 2.3], near: 0.01, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      {/* Baja la resolucion temporalmente al orbitar: mantiene la fluidez en equipos modestos. */}
      <AdaptiveDpr pixelated />

      <Escenario />
      {contenido}
      <CamaraControles />
      {/* Contorno verde de la pieza seleccionada; tambien se encarga del render. */}
      <ContornoPantalla />
      <Preload all />
    </Canvas>
  );
}

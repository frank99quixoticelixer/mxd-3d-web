"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { COLORES_3D } from "@/config/marca";
import { EXPLOSION } from "@/config/modelos3d";
import type { Pieza } from "@/lib/esquema";
import { useVisor } from "./estado";
import { registroPiezas } from "./registro";
import {
  resolverPiezas,
  perteneceAlSku,
  skuDesdeObjeto,
  type PiezaEnEscena,
} from "./resolverPiezas";
import { TuercaDetallada } from "./TuercaDetallada";

/**
 * Toma cualquier raiz 3D (el GLB real o el ensamble de demostracion),
 * identifica sus piezas y les aplica interaccion: explosionado, resaltado,
 * aislamiento y seleccion.
 *
 * Es el corazon del visor y es independiente del origen del modelo:
 * por eso el modo demostracion se comporta exactamente igual que el modelo real.
 */
export function PlataformaPiezas({
  raiz,
  catalogo,
  modoDemo,
}: {
  raiz: THREE.Object3D;
  catalogo: Pieza[];
  modoDemo: boolean;
}) {
  const registrarEscena = useVisor((s) => s.registrarEscena);
  const seleccionar = useVisor((s) => s.seleccionar);
  const setHover = useVisor((s) => s.setHover);

  const resultado = useMemo(
    () => resolverPiezas(raiz, catalogo),
    [raiz, catalogo],
  );

  // resultado.piezas es estable mientras no cambien la raiz ni el catalogo,
  // asi que se usa directamente por closure (sin refs) en efectos y en useFrame.
  const piezas: PiezaEnEscena[] = resultado.piezas;

  // Publicar el registro vivo para que la camara pueda enfocar piezas.
  useEffect(() => {
    registroPiezas.actual = resultado.piezas;
    return () => {
      registroPiezas.actual = [];
    };
  }, [resultado]);

  // Publicar al estado global lo que se encontro dentro del modelo.
  useEffect(() => {
    const centros: Record<string, [number, number, number]> = {};
    const radios: Record<string, number> = {};
    for (const p of resultado.piezas) {
      centros[p.sku] = [p.centro.x, p.centro.y, p.centro.z];
      radios[p.sku] = p.radioPieza;
    }
    registrarEscena({
      skus: [...new Set(resultado.piezas.flatMap((p) => [p.sku, p.grupo]))],
      sinCoincidencia: resultado.sinCoincidencia,
      centros,
      radios,
      radio: resultado.radio,
      centroEnsamble: [
        resultado.centroEnsamble.x,
        resultado.centroEnsamble.y,
        resultado.centroEnsamble.z,
      ],
      tamanoEnsamble: [
        resultado.tamanoEnsamble.x,
        resultado.tamanoEnsamble.y,
        resultado.tamanoEnsamble.z,
      ],
      modoDemo,
    });
  }, [resultado, registrarEscena, modoDemo]);

  // ---------------------------------------------------------------
  // Resaltado y aislamiento (se ejecuta solo cuando cambia el estado,
  // no en cada cuadro).
  // ---------------------------------------------------------------
  const hover = useVisor((s) => s.hover);
  const seleccion = useVisor((s) => s.seleccion);
  const aislar = useVisor((s) => s.aislar);

  useEffect(() => {
    const colorHover = new THREE.Color(COLORES_3D.hover);

    for (const pieza of piezas) {
      const esSeleccionada = perteneceAlSku(pieza, seleccion);
      const esHover = perteneceAlSku(pieza, hover);
      const atenuada = aislar && seleccion !== null && !esSeleccionada;

      for (const g of pieza.materiales) {
        const m = g.material;

        // La pieza seleccionada conserva su aspecto: el contorno verde
        // lo dibuja ContornoPantalla, como en Blender.
        if (esHover && !esSeleccionada) {
          m.emissive.copy(colorHover);
          m.emissiveMap = null;
          m.emissiveIntensity = 0.22;
        } else {
          m.emissive.copy(g.emisivoOriginal);
          m.emissiveMap = g.mapaEmisivoOriginal;
          m.emissiveIntensity = g.intensidadEmisivaOriginal;
        }

        if (atenuada) {
          m.transparent = true;
          m.opacity = 0.1;
          m.depthWrite = false;
        } else {
          m.transparent = g.transparenteOriginal;
          m.opacity = g.opacidadOriginal;
          m.depthWrite = true;
        }
        m.needsUpdate = true;
      }
    }
  }, [hover, seleccion, aislar, piezas]);

  // Restaurar materiales al desmontar (evita dejar el modelo en gris
  // si el componente se recrea al cambiar de modelo).
  useEffect(() => {
    return () => {
      for (const pieza of piezas) {
        for (const g of pieza.materiales) {
          g.material.emissive.copy(g.emisivoOriginal);
          g.material.emissiveIntensity = g.intensidadEmisivaOriginal;
          g.material.emissiveMap = g.mapaEmisivoOriginal;
          g.material.opacity = g.opacidadOriginal;
          g.material.transparent = g.transparenteOriginal;
          g.material.depthWrite = true;
        }
      }
    };
  }, [piezas]);

  // ---------------------------------------------------------------
  // Despiece en dos tramos, interpolado suavemente en cada cuadro.
  //   0 -> 1: explosion
  //     posicion(t) = posicionBase + direccion * (radio * magnitudMaxima) * t * factor
  //   1 -> 2: cada pieza viaja de su posicion explotada a su celda
  //     en la cuadricula (filas y columnas), girando si hace falta.
  // ---------------------------------------------------------------
  const desplazamiento = useRef(0);
  const auxiliar = useMemo(() => new THREE.Vector3(), []);
  const auxiliarRot = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const objetivo = useVisor.getState().explosion;
    // Interpolacion exponencial independiente de la tasa de cuadros.
    const k = 1 - Math.exp(-EXPLOSION.suavizado * delta);
    desplazamiento.current += (objetivo - desplazamiento.current) * k;

    if (Math.abs(objetivo - desplazamiento.current) < 1e-4) {
      desplazamiento.current = objetivo;
    }

    const escala = resultado.radio * EXPLOSION.magnitudMaxima;
    const t = desplazamiento.current;
    const tExplosion = Math.min(t, 1);
    // Suavizado de entrada y salida para el acomodo en cuadricula.
    const u = Math.max(0, Math.min(1, t - 1));
    const tOrganizar = u * u * (3 - 2 * u);

    for (const pieza of piezas) {
      auxiliar
        .copy(pieza.direccion)
        .multiplyScalar(escala * tExplosion * pieza.factor)
        .add(pieza.posicionBase);
      if (tOrganizar > 0) {
        auxiliar.lerp(pieza.posicionOrganizada, tOrganizar);
        auxiliarRot
          .copy(pieza.cuaternionBase)
          .slerp(pieza.cuaternionOrganizado, tOrganizar);
        pieza.objeto.quaternion.copy(auxiliarRot);
      } else {
        pieza.objeto.quaternion.copy(pieza.cuaternionBase);
      }
      pieza.objeto.position.copy(auxiliar);
    }
  });

  // ---------------------------------------------------------------
  // Interaccion con el puntero
  // ---------------------------------------------------------------
  const manejarHover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const sku = skuDesdeObjeto(e.object);
    setHover(sku);
    if (sku) document.body.style.cursor = "pointer";
  };

  const manejarSalida = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(null);
    document.body.style.cursor = "auto";
  };

  const manejarClic = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const sku = skuDesdeObjeto(e.object);
    if (!sku) return;
    // Volver a hacer clic en la misma pieza la deselecciona.
    seleccionar(useVisor.getState().seleccion === sku ? null : sku);
  };

  // Limpieza del cursor al desmontar.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  return (
    <>
      <primitive
        object={raiz}
        onPointerOver={manejarHover}
        onPointerMove={manejarHover}
        onPointerOut={manejarSalida}
        onClick={manejarClic}
      />
      {/* El ensamble completo aun no trae el detalle jacket/spacers/tornillo
          de la tuerca (ver TuercaDetallada.tsx); se superpone aqui mientras
          tanto. No aplica al modo demostracion (geometria procedural). */}
      {!modoDemo && <TuercaDetallada piezas={piezas} />}
    </>
  );
}

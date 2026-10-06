"use client";

import { useMemo } from "react";
import * as THREE from "three";

import type { Pieza } from "@/lib/esquema";
import { PlataformaPiezas } from "./PlataformaPiezas";

/**
 * ENSAMBLE DE DEMOSTRACION
 *
 * Se muestra mientras no exista el archivo GLB real. Reproduce el grupo
 * propulsor del MX80 con solidos primitivos, uno por cada pieza del catalogo,
 * con el mismo SKU en la propiedad mxd_sku.
 *
 * Sirve para dos cosas:
 *   1. Que el sitio se pueda ejecutar y probar completo desde el primer minuto.
 *   2. Que puedas verificar toda la interaccion (clic, explosionado, aislar)
 *      antes de exportar desde Blender.
 *
 * Las proporciones son aproximadas y NO representan medidas reales.
 * Al colocar el GLB verdadero y poner disponible: true en src/config/modelos3d.ts,
 * este componente deja de usarse. Puedes borrarlo entonces sin afectar nada mas.
 */

interface DefinicionDemo {
  sku: string;
  color: string;
  metalico: number;
  rugosidad: number;
  construir: () => THREE.Object3D;
}

function malla(
  geometria: THREE.BufferGeometry,
  posicion: [number, number, number] = [0, 0, 0],
  rotacion: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(geometria);
  m.position.set(...posicion);
  m.rotation.set(...rotacion);
  return m;
}

const DEFINICIONES: DefinicionDemo[] = [
  {
    sku: "MX80-003", // Tuerca del balanceador
    color: "#B8C2BE",
    metalico: 0.9,
    rugosidad: 0.28,
    construir: () =>
      malla(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 6), [0, 0.292, 0]),
  },
  {
    sku: "MX80-001", // Balanceador superior
    color: "#8FA39B",
    metalico: 0.8,
    rugosidad: 0.32,
    construir: () => {
      const g = new THREE.Group();
      g.add(malla(new THREE.CylinderGeometry(0.046, 0.05, 0.016, 32), [0, 0.272, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 20), [0, 0.288, 0]));
      return g;
    },
  },
  {
    sku: "MX80-004", // Helices de fibra de carbono
    color: "#1E2422",
    metalico: 0.25,
    rugosidad: 0.42,
    construir: () => {
      const g = new THREE.Group();
      const pala = () => {
        const geo = new THREE.BoxGeometry(0.52, 0.007, 0.05);
        geo.translate(0.26, 0, 0);
        return geo;
      };
      g.add(malla(pala(), [0, 0.256, 0], [0, 0, 0.05]));
      g.add(malla(pala(), [0, 0.256, 0], [0, Math.PI, -0.05]));
      g.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 24), [0, 0.256, 0]));
      return g;
    },
  },
  {
    sku: "MX80-002", // Balanceador inferior
    color: "#8FA39B",
    metalico: 0.8,
    rugosidad: 0.32,
    construir: () =>
      malla(new THREE.CylinderGeometry(0.052, 0.056, 0.018, 32), [0, 0.238, 0]),
  },
  {
    sku: "MX80-006", // Cubierta de motor
    color: "#0F8A4C",
    metalico: 0.15,
    rugosidad: 0.45,
    construir: () => {
      const g = new THREE.Group();
      g.add(malla(new THREE.CylinderGeometry(0.096, 0.1, 0.05, 40), [0, 0.2, 0]));
      g.add(malla(new THREE.TorusGeometry(0.099, 0.006, 10, 40), [0, 0.176, 0], [Math.PI / 2, 0, 0]));
      return g;
    },
  },
  {
    sku: "MX80-007", // Motor
    color: "#9AA5A1",
    metalico: 0.95,
    rugosidad: 0.22,
    construir: () => {
      const g = new THREE.Group();
      g.add(malla(new THREE.CylinderGeometry(0.086, 0.086, 0.062, 36), [0, 0.128, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.07, 0.07, 0.024, 36), [0, 0.09, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 20), [0, 0.185, 0]));
      return g;
    },
  },
  {
    sku: "MX80-005", // Soporte de motor
    color: "#C9D3CF",
    metalico: 0.65,
    rugosidad: 0.35,
    construir: () => {
      const g = new THREE.Group();
      g.add(malla(new THREE.BoxGeometry(0.2, 0.022, 0.14), [-0.02, 0.064, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.046, 0.046, 0.05, 28), [-0.12, 0.04, 0], [0, 0, Math.PI / 2]));
      g.add(malla(new THREE.BoxGeometry(0.03, 0.05, 0.1), [0.05, 0.04, 0]));
      return g;
    },
  },
  {
    sku: "MX80-008", // Tubo de fibra de carbono
    color: "#23282A",
    metalico: 0.3,
    rugosidad: 0.38,
    construir: () =>
      malla(
        new THREE.CylinderGeometry(0.036, 0.036, 1.05, 32),
        [-0.65, 0.04, 0],
        [0, 0, Math.PI / 2],
      ),
  },
];

export function EnsamblajeDemo({ catalogo }: { catalogo: Pieza[] }) {
  const raiz = useMemo(() => {
    const contenedor = new THREE.Group();
    contenedor.name = "MXD_Demo";

    for (const def of DEFINICIONES) {
      const objeto = def.construir();
      objeto.name = def.sku;
      objeto.userData.mxd_sku = def.sku;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.color),
        metalness: def.metalico,
        roughness: def.rugosidad,
      });

      objeto.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          m.material = material;
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });

      contenedor.add(objeto);
    }

    // Centrar el conjunto en el origen.
    const caja = new THREE.Box3().setFromObject(contenedor);
    const centro = caja.getCenter(new THREE.Vector3());
    for (const hijo of contenedor.children) hijo.position.sub(centro);

    return contenedor;
  }, []);

  return <PlataformaPiezas raiz={raiz} catalogo={catalogo} modoDemo />;
}

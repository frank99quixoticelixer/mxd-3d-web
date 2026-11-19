# Estudio MX80

Herramienta interna para producir imágenes (y después video) publicitarias
del MX80: el dron desplegando los brazos y asperjando, el despiece vertical,
el dron sobre un campo de maíz y el **taller**, donde se personaliza el dron.

Funciona como un juego de autos: arranca en el **taller** (garaje con
plataforma giratoria), donde se elige el color: Original, Rojo Case, Azul New
Holland o Negro New Holland. Se pinta solo lo que en el modelo es amarillo
(cubiertas de motor, carcasa frontal, seguros de manguera), detectado por el
color del material (`AMARILLO_CARROCERIA` en `config.ts`). Con **Ir al campo**
se baja el mapa y se hacen las tomas; desde el campo se puede volver al taller.

Corre en local. No se despliega.

```
cd apps/estudio
npm install --no-workspaces
npm run dev        # http://localhost:3003
```

`predev` y `prebuild` copian el modelo del dron desde `apps/vitrina/protegido`
(`scripts/sincronizar-modelo.mjs`): el GLB vive una sola vez en git, en la
vitrina.

## Qué hay

| Parte | Dónde |
|---|---|
| Todo lo ajustable (modelo, colores, etiquetas, formatos, despiece, vuelo) | `src/estudio/config.ts` |
| El dron: despliegue, rotores, aspersión, despiece vertical, colores | `src/estudio/Dron.tsx` |
| Cielo, sol, piso o campo, cámara, captura | `src/estudio/Escena.tsx` |
| Taller: garaje y plataforma giratoria | `src/estudio/Taller.tsx` |
| Panel de mandos, tomas y lote | `src/estudio/Panel.tsx` |
| Exportación (una imagen, lote en zip) | `src/estudio/exportar.ts` |
| Simulador de vuelo: integración | `src/estudio/vuelo/` |
| Simulador de vuelo: física y perfil MX80 | `drone_sim_pkg/` |
| Aspersión: copia de `apps/vitrina/src/features/viewer/aspersion/` | `src/estudio/aspersion/` |

La coreografía del dron (fases del despliegue, signo de plegado, apertura de
palas, rotores) es la misma del visor de la vitrina (`EscenaFrame.tsx`). Un
cambio ahí se replica aquí. La única diferencia a propósito: aquí nada se
amortigua, para que cada toma salga igual cada vez que se exporta.

## Simulador de vuelo (pestaña Pilotar)

En el campo, la pestaña **Pilotar** vuela el MX80 con `drone_sim_pkg/`: un
simulador 6-DOF con control en cascada tipo PX4 (física a 1 kHz, independiente
de los FPS). Ecuaciones en `drone_sim_pkg/MATEMATICAS.md`; pruebas con
`cd drone_sim_pkg && node --test`.

- **Perfil `mx80`** (`drone_sim_pkg/src/drone-profiles.js`): cada dato dice su
  fuente. Confirmados: 2640 mm entre ejes, hélices de 63 in, 141.2 kg de
  despegue (61.2 kg en vacío + 80 L), ascenso 5 m/s, descenso 3 m/s, 10 m/s de
  operación. Siguen estimados **[EST]**: inercias, CG (0.6 m), RPM con carga,
  constante de tiempo del motor. Cuando haya CAD o banco de pruebas, se cambian ahí.
- **Carga**: el deslizador del tanque (0–80 L) cambia la masa (`masaMX80`).
- **Orden de rotores** = motores del manual: 1 frente-derecha CW (M1), 2
  atrás-derecha CCW (M4), 3 atrás-izquierda CW (M3), 4 frente-izquierda CCW (M2).
- **Teclas**: Enter armar/desarmar · W/S subir/bajar (S sostenida en tierra 2 s
  apaga) · A/D girar · flechas mover · 1/2/3 Acro/Ángulo/Posición · Espacio
  acelerador a estacionario · R reiniciar.
- Integración: `src/estudio/vuelo/Piloto.tsx` (mueve el dron, empuje real a los
  rotores, cámara de persecución) y `vuelo/simulador.ts` (vista tipada del
  paquete). El frente del GLB mira a -X: se corrige con -90° de yaw.
- Límites del simulador: sin batería (no hay autonomía), suelo plano en y = 0,
  sin obstáculos del mapa. Ver `MATEMATICAS.md` §14.

## Mapas

Dos mapas, que se eligen en la pantalla **Mapas** (`ENTORNOS` en
`src/estudio/config.ts`). En los dos, la zona de despegue está en el origen y es
plana (y = 0): ahí va el dron.

| Mapa | Fuente | GLB | Triángulos dibujados |
|---|---|---|---|
| Valle agrícola | `entorno_agricola_v2.blend` | `public/campo/entorno_agricola_v2_web.glb` (4.6 MB) | 11.9 M |
| Claro de montaña | `entorno_montana_v2.blend` | `public/campo/entorno_montana_v2_web.glb` (5.2 MB) + mapa de alturas | 17.8 M |

Para actualizar o agregar uno:

1. El `.blend` va en `public/blender/entornos/` (no entra a git: vive en
   Drive). Metros, Z hacia arriba, zona de despegue plana en el origen.
2. Exportar (Blender sin interfaz):
   ```
   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b public/blender/entornos/entorno_montana_v2.blend -P scripts/exportar_entorno.py -- public/campo/entorno_montana_v2.glb
   ```
   El script (ver su encabezado) deja fuera cámaras, luces y la colección
   **Cielo**, pone su color a los materiales procedurales, conserva las hojas
   con textura, **ralea la vegetación por distancia** y, si el mapa tiene
   relieve, escribe `<salida>_alturas.bin/.json` para el simulador. Cada mapa
   tiene su perfil en `PERFILES` (por prefijo del nombre del `.blend`); sin
   raleo, la montaña dibujaba 95 M de triángulos.
3. Comprimir sin simplificar (simplificar deformaría el terreno respecto al
   mapa de alturas):
   ```
   npx --yes @gltf-transform/cli optimize <ruta absoluta>.glb <ruta absoluta>_web.glb --compress meshopt --texture-compress webp --texture-size 2048 --simplify false --join false --flatten false --instance false --palette false
   ```
   y renombrar el mapa de alturas a `<nombre>_web_alturas.*`.
4. Darlo de alta en `ENTORNOS` (`config.ts`).

Al cargar, las hojas usan recorte alfa en vez de transparencia y se apaga la
transmisión (vidrio), que en three.js obliga a dibujar la escena dos veces.

## Especificación (lo que falta, en orden)

1. **Maíz que reacciona al dron.** Las plantas bajo el dron se doblan hacia
   afuera según su distancia al rotor (downwash, como un uniform del shader
   de las hojas) y se mecen con el viento. Las gotas ya caen hasta la altura
   del follaje (`Altura del follaje` en el panel). Se hace en cuanto llegue el
   GLB del campo.
2. **Tomas guardadas y exportación por lote.** Hecho: cada toma guarda cámara,
   estado del dron, hora del día y color. El lote exporta todas las tomas ×
   colores × formatos en un zip (`toma/color/formato.png`). Las tomas se
   respaldan en JSON.
3. **Etiquetas con datos.** Hecho: puntos sobre la pieza con su dato (tanque
   de 80 L, aspersor centrífugo doble, batería de 2 052 Wh, LiDAR, radar), en
   pantalla y dibujados en la imagen exportada. Se editan en `ETIQUETAS`
   (`config.ts`). Solo datos públicos: es material de venta.
4. **Video.** Línea de tiempo con fotogramas clave (despliegue, aspersión,
   despiece, cámara) exportada cuadro por cuadro a MP4 (WebCodecs) o a
   secuencia PNG. Nunca grabar en tiempo real.
5. **Calidad final.** Postproceso (SSAO, bloom leve, profundidad de campo,
   SMAA) y, para fotos fijas, path tracing (`@react-three/gpu-pathtracer`).
6. Después: logo y QR como marca de agua, realidad aumentada (USDZ), giro de
   360°.

## Licencias

HDRI, texturas y modelos de maíz: CC0 (Poly Haven, ambientCG) o comprados con
licencia comercial. El modelo del generador tiene la licencia pendiente: no se
usa en publicidad hasta revisarla.

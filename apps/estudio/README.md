# Estudio MX80

Herramienta interna para producir imágenes (y después video) publicitarias
del MX80: el dron desplegando los brazos y asperjando, el despiece vertical,
el dron sobre un campo de maíz y el modo **Personaliza tu dron** con tres
combinaciones de color.

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
| Panel de mandos, tomas y lote | `src/estudio/Panel.tsx` |
| Exportación (una imagen, lote en zip) | `src/estudio/exportar.ts` |
| Aspersión: copia de `apps/vitrina/src/features/viewer/aspersion/` | `src/estudio/aspersion/` |

La coreografía del dron (fases del despliegue, signo de plegado, apertura de
palas, rotores) es la misma del visor de la vitrina (`EscenaFrame.tsx`). Un
cambio ahí se replica aquí. La única diferencia a propósito: aquí nada se
amortigua, para que cada toma salga igual cada vez que se exporta.

## El campo de maíz

1. Exporta el campo desde Blender a GLB, en metros, con Y hacia arriba y el
   piso en y = 0.
2. Optimízalo: `cd apps/vitrina && npm run glb:optimizar -- campo.glb ../estudio/public/campo/campo_v1_web.glb`.
3. En `src/estudio/config.ts`, cambia `GLB_CAMPO` a `"/campo/campo_v1_web.glb"`.

`public/campo/` no está en `.gitignore`: el campo vive solo aquí. Si pesa
más de 25 MB, conviene guardarlo en Drive y dejarlo fuera de git.

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

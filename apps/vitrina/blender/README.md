# Renders automaticos de piezas

Genera el render de cada pieza del catalogo (menos los tornillos) a partir del
archivo de Blender del dron, sin abrir Blender.

## Uso

1. Pon aqui el `.blend` del dron completo. Si hay varios, se usa el mas
   reciente. El `.blend` no se sube a git.
2. Desde `apps/vitrina`:

   ```
   npm run renders:generar
   ```

3. Los renders quedan en `public/renders/<SKU>.jpg`. Revisalos y commitealos
   como cualquier imagen (`git add apps/vitrina/public/renders/MX80-007.jpg`).

Opciones:

```
npm run renders:generar -- --solo=MX80-007,MX80-013     # solo esas piezas
npm run renders:generar -- --archivo=blender/otro.blend # otro archivo
npm run renders:generar -- --sin-copiar                 # solo previsualizar en blender/salida/
```

Tambien acepta un `.glb` del dron en lugar del `.blend`.

## Que hace

- Decide que objetos forman cada pieza con las mismas reglas del visor de la
  ficha (`features/viewer/componentes.ts`): el render y el 3D muestran lo mismo.
  Una pieza que el dron lleva varias veces (los motores de los cuatro brazos) se
  renderiza una vez.
- Por cada pieza oculta todo lo demas, encuadra la camara sobre ella y
  renderiza a 1600 x 800, con fondo de estudio gris oscuro y vista en tres
  cuartos, como los renders que ya tiene el catalogo.
- Usa su propia camara, luces, piso y fondo. **Nunca guarda el `.blend`**.
- Omite las piezas que son tornillos.
- Al terminar avisa que piezas no encontro en el archivo: casi siempre es que
  sus `nombresBlender` en `src/data/mx80.ts` no coinciden con los nombres de
  los objetos en Blender.

La ficha usa el render en cuanto existe el archivo: si una pieza no declara
`imagen` en `mx80.ts`, el catalogo toma `public/renders/<SKU>.jpg`.

## Requisitos

- Blender instalado. En Windows se busca solo en
  `C:\Program Files\Blender Foundation\`. En otro lugar, define la variable
  `BLENDER` con la ruta a `blender.exe`.
- La primera vez, `npx` descarga `tsx` para correr el script.

## Archivos

| Archivo | Que es |
|---------|--------|
| `render_piezas.py` | Corre dentro de Blender: encuadra y renderiza cada pieza |
| `../scripts/generar_renders.ts` | Arma la lista de piezas, llama a Blender y copia los renders |
| `salida/` | Renders y mapa de la ultima corrida (no va a git) |

# drone-sim-core

Simulador 6-DOF de multirrotor con control en cascada estilo PX4, listo para integrarse en tu propio entorno o motor gráfico. Es el mismo modelo del prototipo web, separado del render.

- **Física:** cuerpo rígido con cuaterniones, empuje y par por rotor, dinámica de motor, arrastre, viento, efecto suelo, empuje dinámico, efecto giroscópico, choques.
- **Modos de vuelo:** Acro (rates), Angle (autonivelado), Posición (hold).
- **Dos perfiles:** `custom` (todo configurable) y `mx80` (MXD MX80 con Hobbywing X15).
- **Armado/desarmado tipo QGroundControl:** al aterrizar manteniendo **S** (bajar), los motores se apagan tras 2 s; también incluye gesto de armado y timeouts.
- **Sin dependencias.** JavaScript ES module (navegador o Node ≥ 18).

Las ecuaciones completas están en **[MATEMATICAS.md](MATEMATICAS.md)**.

## Estructura

```
drone_sim_pkg/
├── src/
│   ├── drone-sim-core.js     # física, control, asignación, armado (independiente del motor gráfico)
│   ├── drone-profiles.js     # perfiles 'custom' y 'mx80'  ← aquí editas parámetros
│   └── three-adapter.js      # opcional: une el simulador con un GLB en three.js
├── examples/
│   └── three-glb-example.html  # ejemplo mínimo con GLB, teclado y HUD
├── test/core.test.mjs        # pruebas (node --test)
├── MATEMATICAS.md
└── package.json
```

## Uso mínimo

```js
import { DroneSim } from './src/drone-sim-core.js';
import { makeConfig } from './src/drone-profiles.js';

// Modo 1: MX80
const sim = new DroneSim(makeConfig('mx80'), {
  groundHeightAt: (n, e) => 0,            // altura de tu terreno [m] (opcional)
  obstacles: [],                          // cajas NED (opcional)
  onEvent: ev => console.log(ev),         // armed, disarmed{reason}, landed, takeoff, crash...
});

// Modo 2: configurable (todo lo que no pongas se toma del perfil 'custom')
const sim2 = new DroneSim(makeConfig('custom', {
  vehicle: { frame: 'hexaX', mtow: 40, wheelbase: 1800, propIn: 30, tmaxKgf: 15, rpmMax: 4500, motorMass: 1.2 },
  env: { altitude: 1800, windSpd: 4, windDir: 270, gust: 2 },
  control: { tiltMax: 25, vMax: 10 },
}));

sim.setMode('pos');            // 'acro' | 'angle' | 'pos'
sim.arm();                     // o gesto: S + D sostenidos 1 s en tierra

// En tu bucle de render:
function onFrame(dt) {
  sim.setInput({
    thr:   throttle01,         // 0..1  (Acro/Angle)
    climb: keyW - keyS,        // -1..1 (Posición)
    yaw:   keyD - keyA,        // -1..1
    pitch: up - down,          // -1..1 (adelante +)
    roll:  right - left,       // -1..1 (derecha +)
  });
  const events = sim.step(dt); // física a 1 kHz interna, independiente de los FPS
  const s = sim.getState();    // posición NED, cuaternión, RPM por rotor, armed, landed...
}
```

### Usar los parámetros de tu entorno en el MX80

Sobrescribe solo lo que ya tienes (lo marcado **[EST]** en `drone-profiles.js` es lo que conviene reemplazar):

```js
const cfg = makeConfig('mx80', {
  vehicle: {
    mtow: 147.2,                      // si usas esparcido
    wheelbase: 2430,                  // tu dato real [mm]
    inertia: [31.2, 30.8, 55.4],      // de tu CAD [kg·m²]
    gearHeight: 0.55,                 // CG sobre el suelo [m]
    rotors: [                         // posiciones reales FRD [m] y giro (+1 CW), en el orden de tus hélices
      { x:  0.86, y:  0.86, spin: +1 }, { x: -0.86, y:  0.86, spin: -1 },
      { x: -0.86, y: -0.86, spin: +1 }, { x:  0.86, y: -0.86, spin: -1 },
    ],
  },
});
```

Los números de este ejemplo son ilustrativos.

## Integrar tu GLB (three.js)

```js
import { bindThreeObject, makeChaseCamera } from './src/three-adapter.js';

const gltf = await new THREE.GLTFLoader().loadAsync('models/mx80.glb');
scene.add(gltf.scene);
const binding = bindThreeObject(THREE, sim, gltf.scene, {
  yawOffsetDeg: 0,              // 180 si el frente del GLB mira a +Z
  cgOffset: [0, 0.35, 0],       // origen del GLB -> CG, en ejes locales del modelo [m]
  scale: 1,                     // si el GLB no está en metros
  propNodes: ['Prop_FR', 'Prop_BR', 'Prop_BL', 'Prop_FL'],   // EN EL ORDEN DE ROTORES (ver abajo)
  propAxis: 'y',
});
const chase = makeChaseCamera(THREE, camera, sim);

// por frame, después de sim.step(dt):
binding.update(dt); chase(dt);
```

**Orden de rotores del quad X:** 1 frente-derecha (CW), 2 atrás-derecha (CCW), 3 atrás-izquierda (CW), 4 frente-izquierda (CCW). Si tu dron gira al revés en yaw o las hélices giran en sentido contrario, revisa este orden y el campo `spin`.

### Otros motores

El núcleo es JavaScript puro. Para Unity, Unreal o Godot (C#, C++, GDScript) porta `drone-sim-core.js` siguiendo MATEMATICAS.md. Las conversiones de posición y cuaternión ya están resueltas en `Frames` (§12 de MATEMATICAS.md).

## Ejecutar ejemplo y pruebas (Windows PowerShell)

```powershell
cd ruta\a\drone_sim_pkg
node --test                 # 8 pruebas: vuelo, aterrizaje con apagado, gestos, falla de motor, marcos
npx --yes http-server -c-1 -p 8080 .
# abrir http://localhost:8080/examples/three-glb-example.html
```

Los módulos ES no cargan desde `file://`, así que el ejemplo necesita servirse por HTTP. Copia tu modelo a `models/mx80.glb` (si no existe, se dibuja un modelo de reemplazo) y llena `MODEL.propNodes` en el HTML.

**Controles del ejemplo:**
- **Enter:** armar/desarmar.
- **W/S:** subir/bajar. Mantener **S** en tierra 2 s apaga los motores.
- **A/D:** yaw.
- **Flechas:** mover.
- **1/2/3:** modo.
- **F:** falla del motor 1.
- **R:** reiniciar.

## Parámetros de seguridad (`safety`)

| Clave | Defecto | Efecto |
|---|---|---|
| `landDisarmHoldSec` | 2.0 | segundos manteniendo *bajar* en tierra para apagar motores |
| `armGesture` / `armHoldSec` | true / 1.0 | armar con *bajar* + yaw derecha; desarmar con *bajar* + yaw izquierda |
| `autoDisarmAfterLandSec` | null | desarme automático tras aterrizar, sin stick (PX4 `COM_DISARM_LAND`) |
| `preflightDisarmSec` | 10 | desarmar si se armó y no despegó (PX4 `COM_DISARM_PRFLT`) |
| `crashVz`, `crashVh`, `crashTiltDeg` | 3, 3, 45 | umbrales de choque al tocar el suelo |

## Estado verificado

- `node --test`: 8/8 pruebas pasan. Cubren despegue, mantener altura, aterrizaje con apagado al mantener S, que no se apague si sueltas S antes, gesto de armado, timeout sin despegar, modos Angle/Acro, falla de motor (octo sobrevive, quad no) y conversiones de marcos.
- Ejemplo con GLB probado en Chrome sin pantalla. Con un GLB de prueba con nodos `Prop_*`: carga, vuela y apaga motores al mantener S.
- Limitaciones: ver MATEMATICAS.md §14. Lo marcado **[EST]** en el perfil MX80 no está confirmado.

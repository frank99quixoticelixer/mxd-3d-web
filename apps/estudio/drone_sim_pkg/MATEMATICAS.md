# Modelo matemático del simulador de multirrotor

Este documento describe **todas** las ecuaciones que implementa `src/drone-sim-core.js`, para que puedas portarlas a otro motor (Unity, Unreal, Godot, C/C++) o verificarlas.

Notación: negritas = vectores; $R$ = matriz de rotación cuerpo→NED; $\odot$ = producto elemento a elemento; $[\cdot]_i$ = componente $i$.

---

## 1. Marcos de referencia y convenciones

| Marco | Ejes | Uso |
|---|---|---|
| Inercial **NED** | $x$ Norte, $y$ Este, $z$ Abajo | posición $\mathbf{p}$ y velocidad $\mathbf{v}$ |
| Cuerpo **FRD** | $x$ Frente, $y$ Derecha, $z$ Abajo | fuerzas, momentos, $\boldsymbol{\omega}$ |

- Altitud $= -p_z$. Gravedad $\mathbf{g} = [0,\,0,\,g]^T$, $g = 9.80665\ \mathrm{m/s^2}$.
- Actitud con cuaternión unitario $\mathbf{q} = [q_w, q_x, q_y, q_z]$ (rotación cuerpo→NED). Se evita el gimbal lock de los ángulos de Euler.
- Euler ZYX solo para mostrar o para referencias de modo Angle: $\phi$ roll, $\theta$ pitch, $\psi$ yaw.
- $\psi$ positivo = nariz hacia el Este (giro horario visto desde arriba).

$$
R(\mathbf q)=\begin{bmatrix}
1-2(q_y^2+q_z^2) & 2(q_xq_y-q_wq_z) & 2(q_xq_z+q_wq_y)\\
2(q_xq_y+q_wq_z) & 1-2(q_x^2+q_z^2) & 2(q_yq_z-q_wq_x)\\
2(q_xq_z-q_wq_y) & 2(q_yq_z+q_wq_x) & 1-2(q_x^2+q_y^2)
\end{bmatrix}
$$

$$\phi=\operatorname{atan2}(R_{32},R_{33}),\quad \theta=-\arcsin R_{31},\quad \psi=\operatorname{atan2}(R_{21},R_{11})$$

---

## 2. Geometría y numeración de rotores

Para $N$ rotores en configuración X (sin rotor sobre el eje $x$):

$$\alpha_i = \frac{2\pi (i-1)}{N} + \frac{\pi}{N},\qquad \mathbf r_i = L\,[\cos\alpha_i,\ \sin\alpha_i,\ 0]^T,\qquad L=\frac{\text{distancia diagonal}}{2}$$

Sentido de giro alternado: $s_i = +1$ (CW visto desde arriba) para $i$ impar y $-1$ (CCW) para $i$ par.

**Quad X (MX80):**

| Rotor | Ángulo | Posición | Giro | Nombre típico en el GLB |
|---|---|---|---|---|
| 1 | 45° | frente-derecha | CW | `Prop_FR` |
| 2 | 135° | atrás-derecha | CCW | `Prop_BR` |
| 3 | 225° | atrás-izquierda | CW | `Prop_BL` |
| 4 | 315° | frente-izquierda | CCW | `Prop_FL` |

Si tu modelo usa otro orden o posiciones reales del CAD, pásalas en `vehicle.rotors = [{x, y, spin}, ...]` (FRD, metros). Entonces todo lo demás (inercia, asignación) usa esas posiciones.

---

## 3. Parámetros derivados de los datos del dron

### 3.1 Densidad del aire (ISA, troposfera)

$$\rho(h) = 1.225\,\left(1 - 2.25577\times10^{-5}\,h\right)^{4.2559}\quad[\mathrm{kg/m^3}]$$

### 3.2 Coeficiente de empuje

Con el empuje máximo del datasheet $T_{max}$ (kgf) y las RPM a ese empuje:

$$\Omega_{max}=\frac{2\pi\,\text{rpm}_{max}}{60},\qquad k_T=\frac{T_{max}\,g}{\Omega_{max}^2}\cdot\frac{\rho}{\rho_{ref}}$$

$\rho_{ref}$ es la densidad a la que se midió el datasheet (por defecto 1.225). Con esto, el empuje máximo disminuye con la altitud.

> **Si solo tienes la potencia del motor:** la teoría de cantidad de movimiento da $T \approx (FM\cdot P)^{2/3}(2\rho A)^{1/3}$ con $A=\pi R^2$ y $FM\approx0.6\text{–}0.75$. Úsala solo como cota: con la potencia **nominal** (no la máxima) subestima mucho el empuje máximo. Para el X15, 5000 W nominales dan ≈ 40 kgf contra 72 kgf del datasheet. Siempre que exista, usa el empuje del datasheet.

### 3.3 Par de reacción de la hélice

$$Q = k_Q\Omega^2,\qquad \frac{k_Q}{k_T}=\frac{C_P}{C_T}\cdot\frac{D}{2\pi}\approx 0.07\,D\quad[\mathrm m]$$

(con $C_P/C_T\approx0.44$, típico de hélices de multirrotor). Se puede fijar con `vehicle.kQkT` si tienes el dato medido: par a empuje máximo ÷ empuje máximo.

### 3.4 Ralentí

$\Omega_{min} = 0.12\,\Omega_{max}$ (configurable con `idleFrac`). Entonces $T_{min}=k_T\Omega_{min}^2$.

### 3.5 Inercia (si no la das desde CAD)

El cuerpo central es una caja de lado $s=\max(0.35\,w_b,\,0.06)$ y altura $h=0.3\,s$, con masa $m_b = m - N m_m$. Cada brazo es una masa puntual $m_m$ en $\mathbf r_i$:

$$J_{xx}=\frac{m_b(s^2+h^2)}{12}+\sum_i m_m r_{y,i}^2,\quad J_{yy}=\frac{m_b(s^2+h^2)}{12}+\sum_i m_m r_{x,i}^2,\quad J_{zz}=\frac{m_b\,2s^2}{12}+\sum_i m_m (r_{x,i}^2+r_{y,i}^2)$$

Se asume simetría: productos de inercia nulos. **Si tienes la inercia del CAD, pásala en `vehicle.inertia`**: es el parámetro que más afecta la respuesta en roll y pitch.

### 3.6 Otros

| Símbolo | Expresión (si no se da) | Significado |
|---|---|---|
| $\tau$ | $0.012 + 0.0025\,D_{in}$ [s] | constante de tiempo motor+ESC+hélice |
| $J_r$ | $\tfrac{1}{4}m_m R^2/3$ | inercia de rotor (hélice como barra) |
| $C_dA$ | $[0.25,\ 0.25,\ 0.5]\,w_b^2$ | áreas de arrastre en ejes cuerpo |
| $K_\omega$ | $0.01\,m\,w_b^2$ | amortiguamiento rotacional |
| $h_g$ | $\max(0.12\,w_b,\,0.03)$ | altura del CG con el dron apoyado |
| $r_c$ | $L + 0.5R$ | radio de colisión |

---

## 4. Modelo de rotor

### 4.1 Empuje y par por rotor

$$T_i = \eta_i\,k_T\,\Omega_i^2\,f_{GE}\,f_{dyn,i},\qquad Q_i=\eta_i\,k_Q\,\Omega_i^2\,f_{dyn,i}$$

$\eta_i\in[0,1]$ es la efectividad del rotor: 1 sano, 0 falla total.

### 4.2 Efecto suelo (Cheeseman–Bennett)

$$f_{GE}=\min\!\left(\frac{1}{1-\left(\frac{R}{4z_r}\right)^2},\ 1.3\right),\qquad z_r=\max(\text{AGL}_{CG}+h_{rot},\ 0.6R)$$

### 4.3 Empuje dinámico (pérdida con velocidad axial)

La velocidad del aire que entra por arriba del disco es $V_{ax} = -[\,R^T(\mathbf v-\mathbf w)\,]_z$. Con la relación de avance $J=V_{ax}/(nD)$, donde $n=\Omega/2\pi$:

$$f_{dyn}=\operatorname{clamp}\!\left(1-\frac{J}{0.75},\ 0,\ 1.15\right)$$

Esto limita la velocidad de ascenso y la velocidad máxima en vuelo inclinado, sin necesidad de imponer un tope artificial.

### 4.4 Dinámica del motor (primer orden)

$$\dot\Omega_i = \frac{\Omega_{cmd,i}-\Omega_i}{\tau}$$

Desarmado: $\Omega_{cmd}=0$, así que el rotor se detiene con la constante $\tau$.

---

## 5. Dinámica de cuerpo rígido 6-DOF

### 5.1 Fuerzas en el cuerpo

$$\mathbf v_b = R^T(\mathbf v - \mathbf w),\qquad
\mathbf F_b = \begin{bmatrix}0\\0\\-\sum_i T_i\end{bmatrix} - \tfrac12\rho\,C_dA\odot|\mathbf v_b|\odot\mathbf v_b$$

### 5.2 Momentos en el cuerpo

$$
\mathbf M_b=\begin{bmatrix}-\sum_i r_{y,i}T_i\\ \sum_i r_{x,i}T_i\\ -\sum_i s_iQ_i\end{bmatrix}
-\boldsymbol\omega\times\begin{bmatrix}0\\0\\h_r\end{bmatrix}
-\begin{bmatrix}0\\0\\J_r\sum_i s_i\eta_i\dot\Omega_i\end{bmatrix}
-K_\omega\boldsymbol\omega,
\qquad h_r=J_r\sum_i s_i\eta_i\Omega_i
$$

Términos, en orden: brazo de palanca del empuje; par de reacción aerodinámico; efecto giroscópico de los rotores; reacción por acelerar los rotores; amortiguamiento.

### 5.3 Ecuaciones de movimiento

$$
\dot{\mathbf p}=\mathbf v,\qquad
\dot{\mathbf v}=\frac{1}{m}R\,\mathbf F_b+\mathbf g,\qquad
\dot{\mathbf q}=\tfrac12\,\mathbf q\otimes\begin{bmatrix}0\\ \boldsymbol\omega\end{bmatrix},\qquad
J\dot{\boldsymbol\omega}=\mathbf M_b-\boldsymbol\omega\times J\boldsymbol\omega
$$

Con $J$ diagonal:

$$\dot p=\frac{M_x-(J_{zz}-J_{yy})qr}{J_{xx}},\quad \dot q=\frac{M_y-(J_{xx}-J_{zz})rp}{J_{yy}},\quad \dot r=\frac{M_z-(J_{yy}-J_{xx})pq}{J_{zz}}$$

Vector de estado: $\mathbf x=[\mathbf p,\ \mathbf v,\ \mathbf q,\ \boldsymbol\omega,\ \Omega_1\dots\Omega_N]\in\mathbb R^{13+N}$.

---

## 6. Integración numérica

- Runge-Kutta de 4.º orden con paso fijo $\Delta t = 1$ ms. El cuaternión se renormaliza después de cada paso.
- El controlador corre a 500 Hz, con retención de orden cero entre muestras: el comando se mantiene constante hasta la siguiente.
- `step(dtFrame)` acumula el tiempo del frame y ejecuta los pasos fijos que quepan, hasta `maxSubsteps` (100) por llamada. **La física no depende de los FPS del render.**

---

## 7. Suelo, choques y obstáculos

- El suelo está a la altura $z_g(n,e)$ que regresa tu callback `groundHeightAt(n, e)`; por defecto es 0. Hay contacto si $\text{alt}\le z_g+h_g$.
- Al tocar el suelo hay **choque** si $v_z>3$ m/s, si $|\mathbf v_{xy}|>3$ m/s o si la inclinación es mayor a 45° (todo configurable en `safety`).
- En reposo se anulan $\mathbf v$ y $\boldsymbol\omega$, y la actitud se nivela conservando el yaw. Despega cuando el empuje supera al peso.
- Obstáculos: cajas alineadas a NED $\{n_0,n_1,e_0,e_1,a_0,a_1\}$. Hay colisión si la distancia del CG a la caja es menor que $r_c$.

---

## 8. Controlador en cascada (estilo PX4)

### 8.1 Mapeo de entradas

Sticks normalizados: $u_{thr}\in[0,1]$; $u_{climb},u_{yaw},u_{pitch},u_{roll}\in[-1,1]$, con zona muerta de 5 %.

En Acro y Angle, el throttle es lineal en velocidad de motor (como un ESC real):

$$\Omega_{thr}=\Omega_{min}+u_{thr}(\Omega_{max}-\Omega_{min}),\qquad T_{col}=N k_T\Omega_{thr}^2$$

El throttle de hover es $u_{hover}=(\Omega_{hover}-\Omega_{min})/(\Omega_{max}-\Omega_{min})$, con $\Omega_{hover}=\sqrt{mg/(Nk_T)}$.

### 8.2 Modos

| Modo | Sticks | Lazos activos |
|---|---|---|
| **Acro** | rates: $\omega_{sp}=[\,e(u_r)\,\omega_{max},\ -e(u_p)\,\omega_{max},\ 0.6\,e(u_y)\,\omega_{max}]$, con $e(x)=x(1-k)+x^3k$ | rate |
| **Angle** | $\phi_{sp}=u_r\theta_{max}$, $\theta_{sp}=-u_p\theta_{max}$, $\dot\psi_{sp}=u_y\dot\psi_{max}$ | actitud → rate |
| **Posición** | velocidad horizontal en el marco del yaw, velocidad vertical; sticks al centro = mantener posición | posición → velocidad → actitud → rate |

### 8.3 Posición → velocidad (modo Posición)

- Con stick horizontal activo: $v_{sp,n}=(u_p\cos\psi-u_r\sin\psi)v_{max}$ y $v_{sp,e}=(u_p\sin\psi+u_r\cos\psi)v_{max}$.
- Al soltar: frena con $v_{sp}=0$. Cuando $|\mathbf v_{xy}|<0.3$ m/s fija $\mathbf p_{sp}=\mathbf p$ y aplica $\mathbf v_{sp}=K_{p,pos}(\mathbf p_{sp}-\mathbf p)$, saturada a $v_{max}$.
- En vertical: $v_{sp,z}=-u_c v_{z,up}$ si $u_c>0$ y $-u_c v_{z,down}$ si $u_c<0$. Al soltar, mantiene la altura con $K_{p,posZ}$ cuando $|v_z|<0.2$ m/s.

### 8.4 Velocidad → vector de empuje

PI con anti-windup por recorte del integrador:

$$\mathbf a_{sp}=K_{p,v}\odot(\mathbf v_{sp}-\mathbf v)+K_{i,v}\odot\!\int(\mathbf v_{sp}-\mathbf v)\,dt,\qquad \mathbf F=m(\mathbf a_{sp}-\mathbf g)$$

- Empuje mínimo hacia arriba: $F_z\le-0.1\,mg$.
- Límite de inclinación: $|\mathbf F_{xy}|\le|F_z|\tan\theta_{max}$.
- Eje deseado del cuerpo: $\mathbf z_{b,d}=-\mathbf F/|\mathbf F|$.
- Empuje colectivo proyectado sobre el eje actual: $T_{col}=\max(-\mathbf F\cdot\mathbf z_b,\,0)$.
- Actitud deseada: $\mathbf x_c=[\cos\psi_{sp},\sin\psi_{sp},0]$, $\mathbf y_{b,d}=\dfrac{\mathbf z_{b,d}\times\mathbf x_c}{\lVert\cdot\rVert}$, $\mathbf x_{b,d}=\mathbf y_{b,d}\times\mathbf z_{b,d}$, $R_d=[\mathbf x_{b,d}\ \mathbf y_{b,d}\ \mathbf z_{b,d}]$.
- **En tierra sin pedir subir:** $T_{col}=N\,T_{min}$ (ralentí) y se reinician los integradores, como el land detector de PX4.

### 8.5 Actitud → velocidad angular (prioridad de inclinación)

1. Rotación más corta que alinea $\mathbf z_b$ con $\mathbf z_{b,d}$: $\mathbf q_{sh}=\mathrm{norm}([1+\mathbf z_b\cdot\mathbf z_{b,d},\ \mathbf z_b\times\mathbf z_{b,d}])$, y $\mathbf q_{red}=\mathbf q_{sh}\otimes\mathbf q$.
2. Yaw restante: $\mathbf q_{mix}=\mathbf q_{red}^{-1}\otimes\mathbf q_d$. Se aplica con peso $w_\psi=0.5$:
$$\mathbf q_d'=\mathbf q_{red}\otimes[\cos(w_\psi\arccos q_{mix,w}),\,0,\,0,\,\sin(w_\psi\arcsin q_{mix,z})]$$
3. Error: $\mathbf q_e=\mathbf q^{-1}\otimes\mathbf q_d'$ (con $q_{e,w}\ge0$). Ley de control: $\boldsymbol\omega_{sp}=2K_{p,att}\,\mathbf q_{e,xyz}$, saturada a los rates máximos.

Así, un escalón grande de yaw no empeora el control de inclinación.

### 8.6 Velocidad angular → momento

PI con cancelación de inercia y del término giroscópico:

$$\boldsymbol\alpha=K_{p,\omega}\odot\mathbf e_\omega+K_{i,\omega}\odot\!\int\mathbf e_\omega\,dt,\qquad \mathbf M=J\boldsymbol\alpha+\boldsymbol\omega\times J\boldsymbol\omega$$

Los integradores se reinician en tierra cuando $T_{col}<0.8\,mg$.

### 8.7 Ganancias automáticas

Se escalan con la constante de tiempo del motor; $a$ es el factor de agresividad (`control.aggr`):

| Ganancia | Valor |
|---|---|
| $K_{p,\omega}$ (roll, pitch / yaw) | $\min(0.6a/\tau,\,60)$ / $0.6\times$ |
| $K_{i,\omega}$ | $0.5K_{p,\omega}$ (roll, pitch); $0.3K_{p,\omega}$ (yaw) |
| $K_{p,att}$ | $\min(K_{p,\omega}/3,\,12)$ |
| $K_{p,v}$ horizontal / vertical | $\min(K_{p,att}/2.5,\,3)$ / $\min(K_{p,\omega}/4,\,5)$ |
| $K_{i,v}$ | $0.25K_{p,v}$ horizontal; $0.5K_{p,v}$ vertical |
| $K_{p,pos}$ horizontal / vertical | $K_{p,v}/2$ / $K_{p,vZ}/3$ |

**Justificación.** Con la planta del lazo de rate $\approx \dfrac{1}{s(\tau s+1)}$, $K_p=0.6/\tau$ da un cruce en $\omega_c\approx0.6/\tau$ y un margen de fase de $90^\circ-\arctan(0.6)\approx59^\circ$. Cada lazo externo es unas 2.5–3 veces más lento que el interno.

---

## 9. Asignación de control

Matriz de efectividad (empuje por rotor → $[T,M_x,M_y,M_z]$), con columnas escaladas por la efectividad estimada $\hat\eta_i$:

$$B=\begin{bmatrix}1&\cdots&1\\-r_{y,1}&\cdots&-r_{y,N}\\ r_{x,1}&\cdots&r_{x,N}\\-s_1\frac{k_Q}{k_T}&\cdots&-s_N\frac{k_Q}{k_T}\end{bmatrix}\operatorname{diag}(\hat\eta)$$

Pseudo-inversa regularizada, que no explota si se pierde rango (quad con un motor caído):

$$B^+=B^T\left(BB^T+\varepsilon I\right)^{-1},\qquad\varepsilon=10^{-8}\operatorname{tr}(BB^T)$$

Prioridades, con límites $[T_{min},T_{max}]$ por rotor:

1. $\mathbf u_{rp}=B^+[0,M_x,M_y,0]^T$. Si su rango excede $T_{max}-T_{min}$, se escala por $k_{rp}$.
2. $\mathbf u=B^+[T,0,0,0]^T+k_{rp}\mathbf u_{rp}$, desplazado de forma uniforme para quedar dentro de los límites. Si sube el colectivo, es "airmode".
3. Yaw: $\mathbf u\mathrel{+}=k_\psi B^+[0,0,0,M_z]^T$, con el mayor $k_\psi\in[0,1]$ que no sature.
4. Recorte final y $\Omega_{cmd,i}=\sqrt{u_i/k_T}$.

**Falla de motor:** $\eta_i$ cambia de inmediato en la planta. $\hat\eta$ se actualiza a los 0.15 s (latencia de detección) y se recalcula $B^+$.

---

## 10. Armado, aterrizaje y apagado de motores (estilo PX4 / QGroundControl)

**Detector de aterrizaje:** `landed = true` tras 0.3 s de contacto continuo; `takeoff` tras 0.2 s sin contacto.

Con *bajar* definido como $u_{climb}<-0.5$ en modo Posición, o $u_{thr}<0.05$ en Acro y Angle:

| Evento | Condición | Parámetro (por defecto) | Equivalente PX4 |
|---|---|---|---|
| **Armar (gesto)** | en tierra, *bajar* y yaw > 0.8 sostenidos | `armHoldSec` = 1 s | gesto de armado con stick |
| **Apagar motores al aterrizar** | en tierra y *bajar* sostenido (yaw centrado) | `landDisarmHoldSec` = 2 s | lo que pediste: mantener S en el piso |
| Desarmar (gesto) | en tierra, *bajar* y yaw < −0.8 | `armHoldSec` | gesto de desarmado |
| Desarme automático | tiempo en tierra tras un vuelo | `autoDisarmAfterLandSec` = null (apagado) | `COM_DISARM_LAND` |
| Armado sin despegar | sin despegue desde que se armó | `preflightDisarmSec` = 10 s | `COM_DISARM_PRFLT` |
| Choque | ver §7 | — | — |

Si sueltas *bajar* antes de que se cumpla el tiempo, el contador se reinicia y el dron sigue armado en ralentí. Desarmado: $\Omega_{cmd}=0$ y los rotores se detienen con $\tau$. Los eventos (`armed`, `disarmed` con `reason`, `landed`, `takeoff`, `crash`, `motorFailure`, `mode`) se regresan en `step()` y en el callback `onEvent`.

---

## 11. Viento

Con $\chi$ = dirección **de donde viene** (0 = N, 90 = E) y $A$ = amplitud de ráfaga:

$$
\mathbf w(t)=\begin{bmatrix}-V\cos\chi + A\sin(2\pi\,0.13t)+0.5A\sin(2\pi\,0.41t+2)\\
-V\sin\chi + A\sin(2\pi\,0.07t+1)+0.5A\sin(2\pi\,0.37t+4)\\
0.3A\sin(2\pi\,0.21t+2)\end{bmatrix}
$$

Es determinista; no es un modelo Dryden. Para más realismo, reemplaza `_windAt()`.

---

## 12. Conversión a motores gráficos

| Motor | Posición desde NED $(n,e,d)$ | Cuaternión desde $[q_w,q_x,q_y,q_z]$ |
|---|---|---|
| three.js / Godot / Babylon (Y arriba, derecho) | $(e,\ -d,\ -n)$ | $(x,y,z,w)=(q_y,\ -q_z,\ -q_x,\ q_w)$ |
| Unity (Y arriba, izquierdo) | $(e,\ -d,\ n)$ | $(x,y,z,w)=(-q_y,\ q_z,\ -q_x,\ q_w)$ |
| Unreal (Z arriba, izquierdo, cm) | $100\,(n,\ e,\ -d)$ | $(x,y,z,w)=(-q_x,\ -q_y,\ q_z,\ q_w)$ |

Derivación: si $M$ es la matriz de cambio de base, $R'=MRM^T$. Para $M$ propia ($\det=+1$) el cuaternión es $(q_w,\ M\mathbf q_v)$; para $M$ impropia ($\det=-1$, motores de mano izquierda) es $(q_w,\ -M\mathbf q_v)$. Las tres conversiones están verificadas numéricamente en `test/core.test.mjs`.

**Comprobación rápida en tu motor:** con yaw = 90° la nariz debe apuntar al Este.

El modelo del dron debe tener su frente en el eje "adelante" del motor: −Z en three/Godot, +Z en Unity, +X en Unreal. Si no es así, corrígelo con `yawOffsetDeg` en el adaptador o con un nodo padre rotado.

---

## 13. Perfil MX80

**[C]** = confirmado (manual MX80 V1.0, Apéndice 7.1; datasheet Hobbywing X15). **[EST]** = estimado, reemplázalo con tu dato.

| Parámetro | Valor | Origen |
|---|---|---|
| Marco | Quad X | [C] 4 motores / 4 ESC |
| MTOW | 141.2 kg (aspersión); 147.2 kg (esparcido) | [C] manual |
| Hélice | 63 × 24 in plegable | [C] manual |
| Empuje máx./motor | 72 kgf a 69 V | [C] Hobbywing (el manual indica ~75 kg) |
| Masa por brazo | 5.908 kg (motor+ESC+hélice+cable) | [C] Hobbywing |
| Batería | 18S, 68.4 V nominal, 34 Ah | [C] manual (informativo) |
| Distancia diagonal | 2400 mm | **[EST]** (mínimo sin traslape con 63": 2263 mm) |
| RPM a empuje máx. | 2100 rpm | **[EST]** (influye poco) |
| $\tau$ | 0.12 s | **[EST]** |
| Altura del CG en tierra | 0.6 m | **[EST]** |
| Inercia | estimada | **[EST]**: pon la del CAD |

Valores derivados (calculados por el código):

| | 1800 m snm | Nivel del mar |
|---|---|---|
| $\rho$ | 1.027 kg/m³ | 1.225 kg/m³ |
| $T_{max}$ por motor | 592 N | 706 N |
| Empuje/peso | 1.71 | 2.04 |
| Throttle de hover | 73 % (≈1606 rpm) | 66 % (≈1470 rpm) |
| $J_{xx},J_{yy},J_{zz}$ (estimada) | 24.6, 24.6, 47.9 kg·m² | igual |
| $K_{p,\omega}$ / $K_{p,att}$ | 5.0 / 1.67 s⁻¹ | igual |

Con un quad, perder un motor no es recuperable: el simulador lo reproduce (se cae).

---

## 14. Limitaciones conocidas

- Sin batería: no hay caída de voltaje ni autonomía. El empuje máximo no baja al descargarse.
- Sin aleteo de pala, sin anillo de vórtice en descenso rápido, sin interacción aerodinámica entre rotores.
- Estimador ideal: el controlador ve el estado verdadero, sin ruido ni EKF.
- Suelo rígido sin rebote ni fricción lateral. Obstáculos solo como cajas.
- $k_Q/k_T$ estimado. Diferencia con el script de MATLAB anterior: allá se usó un valor fijo de 0.025 m; aquí es $0.07D$ (más realista para hélices grandes).

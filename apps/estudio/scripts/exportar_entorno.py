"""
Exporta un entorno de Blender a GLB para el estudio.

    blender -b public/blender/entornos/entorno_montana_v2.blend -P scripts/exportar_entorno.py -- public/campo/entorno_montana_v2.glb

Lo que cuida:
- Las plantas (maiz, pasto, arboles) son instancias de geometry nodes: salen
  como instancias de GPU (EXT_mesh_gpu_instancing), una malla por variante
  repetida miles de veces.
- Sin camaras, luces ni la coleccion "Cielo" (planos de nubes y niebla de
  decenas de km: en GLB serian planos opacos que tapan cielo o suelo). El
  estudio pone su propio sol, cielo y neblina.
- Sin lo que no se renderiza (las plantas fuente de "Fuentes (ocultas)").
- Materiales procedurales: se les pone su color representativo (ver abajo).
  Los que usan una imagen (hojas de pino, encino, pirul) se dejan tal cual:
  conservan su textura y su transparencia.
- Raleo por distancia (PERFILES): la vegetacion se exporta completa cerca de
  la zona de despegue y cada vez mas escasa lejos, donde ya casi no se
  distingue y la neblina la tapa. Sin esto, la montana dibujaba 95 millones
  de triangulos.
- Mapa de alturas (PERFILES): si el terreno no es plano, se muestrea en una
  rejilla y se guarda junto al GLB (<salida>_alturas.bin + .json). El
  simulador de vuelo lo usa como suelo.

Y = arriba, en metros (el exportador convierte de Z arriba). El origen del
.blend es el origen del estudio: ahi va el dron. Nada se guarda en el .blend:
todos los cambios viven solo en esta sesion de Blender.
"""

import json
import math
import os
import struct
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

salida = sys.argv[sys.argv.index("--") + 1]
nombre_blend = os.path.basename(bpy.data.filepath)

# ---------------------------------------------------------------------------
# Perfiles por mapa (por prefijo del nombre del .blend)
# ---------------------------------------------------------------------------
# raleo: por coleccion, la fraccion de instancias que se queda segun la
#   distancia horizontal al origen: 1 hasta `cerca`, baja a `k_medio` en
#   `medio` y a `k_lejos` en `lejos` (lineal entre esos puntos).
# alturas: rejilla de +-mitad metros alrededor del origen, cada `paso` m.
PERFILES = {
    "entorno_agricola": {
        "raleo": [
            {"colecciones": ["Vegetacion"], "cerca": 350, "medio": 900, "lejos": 2500, "k_medio": 0.35, "k_lejos": 0.1},
        ],
        "alturas": None,  # plano: la zona de trabajo esta en z = 0
    },
    "entorno_montana": {
        "raleo": [
            {"colecciones": ["Bosque", "Sotobosque"], "cerca": 180, "medio": 600, "lejos": 1500, "k_medio": 0.12, "k_lejos": 0.03},
        ],
        "alturas": {"coleccion": "Terreno", "mitad": 1200, "paso": 4},
    },
}
perfil = next((p for prefijo, p in PERFILES.items() if nombre_blend.startswith(prefijo)), {"raleo": [], "alturas": None})
print(f"[entorno] {nombre_blend}: perfil {'propio' if perfil['raleo'] or perfil['alturas'] else 'sin raleo ni alturas'}")


# ---------------------------------------------------------------------------
# Color de los materiales procedurales
# ---------------------------------------------------------------------------
# glTF no lleva nodos: un Base Color que sale de una rampa, un ruido o una
# mezcla se exportaba como blanco. Antes de exportar se le pone su color
# representativo, sacado de sus propios nodos (no se inventa nada):
# - Color Ramp: el promedio de sus colores, pesado por el tramo que ocupa cada uno.
# - Mix: la mezcla de sus dos colores segun el factor y el modo (PESO_MASCARA
#   si el factor viene de una mascara).
# - Hue/Saturation y similares: el color que les entra.


# Cuando el factor de una mezcla sale de una mascara (ruido, altura, desgaste),
# la segunda capa (lodo en la parte baja de una pickup, oxido, variacion de
# hojas) cubre solo una parte: se toma como una cuarta parte. Con mitad y mitad
# la pickup azul salia gris por el lodo.
PESO_MASCARA = 0.25


def color_de_rampa(rampa):
    elementos = sorted(rampa.color_ramp.elements, key=lambda e: e.position)
    if len(elementos) == 1:
        return list(elementos[0].color)
    # Cada parada pesa la mitad del tramo hacia sus vecinas (y todo el tramo
    # hasta el borde en las de los extremos).
    total = [0.0, 0.0, 0.0, 0.0]
    peso_total = 0.0
    n = len(elementos)
    for i, el in enumerate(elementos):
        izquierda = el.position if i == 0 else (el.position - elementos[i - 1].position) / 2
        derecha = (1.0 - el.position) if i == n - 1 else (elementos[i + 1].position - el.position) / 2
        peso = izquierda + derecha
        for k in range(4):
            total[k] += el.color[k] * peso
        peso_total += peso
    return [c / peso_total for c in total] if peso_total else list(elementos[0].color)


def combinar(a, b, modo):
    """Lo que hace el modo de mezcla de Blender con dos colores, canal por canal."""
    if modo == "MULTIPLY":
        return [x * y for x, y in zip(a, b)]
    if modo == "ADD":
        return [x + y for x, y in zip(a, b)]
    if modo == "SUBTRACT":
        return [x - y for x, y in zip(a, b)]
    if modo == "SCREEN":
        return [1 - (1 - x) * (1 - y) for x, y in zip(a, b)]
    if modo == "DARKEN":
        return [min(x, y) for x, y in zip(a, b)]
    if modo == "LIGHTEN":
        return [max(x, y) for x, y in zip(a, b)]
    if modo == "OVERLAY":
        return [2 * x * y if x < 0.5 else 1 - 2 * (1 - x) * (1 - y) for x, y in zip(a, b)]
    return list(b)  # MIX y los que no se modelan: el segundo color


def mezclar(a, b, f, modo="MIX"):
    """
    Nodo de mezcla: a mezclado con combinar(a, b) segun el factor. Muchos
    materiales MULTIPLICAN el color por una mascara casi blanca (surcos,
    hileras): promediarlos daba blanco.
    """
    if a and b:
        mezcla = combinar(a, b, modo)
        return [max(0.0, min(1.0, a[k] * (1 - f) + mezcla[k] * f)) for k in range(4)]
    return a or b


def color_de_socket(socket, profundidad=0):
    """Color que entrega un socket de entrada, o None si no se puede saber."""
    if profundidad > 12:
        return None
    if not socket.is_linked:
        valor = socket.default_value
        try:
            return [valor[0], valor[1], valor[2], 1.0]
        except TypeError:
            return [valor, valor, valor, 1.0]
    nodo = socket.links[0].from_node
    tipo = nodo.bl_idname
    if tipo == "ShaderNodeValToRGB":
        return color_de_rampa(nodo)
    if tipo == "ShaderNodeMix" and nodo.data_type == "RGBA":
        factor = nodo.inputs[0]
        f = PESO_MASCARA if factor.is_linked else float(factor.default_value)
        return mezclar(
            color_de_socket(nodo.inputs[6], profundidad + 1),
            color_de_socket(nodo.inputs[7], profundidad + 1),
            f,
            nodo.blend_type,
        )
    if tipo == "ShaderNodeMixRGB":
        factor = nodo.inputs["Fac"]
        f = PESO_MASCARA if factor.is_linked else float(factor.default_value)
        return mezclar(
            color_de_socket(nodo.inputs["Color1"], profundidad + 1),
            color_de_socket(nodo.inputs["Color2"], profundidad + 1),
            f,
            nodo.blend_type,
        )
    # Nodos que modifican un color que les entra: se toma ese color.
    for entrada in nodo.inputs:
        if entrada.type == "RGBA" and entrada.name in {"Color", "Image", "Base Color"}:
            return color_de_socket(entrada, profundidad + 1)
    return None


def usa_imagen(socket, profundidad=0):
    """El color sale (en algun punto de la cadena) de una textura de imagen."""
    if profundidad > 12 or not socket.is_linked:
        return False
    nodo = socket.links[0].from_node
    if nodo.bl_idname == "ShaderNodeTexImage":
        return True
    return any(usa_imagen(e, profundidad + 1) for e in nodo.inputs if e.is_linked)


def fijar_colores_procedurales():
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for nodo in material.node_tree.nodes:
            if nodo.bl_idname != "ShaderNodeBsdfPrincipled":
                continue
            base = nodo.inputs["Base Color"]
            if not base.is_linked:
                continue
            if usa_imagen(base):
                print(f"[entorno] {material.name}: usa imagen, se deja con su textura")
                continue
            color = color_de_socket(base)
            if color is None:
                print(f"[entorno] sin color para {material.name}: queda blanco")
                continue
            material.node_tree.links.remove(base.links[0])
            base.default_value = color
            print(f"[entorno] {material.name}: {tuple(round(c, 3) for c in color[:3])}")


# ---------------------------------------------------------------------------
# Raleo por distancia (en los geometry nodes de cada emisor)
# ---------------------------------------------------------------------------


def salida_habilitada(nodo, indice_tipo=None):
    habilitadas = [s for s in nodo.outputs if s.enabled]
    return habilitadas[indice_tipo or 0]


def ralear_emisor(objeto, cerca, medio, lejos, k_medio, k_lejos, semilla):
    """
    Agrega al final del arbol de nodos del emisor un Delete Geometry sobre las
    instancias: se borra cada instancia cuyo aleatorio supere la fraccion que
    se queda a su distancia del origen. El arbol se copia antes: no se toca el
    original, que puede compartir otro emisor.
    """
    mod = next((m for m in objeto.modifiers if m.type == "NODES" and m.node_group), None)
    if not mod:
        return False
    arbol = mod.node_group.copy()
    mod.node_group = arbol
    salida_grupo = next(n for n in arbol.nodes if n.bl_idname == "NodeGroupOutput")
    entrada_geo = next(s for s in salida_grupo.inputs if s.type == "GEOMETRY")
    if not entrada_geo.is_linked:
        return False
    origen_geo = entrada_geo.links[0].from_socket
    N, L = arbol.nodes, arbol.links

    # Origen del mundo en coordenadas del emisor (las posiciones de las
    # instancias estan en el espacio del objeto).
    origen = objeto.matrix_world.inverted() @ Vector((0, 0, 0))

    pos = N.new("GeometryNodeInputPosition")
    resta = N.new("ShaderNodeVectorMath")
    resta.operation = "SUBTRACT"
    resta.inputs[1].default_value = (origen.x, origen.y, 0.0)
    plano = N.new("ShaderNodeVectorMath")
    plano.operation = "MULTIPLY"
    plano.inputs[1].default_value = (1.0, 1.0, 0.0)
    largo = N.new("ShaderNodeVectorMath")
    largo.operation = "LENGTH"
    L.new(pos.outputs[0], resta.inputs[0])
    L.new(resta.outputs[0], plano.inputs[0])
    L.new(plano.outputs[0], largo.inputs[0])
    distancia = salida_habilitada(largo)  # "Value"

    def rango(de0, de1, a0, a1):
        m = N.new("ShaderNodeMapRange")
        m.data_type = "FLOAT"
        m.clamp = True
        L.new(distancia, m.inputs[0])
        m.inputs[1].default_value = de0
        m.inputs[2].default_value = de1
        m.inputs[3].default_value = a0
        m.inputs[4].default_value = a1
        return m.outputs[0]

    # keep = r1 + r2 - k_medio  (r1 baja de 1 a k_medio, r2 de k_medio a k_lejos)
    r1 = rango(cerca, medio, 1.0, k_medio)
    r2 = rango(medio, lejos, k_medio, k_lejos)
    suma = N.new("ShaderNodeMath")
    suma.operation = "ADD"
    L.new(r1, suma.inputs[0])
    L.new(r2, suma.inputs[1])
    queda = N.new("ShaderNodeMath")
    queda.operation = "SUBTRACT"
    L.new(suma.outputs[0], queda.inputs[0])
    queda.inputs[1].default_value = k_medio

    azar = N.new("FunctionNodeRandomValue")
    azar.data_type = "FLOAT"
    azar.inputs["Seed"].default_value = semilla
    valor_azar = next(s for s in azar.outputs if s.enabled)
    compara = N.new("FunctionNodeCompare")
    compara.data_type = "FLOAT"
    compara.operation = "GREATER_THAN"
    L.new(valor_azar, compara.inputs[0])
    L.new(queda.outputs[0], compara.inputs[1])

    borrar = N.new("GeometryNodeDeleteGeometry")
    borrar.domain = "INSTANCE"
    L.new(origen_geo, borrar.inputs["Geometry"])
    L.new(compara.outputs[0], borrar.inputs["Selection"])
    L.new(borrar.outputs[0], entrada_geo)
    return True


def contar_triangulos():
    """Triangulos que se dibujan (instancias incluidas), por coleccion."""
    dg = bpy.context.evaluated_depsgraph_get()
    tris_malla, por_col, instancias = {}, {}, 0
    for inst in dg.object_instances:
        o = inst.object
        if o.type != "MESH":
            continue
        fuente = (inst.parent.original if inst.is_instance and inst.parent else None) or o.original or o
        if fuente.hide_render:
            continue
        if o.name not in tris_malla:
            try:
                me = o.to_mesh()
                tris_malla[o.name] = sum(len(p.vertices) - 2 for p in me.polygons)
                o.to_mesh_clear()
            except RuntimeError:
                tris_malla[o.name] = 0
        col = fuente.users_collection[0].name if fuente.users_collection else "?"
        por_col[col] = por_col.get(col, 0) + tris_malla[o.name]
        instancias += 1 if inst.is_instance else 0
    return por_col, instancias


# ---------------------------------------------------------------------------
# Mapa de alturas
# ---------------------------------------------------------------------------


def exportar_alturas(cfg, ruta_base):
    dg = bpy.context.evaluated_depsgraph_get()
    arboles = []
    for o in bpy.data.collections[cfg["coleccion"]].all_objects:
        if o.type != "MESH" or o.hide_render:
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.transform(o.matrix_world)
        arboles.append(BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [p.vertices[:] for p in me.polygons]))
        ev.to_mesh_clear()
    mitad, paso = cfg["mitad"], cfg["paso"]
    n = int(round(2 * mitad / paso)) + 1
    alturas = []
    abajo = Vector((0, 0, -1))
    for j in range(n):
        y = -mitad + j * paso
        for i in range(n):
            x = -mitad + i * paso
            mejor = None
            for b in arboles:
                golpe = b.ray_cast(Vector((x, y, 10000.0)), abajo)
                if golpe[0] is not None and (mejor is None or golpe[0].z > mejor):
                    mejor = golpe[0].z
            alturas.append(mejor if mejor is not None else 0.0)
    z_min, z_max = min(alturas), max(alturas)
    escala = max((z_max - z_min) / 65535.0, 0.001)
    with open(ruta_base + "_alturas.bin", "wb") as f:
        f.write(struct.pack(f"<{len(alturas)}H", *[int(round((z - z_min) / escala)) for z in alturas]))
    meta = {
        "nota": "Rejilla de alturas del terreno. Indice = j * n + i; x = -mitad + i*paso (este, three x), "
        "y = -mitad + j*paso (norte, three -z). altura = zMin + valor * escala [m].",
        "mitad": mitad,
        "paso": paso,
        "n": n,
        "zMin": z_min,
        "escala": escala,
    }
    with open(ruta_base + "_alturas.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(f"[entorno] alturas: {n} x {n} cada {paso} m, de {z_min:.1f} a {z_max:.1f} m")


# ---------------------------------------------------------------------------

fijar_colores_procedurales()

antes, inst_antes = contar_triangulos()
semilla = 7
for regla in perfil["raleo"]:
    for nombre_col in regla["colecciones"]:
        col = bpy.data.collections.get(nombre_col)
        if not col:
            print(f"[entorno] no existe la coleccion {nombre_col}")
            continue
        for o in col.all_objects:
            semilla += 1
            ralear_emisor(o, regla["cerca"], regla["medio"], regla["lejos"], regla["k_medio"], regla["k_lejos"], semilla)

# Lo que no debe salir aunque se renderice en Blender.
for o in list(bpy.data.objects):
    if o.type in {"CAMERA", "LIGHT"}:
        o.hide_render = True
cielo = bpy.data.collections.get("Cielo")
if cielo:
    for o in list(cielo.all_objects):
        if o is not None:
            o.hide_render = True

despues, inst_despues = contar_triangulos()
print(f"[entorno] triangulos: {sum(antes.values()) / 1e6:.1f} M -> {sum(despues.values()) / 1e6:.1f} M "
      f"(instancias {inst_antes} -> {inst_despues})")
for col in sorted(despues, key=lambda c: -despues[c]):
    print(f"[entorno]   {col}: {antes.get(col, 0) / 1e6:.2f} M -> {despues[col] / 1e6:.2f} M")

if perfil["alturas"]:
    exportar_alturas(perfil["alturas"], os.path.splitext(salida)[0])

bpy.ops.export_scene.gltf(
    filepath=salida,
    export_format="GLB",
    use_renderable=True,
    export_cameras=False,
    export_lights=False,
    export_apply=True,
    export_gn_mesh=True,
    export_gpu_instances=True,
    export_yup=True,
    export_image_format="WEBP",
    export_animations=False,
    export_extras=False,
)
print(f"[entorno] {salida} ({os.path.getsize(salida) / 1e6:.1f} MB)")

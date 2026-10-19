"""
Render de cada pieza del catalogo, dentro de Blender.

Lo corre `npm run renders:generar` (scripts/generar_renders.ts); no hace
falta abrir Blender. A mano seria:

    blender -b dron.blend -P render_piezas.py -- mapa.json carpeta_salida

`mapa.json` dice que objetos forman cada pieza. Lo arma el script de Node con
las mismas reglas que usa el visor de la ficha (componentes.ts), asi que el
render y el 3D muestran lo mismo.

Por cada pieza: oculta todo lo demas, encuadra la camara sobre la pieza y
renderiza en el estilo de los renders del catalogo (1600 x 800, estudio gris
oscuro, vista en tres cuartos desde arriba). NUNCA guarda el .blend: todo lo
que crea (camara, luz, piso, mundo) vive solo en esta sesion.

Tambien acepta un .glb en lugar de un .blend (lo importa primero): sirve para
probar el flujo sin el archivo de Blender.
"""

import json
import math
import os
import re
import sys
import unicodedata

import bpy
from mathutils import Vector

ANCHO, ALTO = 1600, 800
# Direccion de la camara desde el centro de la pieza (Z arriba): tres cuartos,
# un poco desde arriba, como los renders existentes.
DIRECCION_CAMARA = Vector((1.0, -1.25, 0.75)).normalized()
# Fraccion del cuadro que puede ocupar la pieza (el resto es aire alrededor).
OCUPACION = 0.78


def sanear(nombre):
    """El nombre como lo deja three.js al cargar el GLB (ver componentes.ts)."""
    return re.sub(r"[\[\].:/]", "", re.sub(r"\s", "_", nombre))


def normalizar(nombre):
    """Mismo criterio que normalizarNombre de lib/texto.ts."""
    t = unicodedata.normalize("NFD", nombre)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    t = re.sub(r"\.\d+$", "", t)
    t = re.sub(r"0\d{2}$", "", t)
    t = re.sub(r"(_\d+)+$", "", t)
    return re.sub(r"[^a-z0-9]", "", t)


def argumentos():
    resto = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(resto) < 2:
        raise SystemExit("Uso: blender -b archivo -P render_piezas.py -- mapa.json salida")
    return resto[0], resto[1], resto[2] if len(resto) > 2 else None


def importar_glb_si_hace_falta(glb):
    if glb:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=glb)


def motor_eevee():
    opciones = {
        e.identifier
        for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    }
    for nombre in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        if nombre in opciones:
            return nombre
    return "CYCLES"


def nodo(arbol, tipo, _nombre=None):
    """
    El nodo de ese tipo en el arbol, o uno nuevo si no hay. Se busca por TIPO y
    no por nombre: con Blender en espanol los nodos por defecto se llaman
    "Fondo" o "BSDF Principiado", y buscar "Background" no los encontraba.
    """
    for existente in arbol.nodes:
        if existente.bl_idname == tipo:
            return existente
    return arbol.nodes.new(tipo)


def activar_salida(salida):
    """Que el render use esta salida y no otra que hubiera en el arbol."""
    if hasattr(salida, "is_active_output"):
        salida.is_active_output = True


def preparar_escena(escena):
    escena.render.engine = motor_eevee()
    escena.render.resolution_x = ANCHO
    escena.render.resolution_y = ALTO
    escena.render.resolution_percentage = 100
    escena.render.film_transparent = False
    escena.render.image_settings.file_format = "JPEG"
    escena.render.image_settings.quality = 90
    if hasattr(escena, "eevee") and hasattr(escena.eevee, "taa_render_samples"):
        escena.eevee.taa_render_samples = 64

    # Mundo propio: gris oscuro de estudio, sin depender del .blend.
    mundo = bpy.data.worlds.new("mxd_estudio")
    if hasattr(mundo, "use_nodes"):
        mundo.use_nodes = True
    arbol = mundo.node_tree
    fondo = nodo(arbol, "ShaderNodeBackground", "Background")
    salida_mundo = nodo(arbol, "ShaderNodeOutputWorld", "World Output")
    arbol.links.new(fondo.outputs[0], salida_mundo.inputs[0])
    activar_salida(salida_mundo)
    fondo.inputs[0].default_value = (0.045, 0.045, 0.05, 1.0)
    fondo.inputs[1].default_value = 0.9
    escena.world = mundo

    # Las luces del .blend no cuentan: el estilo lo pone este script.
    for obj in escena.objects:
        if obj.type == "LIGHT":
            obj.hide_render = True

    camara_datos = bpy.data.cameras.new("mxd_camara")
    camara_datos.lens = 50
    camara_datos.sensor_width = 36
    camara = bpy.data.objects.new("mxd_camara", camara_datos)
    escena.collection.objects.link(camara)
    escena.camera = camara

    sol_datos = bpy.data.lights.new("mxd_sol", type="SUN")
    sol_datos.energy = 4.0
    sol_datos.angle = math.radians(8)
    sol = bpy.data.objects.new("mxd_sol", sol_datos)
    sol.rotation_euler = (math.radians(50), 0, math.radians(35))
    escena.collection.objects.link(sol)

    relleno_datos = bpy.data.lights.new("mxd_relleno", type="SUN")
    relleno_datos.energy = 0.8
    relleno = bpy.data.objects.new("mxd_relleno", relleno_datos)
    relleno.rotation_euler = (math.radians(65), 0, math.radians(-140))
    escena.collection.objects.link(relleno)

    material_piso = bpy.data.materials.new("mxd_piso")
    if hasattr(material_piso, "use_nodes"):
        material_piso.use_nodes = True
    arbol_piso = material_piso.node_tree
    bsdf = nodo(arbol_piso, "ShaderNodeBsdfPrincipled", "Principled BSDF")
    salida_piso = nodo(arbol_piso, "ShaderNodeOutputMaterial", "Material Output")
    arbol_piso.links.new(bsdf.outputs[0], salida_piso.inputs[0])
    activar_salida(salida_piso)
    bsdf.inputs["Base Color"].default_value = (0.09, 0.09, 0.1, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55
    malla_piso = bpy.data.meshes.new("mxd_piso")
    malla_piso.from_pydata(
        [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)]
    )
    malla_piso.materials.append(material_piso)
    piso = bpy.data.objects.new("mxd_piso", malla_piso)
    escena.collection.objects.link(piso)

    propios = {camara, sol, relleno, piso}
    return camara, piso, propios


def objetos_de_pieza(pieza, por_saneado, por_normalizado):
    """Los objetos de la pieza y todos sus hijos."""
    raices = [por_saneado[n] for n in pieza["nodos"] if n in por_saneado]
    if not raices:
        # Respaldo: los nombresBlender del catalogo, comparados normalizados.
        for nombre in pieza["nombres"]:
            obj = por_normalizado.get(normalizar(nombre))
            if obj:
                raices.append(obj)
    # La misma pieza montada varias veces (los cuatro agarradores del marco)
    # se renderiza una vez. Son copias si todas miden lo mismo y estan
    # separadas entre si; las mitades A y B de un cople miden igual pero estan
    # pegadas, y siguen saliendo juntas.
    if len(raices) > 1 and son_copias([caja_de([r, *r.children_recursive]) for r in raices]):
        raices = raices[:1]
    vistos = []
    for raiz in raices:
        for obj in [raiz, *raiz.children_recursive]:
            if obj not in vistos:
                vistos.append(obj)
    return vistos


def caja_de(objetos):
    """(minimo, maximo) en el mundo de las mallas de `objetos`, o None."""
    puntos = [
        obj.matrix_world @ Vector(esquina)
        for obj in objetos
        if obj.type == "MESH"
        for esquina in obj.bound_box
    ]
    if not puntos:
        return None
    return (
        Vector((min(p.x for p in puntos), min(p.y for p in puntos), min(p.z for p in puntos))),
        Vector((max(p.x for p in puntos), max(p.y for p in puntos), max(p.z for p in puntos))),
    )


def son_copias(cajas, tolerancia=0.05):
    """True si todas las cajas miden lo mismo y ninguna toca a otra."""
    if any(c is None for c in cajas):
        return False
    medidas = [sorted((c[1] - c[0])[:]) for c in cajas]
    base = medidas[0]
    for m in medidas[1:]:
        if any(abs(a - b) > tolerancia * max(b, 1e-9) for a, b in zip(m, base)):
            return False
    tamano = max(base)
    centros = [(c[0] + c[1]) / 2 for c in cajas]
    return all(
        (centros[i] - centros[j]).length > tamano
        for i in range(len(centros))
        for j in range(i + 1, len(centros))
    )


def puntos_mundo(objetos, maximo_por_objeto=20000):
    """Vertices de las mallas en coordenadas del mundo (muestreados si son muchos)."""
    puntos = []
    for obj in objetos:
        if obj.type != "MESH" or not obj.data.vertices:
            continue
        vertices = obj.data.vertices
        paso = max(1, len(vertices) // maximo_por_objeto)
        matriz = obj.matrix_world
        puntos.extend(matriz @ vertices[i].co for i in range(0, len(vertices), paso))
    return puntos


def encuadrar(camara, piso, puntos):
    """
    Camara que mete la pieza justa en el cuadro. Se proyectan los vertices
    reales al sistema de la camara (que mira siempre desde la misma
    direccion): con la caja envolvente, sus esquinas sobresalen mucho mas que
    una pieza redonda vista en tres cuartos y la pieza quedaba chica.
    """
    datos = camara.data
    tan_h = math.tan(math.atan(datos.sensor_width / (2 * datos.lens))) * OCUPACION
    tan_v = tan_h * ALTO / ANCHO
    orientacion = (-DIRECCION_CAMARA).to_track_quat("-Z", "Y")
    derecha = orientacion @ Vector((1, 0, 0))
    arriba = orientacion @ Vector((0, 1, 0))

    # Centro de la pieza en la imagen (no el de su caja en 3D).
    xs = [p.dot(derecha) for p in puntos]
    ys = [p.dot(arriba) for p in puntos]
    zs = [p.dot(DIRECCION_CAMARA) for p in puntos]
    centro = (
        derecha * ((min(xs) + max(xs)) / 2)
        + arriba * ((min(ys) + max(ys)) / 2)
        + DIRECCION_CAMARA * ((min(zs) + max(zs)) / 2)
    )
    cx, cy, cz = centro.dot(derecha), centro.dot(arriba), centro.dot(DIRECCION_CAMARA)
    distancia = 0.0
    for x, y, z in zip(xs, ys, zs):
        cerca = z - cz  # cuanto mas cerca de la camara esta el punto
        distancia = max(
            distancia,
            cerca + abs(x - cx) / tan_h,
            cerca + abs(y - cy) / tan_v,
        )

    minimo_z = min(p.z for p in puntos)
    radio = max((max(xs) - min(xs)), (max(ys) - min(ys)), (max(zs) - min(zs)), 1e-4)
    camara.location = centro + DIRECCION_CAMARA * distancia
    camara.rotation_euler = orientacion.to_euler()
    datos.clip_start = max(distancia * 0.01, 1e-4)
    datos.clip_end = distancia * 20 + radio * 4
    piso.location = Vector((centro.x, centro.y, minimo_z - radio * 0.001))
    piso.scale = (radio * 30, radio * 30, 1)


def main():
    mapa_ruta, salida, glb = argumentos()
    importar_glb_si_hace_falta(glb)
    with open(mapa_ruta, encoding="utf-8") as f:
        piezas = json.load(f)
    os.makedirs(salida, exist_ok=True)

    escena = bpy.context.scene
    originales = list(escena.objects)
    por_saneado, por_normalizado = {}, {}
    for obj in originales:
        por_saneado.setdefault(sanear(obj.name), obj)
        por_normalizado.setdefault(normalizar(obj.name), obj)

    camara, piso, propios = preparar_escena(escena)
    estado_original = {obj: obj.hide_render for obj in originales}

    resultado = {"renderizadas": [], "sin_objetos": []}
    for pieza in piezas:
        objetos = objetos_de_pieza(pieza, por_saneado, por_normalizado)
        puntos = puntos_mundo(objetos)
        if not puntos:
            resultado["sin_objetos"].append(pieza["sku"])
            print(f"[MXD] {pieza['sku']}: sin objetos en el archivo, se omite")
            continue
        visibles = set(objetos) | propios
        for obj in escena.objects:
            if obj.type == "LIGHT" and obj not in propios:
                continue
            obj.hide_render = obj not in visibles
        encuadrar(camara, piso, puntos)
        archivo = os.path.join(salida, f"{pieza['sku']}.jpg")
        escena.render.filepath = archivo
        bpy.ops.render.render(write_still=True)
        resultado["renderizadas"].append(pieza["sku"])
        print(f"[MXD] {pieza['sku']}: {len(objetos)} objetos -> {archivo}")

    for obj, oculto in estado_original.items():
        obj.hide_render = oculto
    with open(os.path.join(salida, "resultado.json"), "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)


main()

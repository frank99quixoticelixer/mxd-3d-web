"""Renderiza una pieza de un .blend o .glb a PNG con estudio gris.

Uso:
  blender -b -P scripts/render_pieza.py -- <archivo.blend|glb> <objeto> <salida.png>

Con objeto "*" renderiza todo el archivo en despiece: cada parte se separa del
centro del conjunto y las estampas (estampa_*) viajan pegadas a la parte mas
cercana, igual que en el visor. Un cuarto argumento opcional fija la separacion
(fraccion del radio, 0.6 por defecto).
"""
import sys
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
glb, objeto, salida = args[:3]
SEPARACION = float(args[3]) if len(args) > 3 else 0.6

if glb.lower().endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=glb)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)

def esquinas(objs):
    return [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]


def centro_de(o):
    return sum(esquinas([o]), Vector()) / 8


if objeto == "*":
    partes = [o for o in bpy.data.objects if o.type == "MESH"]
    principales = [o for o in partes if not o.name.lower().startswith("estampa_")]
    for est in (o for o in partes if o not in principales):
        c = centro_de(est)
        mejor = min(principales, key=lambda p: (centro_de(p) - c).length_squared)
        mundo = est.matrix_world.copy()
        est.parent = mejor
        est.matrix_world = mundo
    bpy.context.view_layer.update()
    centros = [centro_de(p) for p in principales]
    promedio = sum(centros, Vector()) / len(centros)
    radio0 = max((c - promedio).length for c in esquinas(principales))
    for p, c in zip(principales, centros):
        d = c - promedio
        if d.length > 1e-6:
            p.location += d.normalized() * radio0 * SEPARACION
    bpy.context.view_layer.update()
    piezas = partes
    # La camara mira desde el lado de la estampa (si hay), para que se vea.
    for est in (o for o in partes if o not in principales):
        lado = centro_de(est) - centro_de(est.parent)
        lado.z = 0
        if lado.length > 1e-6:
            DIRECCION_CAMARA = lado.normalized() + Vector((0, 0, 0.9))
            break
else:
    pieza = bpy.data.objects[objeto]
    for o in list(bpy.data.objects):
        if o is not pieza:
            bpy.data.objects.remove(o, do_unlink=True)
    piezas = [pieza]

corners = esquinas(piezas)
DIRECCION_CAMARA = globals().get("DIRECCION_CAMARA", Vector((1, -1, 1.1)))
centro = sum(corners, Vector()) / len(corners)
radio = max((c - centro).length for c in corners)
DISTANCIA = 6.6 if radio < 20 else 4.4
if objeto == "*":
    DISTANCIA = 4.6  # el conjunto ya es mas grande que una pieza sola
ESCALA_LUZ = (radio / 9.3178) ** 2  # las luces se calibraron con la tuerca (radio 9.3)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.render.filepath = salida

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
cam.location = centro + DIRECCION_CAMARA.normalized() * radio * DISTANCIA
cam.rotation_euler = (centro - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

for nombre, pos, energia in (("key", (-2, -2, 4), 9000), ("fill", (3, 1, 1), 1500), ("borde1", (-4, 2, 1.2), 7000), ("borde2", (4, -3, 1.5), 7000)):
    luz = bpy.data.objects.new(nombre, bpy.data.lights.new(nombre, "AREA"))
    luz.data.energy = energia * ESCALA_LUZ
    luz.data.size = radio * 6
    luz.location = centro + Vector(pos) * radio
    luz.rotation_euler = (centro - luz.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(luz)

zmin = min(c.z for c in corners)
bpy.ops.mesh.primitive_plane_add(size=radio * 600, location=(centro.x, centro.y, zmin - radio * 0.02))
piso = bpy.context.active_object
mat = bpy.data.materials.new("piso")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.24, 0.24, 0.25, 1)
bsdf.inputs["Roughness"].default_value = 0.6
bsdf.inputs["Metallic"].default_value = 0.0
piso.data.materials.append(mat)

world = bpy.data.worlds.new("w")
world.use_nodes = True
fondo = world.node_tree.nodes["Background"]
fondo.inputs["Color"].default_value = (0.10, 0.10, 0.11, 1)
fondo.inputs["Strength"].default_value = 1.0
scene.world = world

rim = bpy.data.objects.new("rim", bpy.data.lights.new("rim", "AREA"))
rim.data.energy = 1800 * ESCALA_LUZ
rim.data.color = (1.0, 1.0, 1.0)
rim.data.size = radio * 4
rim.location = centro + Vector((-2, 3, 1.5)) * radio
rim.rotation_euler = (centro - rim.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(rim)

bpy.ops.render.render(write_still=True)

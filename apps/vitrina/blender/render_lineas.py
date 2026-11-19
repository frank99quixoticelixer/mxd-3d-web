"""
Render de lineas del MX80: el dron dibujado solo con sus contornos y aristas,
como la vista de lineas del programa de diseno. Para folletos y publicidad.

    blender -b -P render_lineas.py -- modelo.glb carpeta_salida [vistas]

`vistas` es opcional: "tres-cuartos,superior,frente" (todas por omision).

Por cada vista saca dos PNG de 3200 px de ancho:
- `<vista>_oscuro-sobre-blanco.png`: lineas oscuras sobre fondo blanco.
- `<vista>_blanco-transparente.png`: lineas blancas sobre fondo transparente,
  para ponerlas sobre un fondo oscuro (la portada verde del folleto).

Las superficies se pintan de blanco plano o se vuelven transparentes; las
lineas las dibuja Freestyle (siluetas, bordes, contorno y aristas marcadas),
solo las visibles. Camara ortografica: sin perspectiva, como un plano.

No guarda nada: importa el GLB en una escena vacia y renderiza. Los PNG salen
sin metadatos (Blender guarda por omision la ruta del archivo y el nombre de
la escena).
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ANCHO = 3200
OCUPACION = 0.86  # fraccion del cuadro que ocupa el dron
GROSOR_PX = 1.6  # grosor de linea, en pixeles del render final
ANGULO_ARISTA = 128  # grados: aristas mas cerradas que esto se dibujan

VISTAS = {
    # direccion de la camara (Z arriba), ancho/alto del cuadro
    "tres-cuartos": (Vector((1.0, -1.25, 0.8)).normalized(), 16 / 10),
    "superior": (Vector((0.0, 0.0, 1.0)), 1.0),
    "frente": (Vector((1.0, 0.0, 0.0)), 16 / 9),
}

ESTILOS = {
    "oscuro-sobre-blanco": {"linea": (0.05, 0.08, 0.07), "transparente": False},
    "blanco-transparente": {"linea": (1.0, 1.0, 1.0), "transparente": True},
}


def argumentos():
    resto = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(resto) < 2:
        raise SystemExit("Uso: blender -b -P render_lineas.py -- modelo.glb salida [vistas]")
    vistas = resto[2].split(",") if len(resto) > 2 else list(VISTAS)
    return resto[0], resto[1], vistas


def motor_eevee():
    opciones = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    for nombre in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        if nombre in opciones:
            return nombre
    return "CYCLES"


def material_plano(nombre, transparente):
    """Blanco sin sombras (emision), o 'holdout' para dejar el hueco transparente."""
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    arbol = mat.node_tree
    arbol.nodes.clear()
    salida = arbol.nodes.new("ShaderNodeOutputMaterial")
    if transparente:
        sombra = arbol.nodes.new("ShaderNodeHoldout")
        arbol.links.new(sombra.outputs[0], salida.inputs["Surface"])
    else:
        sombra = arbol.nodes.new("ShaderNodeEmission")
        sombra.inputs["Color"].default_value = (1, 1, 1, 1)
        sombra.inputs["Strength"].default_value = 1.0
        arbol.links.new(sombra.outputs[0], salida.inputs["Surface"])
    return mat


def mallas():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and o.visible_get()]


def caja_mundo(objetos):
    minimo = Vector((math.inf,) * 3)
    maximo = Vector((-math.inf,) * 3)
    for o in objetos:
        for esquina in o.bound_box:
            p = o.matrix_world @ Vector(esquina)
            minimo = Vector(map(min, minimo, p))
            maximo = Vector(map(max, maximo, p))
    return minimo, maximo


def preparar_escena(escena):
    escena.render.engine = motor_eevee()
    escena.render.resolution_percentage = 100
    escena.render.image_settings.file_format = "PNG"
    escena.render.image_settings.color_mode = "RGBA"
    escena.view_settings.view_transform = "Standard"
    escena.view_settings.look = "None"
    # Sin metadatos en el PNG: por omision lleva la ruta del archivo.
    for prop in dir(escena.render):
        if prop.startswith("use_stamp"):
            try:
                setattr(escena.render, prop, False)
            except (AttributeError, TypeError):
                pass

    mundo = bpy.data.worlds.new("Lineas") if escena.world is None else escena.world
    escena.world = mundo
    mundo.use_nodes = True
    fondo = next(n for n in mundo.node_tree.nodes if n.bl_idname == "ShaderNodeBackground")
    fondo.inputs["Color"].default_value = (1, 1, 1, 1)
    fondo.inputs["Strength"].default_value = 1.0

    escena.render.use_freestyle = True
    escena.render.line_thickness_mode = "ABSOLUTE"
    escena.render.line_thickness = GROSOR_PX

    capa = escena.view_layers[0]
    capa.use_freestyle = True
    fs = capa.freestyle_settings
    fs.crease_angle = math.radians(ANGULO_ARISTA)
    fs.use_culling = False
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    lineset = fs.linesets.new("Lineas")
    lineset.select_by_visibility = True
    lineset.visibility = "VISIBLE"
    lineset.select_by_edge_types = True
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_crease = True
    lineset.select_external_contour = True
    lineset.select_contour = True
    estilo = lineset.linestyle
    estilo.thickness = GROSOR_PX
    estilo.caps = "ROUND"
    estilo.chaining = "PLAIN"
    return lineset


def camara(escena, centro, radio, direccion, aspecto):
    datos = bpy.data.cameras.new("Lineas")
    datos.type = "ORTHO"
    cam = bpy.data.objects.new("Lineas", datos)
    escena.collection.objects.link(cam)
    escena.camera = cam
    distancia = radio * 6
    cam.location = centro + direccion * distancia
    arriba = Vector((0, 1, 0)) if abs(direccion.z) > 0.99 else Vector((0, 0, 1))
    # Mirar al centro con "arriba" como referencia.
    eje_z = direccion.normalized()
    eje_x = arriba.cross(eje_z).normalized()
    eje_y = eje_z.cross(eje_x)
    from mathutils import Matrix

    cam.matrix_world = Matrix(
        (
            (eje_x.x, eje_y.x, eje_z.x, cam.location.x),
            (eje_x.y, eje_y.y, eje_z.y, cam.location.y),
            (eje_x.z, eje_y.z, eje_z.z, cam.location.z),
            (0, 0, 0, 1),
        )
    )
    datos.clip_start = 0.01
    datos.clip_end = distancia + radio * 4
    escena.render.resolution_x = ANCHO
    escena.render.resolution_y = round(ANCHO / aspecto)
    return cam, eje_x, eje_y


def encuadrar(cam, objetos, eje_x, eje_y, aspecto):
    """Escala ortografica justa para que la proyeccion del dron quepa."""
    xs, ys = [], []
    origen = cam.matrix_world.translation
    for o in objetos:
        for esquina in o.bound_box:
            p = o.matrix_world @ Vector(esquina) - origen
            xs.append(p.dot(eje_x))
            ys.append(p.dot(eje_y))
    ancho = max(xs) - min(xs)
    alto = max(ys) - min(ys)
    # Centrar: correr la camara al centro de la proyeccion.
    cam.location += eje_x * ((max(xs) + min(xs)) / 2) + eje_y * ((max(ys) + min(ys)) / 2)
    cam.data.ortho_scale = max(ancho, alto * aspecto) / OCUPACION


def main():
    glb, salida, vistas = argumentos()
    os.makedirs(salida, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    escena = bpy.context.scene
    lineset = preparar_escena(escena)

    objetos = mallas()
    minimo, maximo = caja_mundo(objetos)
    centro = (minimo + maximo) / 2
    radio = (maximo - minimo).length / 2
    print(f"[lineas] {len(objetos)} mallas, caja {tuple(round(v, 2) for v in maximo - minimo)} m")

    for clave_estilo, estilo in ESTILOS.items():
        mat = material_plano(f"plano_{clave_estilo}", estilo["transparente"])
        for o in objetos:
            o.data.materials.clear()
            o.data.materials.append(mat)
            for poligono in o.data.polygons:
                poligono.material_index = 0
        escena.render.film_transparent = estilo["transparente"]
        lineset.linestyle.color = estilo["linea"]

        for vista in vistas:
            direccion, aspecto = VISTAS[vista]
            cam, eje_x, eje_y = camara(escena, centro, radio, direccion, aspecto)
            encuadrar(cam, objetos, eje_x, eje_y, aspecto)
            escena.render.filepath = os.path.join(salida, f"{vista}_{clave_estilo}.png")
            bpy.ops.render.render(write_still=True)
            print(f"[lineas] {escena.render.filepath}")
            bpy.data.objects.remove(cam)


main()

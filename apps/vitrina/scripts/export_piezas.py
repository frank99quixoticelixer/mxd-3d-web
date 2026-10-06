"""Exporta cada pieza del MX80 (un .blend por pieza) a GLB para la ficha del catalogo.

Uso:
  blender -b -P scripts/export_piezas.py -- <carpeta_blend> <carpeta_salida>

<carpeta_blend> contiene mx80-motor.blend, mx80-tubo-carbono.blend y piezas/mx80-*.blend.
Salida: <carpeta_salida>/MX80-00X_v1.glb
"""
import os
import sys
import bpy
from mathutils import Vector

origen, salida = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(salida, exist_ok=True)

# SKU -> archivos .blend (relativos a origen); las piezas dobles se combinan en un GLB.
PIEZAS = {
    "MX80-001": ["piezas/mx80-balanceador_helice_sup.blend"],
    "MX80-002": ["piezas/mx80-balanceador_helice_inf.blend"],
    "MX80-003": ["piezas/mx80-sujetador_balanceador_1.blend", "piezas/mx80-sujetador_balanceador_2.blend"],
    "MX80-004": ["piezas/mx80-Propela_CW_1.blend", "piezas/mx80-Propela_CW_2.blend"],
    "MX80-005": ["piezas/mx80-sujetador_motor.blend"],
    "MX80-006": ["piezas/mx80-cubierta_motor.blend"],
    "MX80-007": ["mx80-motor.blend"],
    "MX80-008": ["mx80-tubo-carbono.blend"],
    "MX80-009": ["piezas/mx80-ESC_300A.blend"],
    "MX80-010": ["piezas/mx80-base_ESC.blend"],
}

def aplanar_procedurales():
    """glTF no soporta nodos procedurales: se sustituyen por valores constantes
    (punto medio de la rampa de color y del rango de rugosidad)."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nodos = m.node_tree.nodes
        for b in [n for n in nodos if n.bl_idname == "ShaderNodeBsdfPrincipled"]:
            for nombre in ("Base Color", "Roughness", "Normal"):
                entrada = b.inputs[nombre]
                if not entrada.is_linked:
                    continue
                arriba, pendientes = [], [entrada.links[0].from_node]
                while pendientes:
                    n = pendientes.pop()
                    arriba.append(n)
                    for i in n.inputs:
                        pendientes += [l.from_node for l in i.links]
                if any(n.bl_idname == "ShaderNodeTexImage" for n in arriba):
                    continue
                if nombre == "Base Color":
                    rampa = next((n for n in arriba if n.bl_idname == "ShaderNodeValToRGB"), None)
                    if rampa:
                        e = rampa.color_ramp.elements
                        entrada.default_value = [(e[0].color[k] + e[-1].color[k]) / 2 for k in range(4)]
                elif nombre == "Roughness":
                    rango = next((n for n in arriba if n.bl_idname == "ShaderNodeMapRange"), None)
                    if rango:
                        entrada.default_value = (rango.inputs["To Min"].default_value + rango.inputs["To Max"].default_value) / 2
                m.node_tree.links.remove(entrada.links[0])
            # Sin mapa de entorno HDRI, un metal casi espejo se ve con manchas blancas y negras.
            b.inputs["Metallic"].default_value = min(b.inputs["Metallic"].default_value, 0.45)
            b.inputs["Roughness"].default_value = max(b.inputs["Roughness"].default_value, 0.5)


for sku, archivos in PIEZAS.items():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(origen, archivos[0]))
    for extra in archivos[1:]:
        with bpy.data.libraries.load(os.path.join(origen, extra), link=False) as (de, a):
            a.objects = list(de.objects)
        for o in a.objects:
            if o is not None:
                bpy.context.scene.collection.objects.link(o)

    aplanar_procedurales()
    mallas = [o for o in bpy.context.scene.objects if o.type == "MESH"]

    # Piezas dobles (dos tuercas, dos helices): en el ensamble estan en brazos
    # distintos; aqui se centran y se ponen lado a lado para verlas juntas.
    if len(mallas) == 2:
        def medidas(o):
            esq = [o.matrix_world @ Vector(c) for c in o.bound_box]
            c = sum(esq, Vector()) / 8
            dim = [max(v[i] for v in esq) - min(v[i] for v in esq) for i in range(3)]
            return c, dim
        datos = [medidas(o) for o in mallas]
        plana = all(d[2] < max(d[0], d[1]) * 0.2 for _, d in datos)
        for o, (c, d), lado in zip(mallas, datos, (-1, 1)):
            if plana:
                # Helices: una sobre otra, para que el par quede compacto.
                separacion = (datos[0][1][2] + datos[1][1][2]) / 2 + max(d[0], d[1]) * 0.07
                desplaza = Vector((0, 0, lado * separacion / 2))
            else:
                separacion = (datos[0][1][0] + datos[1][1][0]) / 2 * 1.15
                desplaza = Vector((lado * separacion / 2, 0, 0))
            o.location = o.location - c + desplaza
        bpy.context.view_layer.update()

    for o in bpy.context.scene.objects:
        o.hide_set(False)
        o.select_set(o.type == "MESH")

    ruta = os.path.join(salida, f"{sku}_v1.glb")
    bpy.ops.export_scene.gltf(
        filepath=ruta,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    print("EXPORTADO", sku, os.path.getsize(ruta))

"""
Exportacion automatizada de Blender a glTF/GLB para el sitio web de MXD.

Se ejecuta con Blender en modo headless (sin abrir la interfaz):

    blender -b MX80_ensamble.blend -P scripts/export_web.py -- --salida ./salida --modo ambos

Argumentos (todos van despues de los dos guiones):
    --salida RUTA      Carpeta destino. Por defecto ./salida
    --modo MODO        ensamble | piezas | ambos        (por defecto: ambos)
    --nombre NOMBRE    Nombre base del ensamble         (por defecto: ensamble)
    --version N        Numero de version del archivo    (por defecto: 1)
    --sin-aplicar      No aplica modificadores al exportar

Que hace
    1. Exporta un GLB con TODO el ensamble, conservando los nombres de los
       objetos y sus propiedades personalizadas (mxd_sku).
    2. Exporta un GLB por cada objeto de primer nivel, para las fichas
       individuales del catalogo.
    3. Escribe manifiesto.json con el inventario de lo exportado: nombres,
       SKU detectado, numero de triangulos y dimensiones. Ese archivo es
       el que sirve para verificar que todo coincide con src/data/mx80.ts

ADVERTENCIA
    El script NO modifica el archivo .blend. Trabaja sobre la escena en
    memoria y Blender se cierra sin guardar.
"""

import json
import os
import sys

import bpy  # type: ignore
from mathutils import Vector  # type: ignore


# ---------------------------------------------------------------
# Argumentos
# ---------------------------------------------------------------
def leer_argumentos():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []

    opciones = {
        "salida": "./salida",
        "modo": "ambos",
        "nombre": "ensamble",
        "version": "1",
        "aplicar": True,
    }

    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--salida":
            opciones["salida"] = argv[i + 1]
            i += 2
        elif a == "--modo":
            opciones["modo"] = argv[i + 1]
            i += 2
        elif a == "--nombre":
            opciones["nombre"] = argv[i + 1]
            i += 2
        elif a == "--version":
            opciones["version"] = argv[i + 1]
            i += 2
        elif a == "--sin-aplicar":
            opciones["aplicar"] = False
            i += 1
        else:
            print(f"[MXD] Argumento no reconocido: {a}")
            i += 1

    if opciones["modo"] not in ("ensamble", "piezas", "ambos"):
        raise SystemExit(f"[MXD] Modo invalido: {opciones['modo']}")

    return opciones


# ---------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------
def exportar_gltf(**kwargs):
    """
    Llama al exportador filtrando los parametros que la version instalada
    de Blender realmente soporta. Evita que el script se rompa al cambiar
    de Blender 3.x a 4.x.
    """
    soportados = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    filtrados = {k: v for k, v in kwargs.items() if k in soportados}
    ignorados = set(kwargs) - set(filtrados)
    if ignorados:
        print(f"[MXD] Parametros no soportados por esta version: {sorted(ignorados)}")
    bpy.ops.export_scene.gltf(**filtrados)


def objetos_exportables():
    """Objetos de primer nivel visibles que contienen geometria."""
    resultado = []
    for obj in bpy.context.scene.objects:
        if obj.parent is not None:
            continue
        if obj.hide_render:
            continue
        # Un vacio con hijos tambien cuenta: agrupa una pieza.
        if obj.type == "MESH" or (obj.type == "EMPTY" and len(obj.children) > 0):
            resultado.append(obj)
    return resultado


def contar_triangulos(obj, depsgraph):
    total = 0
    for nodo in [obj] + list(obj.children_recursive):
        if nodo.type != "MESH":
            continue
        evaluado = nodo.evaluated_get(depsgraph)
        malla = evaluado.to_mesh()
        try:
            malla.calc_loop_triangles()
            total += len(malla.loop_triangles)
        finally:
            evaluado.to_mesh_clear()
    return total


def dimensiones_mm(obj):
    """Dimensiones envolventes en milimetros, segun la escala de la escena."""
    escala = bpy.context.scene.unit_settings.scale_length or 1.0
    d: Vector = obj.dimensions
    return [round(v * escala * 1000.0, 2) for v in (d.x, d.y, d.z)]


def seleccionar_solo(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for hijo in obj.children_recursive:
        hijo.select_set(True)
    bpy.context.view_layer.objects.active = obj


def nombre_archivo(texto):
    seguro = "".join(c if c.isalnum() or c in "-_" else "_" for c in texto)
    return seguro.strip("_")


# ---------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------
def main():
    opciones = leer_argumentos()
    salida = os.path.abspath(opciones["salida"])
    os.makedirs(salida, exist_ok=True)
    carpeta_piezas = os.path.join(salida, "piezas")

    # Asegurar modo objeto (si el .blend quedo guardado en modo edicion).
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    depsgraph = bpy.context.evaluated_depsgraph_get()
    objetos = objetos_exportables()

    if not objetos:
        raise SystemExit("[MXD] No se encontraron objetos exportables en la escena.")

    print(f"[MXD] Objetos de primer nivel detectados: {len(objetos)}")

    comunes = dict(
        export_format="GLB",
        export_apply=opciones["aplicar"],
        export_extras=True,       # <- exporta las propiedades personalizadas (mxd_sku)
        export_yup=True,          # convencion glTF: Y hacia arriba
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )

    manifiesto = {
        "archivo_blend": os.path.basename(bpy.data.filepath) or "(sin guardar)",
        "version": opciones["version"],
        "unidad_escena": bpy.context.scene.unit_settings.length_unit,
        "objetos": [],
        "sin_sku": [],
    }

    # ---- Inventario ----
    for obj in objetos:
        sku = obj.get("mxd_sku")
        registro = {
            "nombre": obj.name,
            "mxd_sku": sku,
            "tipo": obj.type,
            "triangulos": contar_triangulos(obj, depsgraph),
            "dimensiones_mm": dimensiones_mm(obj),
            "hijos": len(obj.children_recursive),
        }
        manifiesto["objetos"].append(registro)
        if not sku:
            manifiesto["sin_sku"].append(obj.name)

    # ---- Ensamble completo ----
    if opciones["modo"] in ("ensamble", "ambos"):
        destino = os.path.join(
            salida,
            f"{nombre_archivo(opciones['nombre'])}_v{opciones['version']}.glb",
        )
        bpy.ops.object.select_all(action="DESELECT")
        exportar_gltf(filepath=destino, use_selection=False, **comunes)
        print(f"[MXD] Ensamble exportado -> {destino}")
        manifiesto["ensamble"] = os.path.basename(destino)

    # ---- Piezas individuales ----
    if opciones["modo"] in ("piezas", "ambos"):
        os.makedirs(carpeta_piezas, exist_ok=True)
        for obj in objetos:
            sku = obj.get("mxd_sku") or nombre_archivo(obj.name)
            destino = os.path.join(
                carpeta_piezas,
                f"{nombre_archivo(str(sku))}_v{opciones['version']}.glb",
            )
            seleccionar_solo(obj)
            exportar_gltf(filepath=destino, use_selection=True, **comunes)
            print(f"[MXD] Pieza exportada -> {destino}")
        bpy.ops.object.select_all(action="DESELECT")

    # ---- Manifiesto ----
    ruta_manifiesto = os.path.join(salida, "manifiesto.json")
    with open(ruta_manifiesto, "w", encoding="utf-8") as f:
        json.dump(manifiesto, f, ensure_ascii=False, indent=2)
    print(f"[MXD] Manifiesto escrito -> {ruta_manifiesto}")

    total_tri = sum(o["triangulos"] for o in manifiesto["objetos"])
    print(f"[MXD] Total de triangulos en el ensamble: {total_tri:,}")
    if total_tri > 600_000:
        print(
            "[MXD] AVISO: el ensamble supera 600 000 triangulos. "
            "Aplica decimacion en Blender antes de publicar; de lo contrario "
            "el visor sera lento en equipos modestos y en telefonos."
        )
    if manifiesto["sin_sku"]:
        print(
            "[MXD] AVISO: objetos sin propiedad mxd_sku "
            f"({len(manifiesto['sin_sku'])}): {manifiesto['sin_sku']}"
        )
        print(
            "[MXD]        El visor intentara emparejarlos por nombre. "
            "Para un vinculo estable agrega la propiedad personalizada mxd_sku."
        )


if __name__ == "__main__":
    main()

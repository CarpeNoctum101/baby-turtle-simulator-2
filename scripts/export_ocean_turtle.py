"""Run in free Blender: blender -b --factory-startup --disable-autoexec --python scripts/export_ocean_turtle.py

Converts the supplied Ocean Turtle.zip into native Babylon vertex data and textures.
No add-ons, network calls or extra Python packages. The supplied archive stays intact.
"""
import json
import math
from pathlib import Path
import tempfile
from zipfile import ZipFile

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/assets/ocean-turtle"
OUTPUT.mkdir(parents=True, exist_ok=True)
SCALE = 0.8
BONES = [
    {"name": "frontLeft", "side": 1, "role": "front", "pivot": (0.40, 0.29, 0.015)},
    {"name": "frontRight", "side": -1, "role": "front", "pivot": (-0.40, 0.29, 0.015)},
    {"name": "rearLeft", "side": 1, "role": "rear", "pivot": (0.31, -0.48, -0.025)},
    {"name": "rearRight", "side": -1, "role": "rear", "pivot": (-0.31, -0.48, -0.025)},
]


def smooth(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def influence(p):
    x, y, z = p
    front = smooth(0.36, 0.60, abs(x)) * smooth(-0.02, 0.16, y)
    rear = smooth(0.24, 0.48, abs(x)) * (1 - smooth(-0.48, -0.32, y))
    index = (0 if front >= rear else 2) + (0 if x >= 0 else 1)
    return index, max(front, rear)


def rotate(v, side):
    # Raise the authored swimming flippers into a low beach-crawling rest pose.
    angle = 0.6 * side
    c, s = math.cos(angle), math.sin(angle)
    return Vector((c * v.x - s * v.z, v.y, s * v.x + c * v.z))


def posed(p, normal=None):
    index, weight = influence(p)
    bone = BONES[index]
    pivot = Vector(bone["pivot"])
    if normal is not None:
        return normal.lerp(rotate(normal, bone["side"]), weight).normalized()
    return p.lerp(pivot + rotate(p - pivot, bone["side"]), weight)


with tempfile.TemporaryDirectory(prefix="ocean-turtle-") as directory:
    source = Path(directory)
    with ZipFile(ROOT / "Ocean Turtle.zip") as archive:
        # Only known files; never run scripts embedded in the supplied .blend.
        for name in ["turtle.blend", "BLENDSWAP_LICENSE.txt", *[
            f"tex/turtle_{kind}.png" for kind in ["color", "detail", "eyelid_color", "normal", "spec"]
        ]]:
            archive.extract(name, source)
    bpy.ops.wm.open_mainfile(filepath=str(source / "turtle.blend"), use_scripts=False)
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        evaluated_obj = obj.evaluated_get(graph)
        mesh = evaluated_obj.to_mesh(preserve_all_data_layers=True, depsgraph=graph)
        mesh.calc_loop_triangles()
        evaluated.append((obj, evaluated_obj, mesh))
    minimum = min(posed(obj.matrix_world @ v.co).z if obj.name == "body"
                  else (obj.matrix_world @ v.co).z
                  for obj, _, mesh in evaluated for v in mesh.vertices)
    lift = -minimum * SCALE + 0.035

    def point(p):
        # Blender Z-up/+Y forward -> Babylon Y-up/+Z forward (left handed).
        return [round(p.x * SCALE, 6), round(p.z * SCALE + lift, 6), round(p.y * SCALE, 6)]

    parts = {}
    lookups = {}
    for obj, evaluated_obj, mesh in evaluated:
        uv = mesh.uv_layers.active.data
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            center = obj.matrix_world @ triangle.center
            if obj.name == "body":
                ellipse = (center.x / 0.49) ** 2 + ((center.y + 0.1) / 0.66) ** 2
                kind = "shell" if center.z > 0.06 and center.y < 0.43 and ellipse < 1.12 else "skin"
            else:
                kind = "eyes" if "eyeball" in obj.name else "eyelids"
            part = parts.setdefault(kind, {"positions": [], "normals": [], "uvs": [], "indices": [], "boneIndices": [], "boneWeights": []})
            lookup = lookups.setdefault(kind, {})
            # Preserve Blender winding: the handedness change makes these front faces in Babylon.
            for loop_index in triangle.loops:
                loop = mesh.loops[loop_index]
                original = obj.matrix_world @ mesh.vertices[loop.vertex_index].co
                n = (normal_matrix @ loop.normal).normalized()
                bone_index, weight = influence(original) if obj.name == "body" else (0, 0)
                p = posed(original) if obj.name == "body" else original
                n = posed(original, n) if obj.name == "body" else n
                normal = [round(n.x, 6), round(n.z, 6), round(n.y, 6)]
                texcoord = [round(value, 6) for value in uv[loop_index].uv]
                values = (*point(p), *normal, *texcoord, bone_index, round(weight, 6))
                index = lookup.get(values)
                if index is None:
                    index = len(part["positions"]) // 3
                    lookup[values] = index
                    part["positions"].extend(point(p)); part["normals"].extend(normal); part["uvs"].extend(texcoord)
                    part["boneIndices"].extend([0, bone_index + 1, 0, 0])
                    part["boneWeights"].extend([round(1 - weight, 6), round(weight, 6), 0, 0])
                part["indices"].append(index)
        evaluated_obj.to_mesh_clear()

    data = {
        "source": "Ocean Turtle by der_On, CC BY 3.0; user-supplied Ocean Turtle.zip",
        "forward": "+Z", "up": "+Y", "groundClearance": 0.035,
        "bones": [{**b, "pivot": point(Vector(b["pivot"]))} for b in BONES],
        "parts": [{"name": name, **part} for name, part in parts.items()],
    }
    (OUTPUT / "mesh.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")

    # The 2013 file uses an object-space (rainbow) normal map, not a modern tangent
    # normal map. Bake it through Blender so it remains correct on animated flippers.
    body = bpy.data.objects["body"]
    material = body.data.materials[0]
    material.use_nodes = True
    nodes = material.node_tree.nodes
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.image = bpy.data.images.load(str(source / "tex/turtle_normal.png"), check_existing=False)
    image_node.image.colorspace_settings.name = "Non-Color"
    normal_node = nodes.new("ShaderNodeNormalMap")
    normal_node.space = "OBJECT"
    material.node_tree.links.new(image_node.outputs["Color"], normal_node.inputs["Color"])
    material.node_tree.links.new(normal_node.outputs["Normal"], nodes.get("Principled BSDF").inputs["Normal"])
    baked = bpy.data.images.new("TangentNormal", width=1024, height=1024, alpha=False)
    baked.colorspace_settings.name = "Non-Color"
    target = nodes.new("ShaderNodeTexImage"); target.image = baked; nodes.active = target
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True); bpy.context.view_layer.objects.active = body
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 1
    scene.render.bake.margin = 12
    bpy.ops.object.bake(type="NORMAL")
    baked.file_format = "PNG"; baked.filepath_raw = str(OUTPUT / "normal.png"); baked.save()

    for name, size, color in [("color", 2048, True), ("eyelid_color", 128, True)]:
        image = bpy.data.images.load(str(source / f"tex/turtle_{name}.png"), check_existing=False)
        if not color:
            image.colorspace_settings.name = "Non-Color"
        image.scale(size, size)
        image.file_format = "JPEG" if color else "PNG"
        image.filepath_raw = str(OUTPUT / f"{name}.{'jpg' if color else 'png'}")
        image.save()
    credits = ROOT / "public/credits"
    credits.mkdir(parents=True, exist_ok=True)
    (credits / "ocean-turtle.txt").write_text(
        (source / "BLENDSWAP_LICENSE.txt").read_text() +
        "\nProject adaptations: subdivision level 1, coordinate/scale conversion, crawling rest pose,\n"
        "flipper skin weights, material separation and resized/compressed textures.\n"
        "Original archive retained as Ocean Turtle.zip. Converter: scripts/export_ocean_turtle.py.\n"
    )
    print("EXPORTED", [(p["name"], len(p["positions"]) // 3, len(p["indices"]) // 3) for p in data["parts"]])
    print("ASSET_BYTES", sum(p.stat().st_size for p in OUTPUT.iterdir()))

"""Author the runtime hand assets for Chord Hero from the bundled CC0 rig.

Run this file from Blender's Python console with
``assets/cc0-hands/Hands + armature.blend`` open.  Blender's
background mode is not reliable on the development Mac, so this script is
intentionally GUI-safe and only writes the two runtime GLBs plus source
attribution.  The source .blend is never saved or modified.

The source contains one independently weighted armature for each hand.  The
export keeps the armature and all finger bones (rather than baking a static
mesh), then adds a smooth connected forearm parented to the wrist bone.  The
runtime retargeter maps the source's Bone.* names to its canonical contact
schema.
"""

from pathlib import Path
import math

import bpy
import bmesh
from mathutils import Matrix, Vector


source_path = Path(bpy.data.filepath).resolve()
if source_path.name != "Hands + armature.blend":
    raise RuntimeError("Open the CC0 Hands + armature.blend source before running this script.")

if source_path.parent.name == "cc0-hands" and source_path.parents[1].name == "assets":
    project_root = source_path.parents[2]
else:
    project_root = source_path.parents[3] / "Chord Hero"
output_dir = project_root / "public/models/guitar-technique"
output_dir.mkdir(parents=True, exist_ok=True)

SOURCE_BY_SIDE = {
    "right": ("Hand_Right", "Hand.R"),
    "left": ("Hand_Left", "Hand.L"),
}
WRIST_BONE = "Bone.016"
WRIST_BONE_LENGTH = 0.21000023
# The source hand's visible wrist surface is at the native Bone.016 head;
# its negative axial extent is an open authoring-scene stump, not anatomy that
# should be exported.  Keep a small overlap on the elbow side of that plane
# so the generated forearm cap cannot expose a seam after skinning.
WRIST_ATTACH_AXIAL = -0.020
WRIST_TRIM_AXIAL = -0.040
AUTHORED_PREFIX = "Chord Hero CC0"
MAX_RUNTIME_HAND_TRIANGLES = 24000
MIN_RUNTIME_HAND_TRIANGLES = 6000

# Canonical endpoint bones used by the runtime contact solver.  The Blender
# file has no explicit fingertip joints after the distal phalanges, so export
# a tiny empty at each *actual* bone tail.  The runtime turns those marker
# positions into non-skinned tip bones; no guessed universal tail length is
# involved.
DISTAL_TAIL_BONES = {
    "index-finger": "Bone.002",
    "middle-finger": "Bone.005",
    "ring-finger": "Bone.008",
    "pinky-finger": "Bone.011",
    "thumb": "Bone.019",
}

# The supplied source blend is an interactive authoring scene and may be left
# on an arbitrary animation frame (including a posed frame).  Always export a
# neutral rest-pose duplicate; the source file itself is never saved.
bpy.context.scene.frame_set(0)
for _armature in bpy.data.objects:
    if _armature.type == "ARMATURE":
        _armature.data.pose_position = "REST"


def skin_material():
    material = bpy.data.materials.new(f"{AUTHORED_PREFIX} | Skin")
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (0.55, 0.30, 0.22, 1.0)
    shader.inputs["Roughness"].default_value = 0.55
    for socket_name, value in (("Subsurface Weight", 0.045), ("Sheen Weight", 0.08), ("Specular IOR Level", 0.28)):
        socket = shader.inputs.get(socket_name)
        if socket is not None:
            socket.default_value = value
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = (0.55, 0.30, 0.22, 1.0)
    return material


def source_wrist_cut(armature, hand):
    """Measure the actual open wrist boundary from the supplied mesh.

    The CC0 mesh contains a short wrist/forearm stump.  Its cut plane is not
    reliably reconstructed from a guessed tube axis: measure the source
    vertices in armature space, relative to the native wrist bone, and fit a
    transverse ellipse around the visible head plane.  This keeps the
    authored extension tangent to the real mesh on both bilateral sources.
    """
    bone = armature.data.bones.get(WRIST_BONE)
    if bone is None:
        raise RuntimeError(f"Source armature {armature.name} is missing {WRIST_BONE} wrist bone.")
    mesh_to_armature = armature.matrix_world.inverted() @ hand.matrix_world
    axis = (bone.tail_local - bone.head_local).normalized()
    side_axis = bone.x_axis.normalized()
    binormal_axis = bone.z_axis.normalized()
    index_metacarpal = armature.data.bones.get("Bone")
    pinky_metacarpal = armature.data.bones.get("Bone.009")
    lateral_axis = side_axis.copy()
    if index_metacarpal is not None and pinky_metacarpal is not None:
        lateral_axis = (pinky_metacarpal.head_local - index_metacarpal.head_local)
        lateral_axis = lateral_axis - axis * lateral_axis.dot(axis)
        if lateral_axis.length > 1e-6:
            lateral_axis.normalize()
        else:
            lateral_axis = side_axis.copy()
    samples = []
    for vertex in hand.data.vertices:
        point = mesh_to_armature @ vertex.co
        relative = point - bone.head_local
        axial = relative.dot(axis)
        samples.append((axial, relative.dot(side_axis), relative.dot(binormal_axis)))
    if not samples:
        raise RuntimeError(f"Source hand {hand.name} has no vertices to measure wrist cut.")
    # Measure the wrist ellipse around the visible head plane.  Sampling the
    # remote axial minimum includes the source stump and inflated the old
    # forearm to palm width; it also left two disconnected tubes in runtime.
    boundary = WRIST_ATTACH_AXIAL
    boundary_points = [(x, z) for axial, x, z in samples if boundary - 0.08 <= axial <= boundary + 0.12]
    if not boundary_points:
        boundary_points = [(0.0, 0.0)]
    centroid_x = sum(point[0] for point in boundary_points) / len(boundary_points)
    centroid_z = sum(point[1] for point in boundary_points) / len(boundary_points)
    covariance_xx = sum((point[0] - centroid_x) ** 2 for point in boundary_points)
    covariance_xz = sum((point[0] - centroid_x) * (point[1] - centroid_z) for point in boundary_points)
    covariance_zz = sum((point[1] - centroid_z) ** 2 for point in boundary_points)
    radial_angle = 0.5 * math.atan2(2.0 * covariance_xz, covariance_xx - covariance_zz)
    cos_angle = math.cos(radial_angle)
    sin_angle = math.sin(radial_angle)
    ellipse_x = sorted(abs((point[0] - centroid_x) * cos_angle + (point[1] - centroid_z) * sin_angle) for point in boundary_points)
    ellipse_z = sorted(abs(-(point[0] - centroid_x) * sin_angle + (point[1] - centroid_z) * cos_angle) for point in boundary_points)
    quantile_index = min(len(boundary_points) - 1, max(0, int(len(boundary_points) * 0.82)))
    radius_x = min(0.060, max(0.040, ellipse_x[quantile_index]))
    radius_z = min(0.060, max(0.040, ellipse_z[quantile_index]))
    cut_center = bone.head_local + axis * boundary + side_axis * centroid_x + binormal_axis * centroid_z
    print(
        f"CHORD_HERO_CC0_WRIST_CUT={hand.name}:axial={boundary:.6f}:radius=({radius_x:.6f},{radius_z:.6f})"
        f":centroid=({centroid_x:.6f},{centroid_z:.6f}):angle={radial_angle:.6f}"
    )
    return cut_center, axis, side_axis, binormal_axis, lateral_axis, radius_x, radius_z, radial_angle


def trim_wrist_stump(armature, hand):
    """Bisect only the exposed negative-axial source stump on the clone."""
    bone = armature.data.bones[WRIST_BONE]
    axis = (bone.tail_local - bone.head_local).normalized()
    mesh_to_armature = armature.matrix_world.inverted() @ hand.matrix_world
    plane_co = mesh_to_armature.inverted() @ (bone.head_local + axis * WRIST_TRIM_AXIAL)
    plane_no = (mesh_to_armature.inverted().to_3x3() @ axis).normalized()
    bmesh_data = bmesh.new()
    bmesh_data.from_mesh(hand.data)
    try:
        bmesh.ops.bisect_plane(
            bmesh_data,
            geom=list(bmesh_data.verts) + list(bmesh_data.edges) + list(bmesh_data.faces),
            dist=0.0001,
            plane_co=plane_co,
            plane_no=plane_no,
            clear_inner=True,
            clear_outer=False,
        )
        # Blender's clear_inner convention has changed across releases and
        # source-armature orientations. Enforce the measured axial boundary
        # explicitly as a second guard so the original open stump cannot be
        # exported as a second, full-width cap beside the generated forearm.
        stale_stump = []
        for vertex in bmesh_data.verts:
            armature_point = mesh_to_armature @ vertex.co
            axial = (armature_point - bone.head_local).dot(axis)
            if axial < WRIST_TRIM_AXIAL:
                stale_stump.append(vertex)
        if stale_stump:
            bmesh.ops.delete(bmesh_data, geom=stale_stump, context="VERTS")
        print(f"CHORD_HERO_CC0_WRIST_TRIM_VERTICES={hand.name}:{len(stale_stump)}")
        bmesh_data.to_mesh(hand.data)
        hand.data.update()
    finally:
        bmesh_data.free()
    print(f"CHORD_HERO_CC0_WRIST_TRIM={hand.name}:axial={WRIST_TRIM_AXIAL:.6f}")


def forearm_mesh(name, wrist_cut, armature, forearm):
    """Create a tapered forearm in the already-resolved bone-child frame."""
    cut_center, axis, side_axis, binormal_axis, lateral_axis, cut_radius_x, cut_radius_z, radial_angle = wrist_cut
    # Resolve the actual bone-child transform at rest. Mapping measured source
    # points through this inverse avoids assumptions about Blender's tail
    # origin, exporter Y-up conversion, or bilateral wrist orientation.
    bpy.context.view_layer.update()
    armature_to_world = armature.matrix_world
    child_world_to_local = forearm.matrix_world.inverted()
    rings = (
        # These short palm-side rings form a buried dome. The first cap is
        # inside the trimmed hand volume; the broad wrist ring is therefore
        # never exposed as an open circular cuff over the soundhole.
        (-0.14, cut_radius_x * 0.24, cut_radius_z * 0.24),
        (-0.09, cut_radius_x * 0.52, cut_radius_z * 0.52),
        (-0.05, cut_radius_x * 0.78, cut_radius_z * 0.78),
        (-0.025, cut_radius_x * 0.94, cut_radius_z * 0.94),
        (0.035, cut_radius_x * 0.98, cut_radius_z * 0.98),
        # A real forearm widens from the wrist toward the elbow. Make that
        # measured loft visible in the picking camera instead of producing a
        # constant-radius procedural tube.
        (0.09, cut_radius_x * 1.02, cut_radius_z * 1.02),
        (0.16, cut_radius_x * 1.08, cut_radius_z * 1.08),
        (0.23, cut_radius_x * 1.15, cut_radius_z * 1.15),
        (0.32, cut_radius_x * 1.22, cut_radius_z * 1.22),
        (0.44, cut_radius_x * 1.28, cut_radius_z * 1.28),
        (0.58, cut_radius_x * 1.30, cut_radius_z * 1.30),
        (0.70, cut_radius_x * 1.20, cut_radius_z * 1.20),
        (0.80, cut_radius_x * 0.96, cut_radius_z * 0.96),
        (0.88, cut_radius_x * 0.66, cut_radius_z * 0.66),
        (0.94, cut_radius_x * 0.38, cut_radius_z * 0.38),
        # End in a near-point rather than a visible flat cap. A slight bend
        # at the imported wrist object routes this realistic-length forearm
        # away from the spruce surface before this terminal is reached.
        (0.98, cut_radius_x * 0.005, cut_radius_z * 0.005),
    )
    radial_segments = 18
    vertices = []
    faces = []
    for distance, radius_x, radius_z in rings:
        for segment in range(radial_segments):
            angle = math.tau * segment / radial_segments
            unrotated_x = math.cos(angle) * radius_x
            unrotated_z = math.sin(angle) * radius_z
            radial_side = side_axis * (math.cos(radial_angle) * unrotated_x - math.sin(radial_angle) * unrotated_z)
            radial_binormal = binormal_axis * (math.sin(radial_angle) * unrotated_x + math.cos(radial_angle) * unrotated_z)
            # The picking basis maps the native lateral axis to camera
            # screen-left. Arc the elbow through that measured frame after
            # the wrist, rather than rotating the finished object around an
            # arbitrary runtime axis that can drive the arm vertically. The
            # wider elbow sweep places the rounded terminal outside the lower
            # bout instead of displaying a needle-like cap over spruce.
            lateral_bend = lateral_axis * (min(0.55, max(0.0, distance - 0.30) * 0.80))
            # The resolved Bone.016 child frame maps the negative source axial
            # direction toward the elbow/lower bout in the emitted asset.
            # Keep the broad wrist ring near the hand and carry the tapered
            # terminal toward the lower-bout side of the picking view.
            source_point = cut_center - axis * distance + lateral_bend + radial_side + radial_binormal
            world_point = armature_to_world @ source_point
            vertices.append(tuple(child_world_to_local @ world_point))
    for ring in range(len(rings) - 1):
        for segment in range(radial_segments):
            a = ring * radial_segments + segment
            b = ring * radial_segments + (segment + 1) % radial_segments
            c = (ring + 1) * radial_segments + (segment + 1) % radial_segments
            d = (ring + 1) * radial_segments + segment
            faces.append((a, b, c, d))
    faces.append(tuple(index for index in reversed(range(radial_segments))))
    final = (len(rings) - 1) * radial_segments
    faces.append(tuple(final + index for index in range(radial_segments)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def source_objects(side):
    armature_name, hand_name = SOURCE_BY_SIDE[side]
    armature = bpy.data.objects.get(armature_name)
    hand = bpy.data.objects.get(hand_name)
    if armature is None or hand is None:
        raise RuntimeError(f"Source side {side} is missing {armature_name} or {hand_name}.")
    if armature.type != "ARMATURE" or hand.type != "MESH":
        raise RuntimeError(f"Source side {side} has unexpected object types.")
    if armature.data.bones.get(WRIST_BONE) is None:
        raise RuntimeError(f"Source armature {armature_name} is missing {WRIST_BONE} wrist bone.")
    return armature, hand


def cap_hand_density(hand):
    """Bound unusually dense source meshes without touching the source data."""
    # The bundled left source can carry Armature -> Subsurf ordering at a
    # higher viewport level than the right source. Normalize the duplicate to
    # topology modifiers first, then skin last, so decimation sees the smooth
    # evaluated surface without baking the armature into vertex positions.
    for modifier in hand.modifiers:
        if modifier.type == "SUBSURF":
            modifier.levels = min(modifier.levels, 1)
            modifier.render_levels = min(modifier.render_levels, 1)
    ordered = [modifier for modifier in hand.modifiers if modifier.type != "ARMATURE"]
    ordered.extend(modifier for modifier in hand.modifiers if modifier.type == "ARMATURE")
    for target_index, modifier in enumerate(ordered):
        current_index = hand.modifiers.find(modifier.name)
        if current_index != target_index:
            hand.modifiers.move(current_index, target_index)
    # Count evaluated geometry so a source subdivision modifier cannot hide a
    # large export behind a tiny base mesh.  The evaluated copy is temporary
    # and never changes the source blend.
    triangles = 0
    try:
        evaluated = hand.evaluated_get(bpy.context.evaluated_depsgraph_get())
        evaluated_mesh = evaluated.to_mesh()
        triangles = sum(max(0, len(poly.vertices) - 2) for poly in evaluated_mesh.polygons)
        evaluated.to_mesh_clear()
    except (AttributeError, RuntimeError):
        triangles = sum(max(0, len(poly.vertices) - 2) for poly in hand.data.polygons)
    if triangles > MAX_RUNTIME_HAND_TRIANGLES:
        ratio = MAX_RUNTIME_HAND_TRIANGLES / triangles
        modifier = hand.modifiers.new("Chord Hero runtime triangle cap", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        # Decimate before the armature modifier so skin weights remain
        # meaningful and the exporter still emits a live skinned mesh.
        try:
            armature_index = next((index for index, item in enumerate(hand.modifiers) if item.type == "ARMATURE"), len(hand.modifiers))
            hand.modifiers.move(len(hand.modifiers) - 1, armature_index)
        except (AttributeError, TypeError, RuntimeError):
            pass
        print(f"CHORD_HERO_CC0_DECIMATE={hand.name}:{triangles}->{MAX_RUNTIME_HAND_TRIANGLES}")
    elif triangles < MIN_RUNTIME_HAND_TRIANGLES:
        # The right source is only ~2.2k triangles while the left source is
        # multires dense.  One subdivision gives both sides comparable smooth
        # silhouettes without exceeding the mobile budget.
        modifier = hand.modifiers.new("Chord Hero runtime smooth density", "SUBSURF")
        modifier.subdivision_type = "CATMULL_CLARK"
        modifier.levels = 1
        modifier.render_levels = 1
        try:
            armature_index = next((index for index, item in enumerate(hand.modifiers) if item.type == "ARMATURE"), len(hand.modifiers))
            hand.modifiers.move(len(hand.modifiers) - 1, armature_index)
        except (AttributeError, TypeError, RuntimeError):
            pass
        print(f"CHORD_HERO_CC0_SUBDIVIDE={hand.name}:{triangles}->~{triangles * 4}")
    for polygon in hand.data.polygons:
        polygon.use_smooth = True


def add_distal_tail_markers(side, armature):
    """Export actual source bone tails as named, non-rendering glTF nodes."""
    markers = []
    for finger, bone_name in DISTAL_TAIL_BONES.items():
        bone = armature.data.bones.get(bone_name)
        if bone is None:
            raise RuntimeError(f"{armature.name} is missing {bone_name} for {finger} tail marker.")
        marker = bpy.data.objects.new(f"Chord Hero CC0 {side} | tail | {finger}", None)
        bpy.context.scene.collection.objects.link(marker)
        marker.empty_display_type = "SPHERE"
        marker.empty_display_size = 0.001
        marker.parent = armature
        marker.parent_type = "BONE"
        marker.parent_bone = bone_name
        # Blender's bone-child origin is already the bone tail. Keeping this
        # local position at zero exports the exact source tail (not a second
        # tail-length beyond it).
        marker.matrix_parent_inverse = Matrix.Identity(4)
        marker.location = (0.0, 0.0, 0.0)
        marker["runtime"] = "CC0 distal bone tail marker"
        marker["finger"] = finger
        marker["source_bone"] = bone_name
        markers.append(marker)
    return markers


def duplicate_side(side):
    armature_source, hand_source = source_objects(side)
    armature = armature_source.copy()
    armature.data = armature_source.data.copy()
    armature.name = f"{AUTHORED_PREFIX} {side} | Armature"
    bpy.context.scene.collection.objects.link(armature)

    hand = hand_source.copy()
    hand.data = hand_source.data.copy()
    hand.name = f"{AUTHORED_PREFIX} {side} | Hand"
    bpy.context.scene.collection.objects.link(hand)
    # Keep the source's skin weights, but retarget its modifier to the cloned
    # armature so independent MCP/PIP/DIP rotations survive export.
    for modifier in hand.modifiers:
        if modifier.type == "ARMATURE":
            modifier.object = armature
    # Retain the source's exact local parent relationship. Using an
    # armature-wide inverse and then assigning matrix_world double-applies the
    # cloned parent relationship in glTF, separating the skin from the
    # skeleton by several world units at runtime.
    hand.parent = armature
    hand.parent_type = "OBJECT"
    hand.matrix_parent_inverse = hand_source.matrix_parent_inverse.copy()
    hand.matrix_basis = hand_source.matrix_basis.copy()

    # Preserve the CC0 source material slots and node/image references. The
    # source materials are copied onto the runtime clone so GLB embedding can
    # retain their supported texture maps; only a source-without-materials
    # fallback receives the authored skin shader.
    source_materials = [material.copy() for material in hand_source.data.materials if material is not None]
    if source_materials:
        hand.data.materials.clear()
        for source_material in source_materials:
            hand.data.materials.append(source_material)
        material = source_materials[0]
        print(f"CHORD_HERO_CC0_SOURCE_MATERIALS={hand.name}:{len(source_materials)}")
    else:
        material = skin_material()
        hand.data.materials.clear()
        hand.data.materials.append(material)
        print(f"CHORD_HERO_CC0_SOURCE_MATERIALS={hand.name}:fallback")
    wrist_cut = source_wrist_cut(armature, hand)
    trim_wrist_stump(armature, hand)
    cap_hand_density(hand)

    forearm_data = bpy.data.meshes.new(f"{AUTHORED_PREFIX} {side} | Forearm Mesh")
    forearm = bpy.data.objects.new(f"{AUTHORED_PREFIX} {side} | Forearm", forearm_data)
    bpy.context.scene.collection.objects.link(forearm)
    forearm.parent = armature
    forearm.parent_type = "BONE"
    forearm.parent_bone = WRIST_BONE
    # Bone parenting already supplies the wrist-bone frame.  An armature-wide
    # inverse here double-applies the source transform and visibly detaches
    # the forearm from the wrist in the exported GLB.
    forearm.matrix_parent_inverse = Matrix.Identity(4)
    forearm.data = forearm_mesh(
        f"{AUTHORED_PREFIX} {side} | Forearm Mesh",
        wrist_cut,
        armature,
        forearm,
    )
    forearm.data.materials.append(material)

    # glTF exports object custom properties into the asset metadata.  Retain
    # the license trail beside the files as well as on each exported object.
    for obj in (armature, hand, forearm):
        obj["source"] = "Hands Rigged / Hands + armature.blend"
        obj["license"] = "CC0 1.0"
        obj["runtime"] = "Skinned hand with independent finger bones and connected forearm"
    tail_markers = add_distal_tail_markers(side, armature)
    return armature, hand, forearm, tail_markers


def export_side(side):
    # Remove only prior generated objects; source objects remain untouched.
    for obj in list(bpy.data.objects):
        if obj.name.startswith(f"{AUTHORED_PREFIX} {side}"):
            bpy.data.objects.remove(obj, do_unlink=True)
    armature, hand, forearm, tail_markers = duplicate_side(side)
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in (armature, hand, forearm, *tail_markers):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    output = output_dir / f"cc0-{side}.glb"
    window = bpy.context.window
    view_area = next((area for area in window.screen.areas if area.type == "VIEW_3D"), None) if window else None
    if window and view_area:
        view_region = next(region for region in view_area.regions if region.type == "WINDOW")
        override = {"window": window, "area": view_area, "region": view_region}
        with bpy.context.temp_override(**override):
            bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
            bpy.ops.export_scene.gltf(
                filepath=str(output), export_format="GLB", use_selection=True,
                export_apply=True, export_yup=True, export_animations=False,
                export_nla_strips=False, export_skins=True, export_extras=True,
            )
    else:
        bpy.ops.export_scene.gltf(
            filepath=str(output), export_format="GLB", use_selection=True,
            export_apply=True, export_yup=True, export_animations=False,
            export_nla_strips=False, export_skins=True, export_extras=True,
        )
    triangles = sum(len(poly.vertices) - 2 for obj in (hand, forearm) for poly in obj.data.polygons)
    print(f"CHORD_HERO_CC0_OUTPUT={output}")
    print(f"CHORD_HERO_CC0_SIDE={side}")
    print(f"CHORD_HERO_CC0_TRIANGLES={triangles}")
    print("CHORD_HERO_CC0_SOURCE_UNMODIFIED=True")


for side in ("right", "left"):
    export_side(side)

license_path = output_dir / "CC0-HANDS-LICENSE.md"
license_path.write_text(
    """# Chord Hero CC0 hand assets

Source: `assets/cc0-hands/Hands + armature.blend` in this repository
License: CC0 1.0; original license: `92895 - LICENSE.html` in that source directory.

The runtime files `cc0-left.glb` and `cc0-right.glb` preserve the source
armature's independently weighted finger bones and add a connected
low-poly forearm. The source .blend is retained in `assets/cc0-hands/` for
reproducible authoring and is never modified by this script.
""",
    encoding="utf-8",
)
print(f"CHORD_HERO_CC0_LICENSE={license_path}")

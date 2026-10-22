"""Author a measured acoustic guitar GLB for Chord Hero in Blender.

This is a GUI-safe Blender script.  It does not import or ship the rejected
low-poly downloaded candidate.  Instead, it constructs the instrument from
the same physical constants used by ``lib/guitarTechnique3d.ts``:

* 25.5 inch scale, represented as 10.5 runtime units;
* 19.75 inch body length and 4.4 inch body depth;
* 20 visible frets, six strings, nut/saddle spreads, and sound-hole position.

The mesh is authored in engine coordinates (X across, Y up, Z from nut to
body) and converted to Blender's Z-up coordinates before glTF export.  Run it
from Blender's Python console; the source .blend, if any, is never saved.

The spruce/mahogany materials embed 64px generated grain images and subtle
height-to-normal bumps. No suitable external CC0 wood texture was available
locally, so the images are original deterministic data marked
CC0-compatible in their Blender metadata rather than an unverified download.
"""

from pathlib import Path
import math

import bpy
from mathutils import Vector


PROJECT_ROOT = Path("/Users/oba/Documents/Tech/Coding Projects/Chord Hero")
OUTPUT = PROJECT_ROOT / "public/models/guitar-technique/acoustic-guitar-authored.glb"
COLLECTION_NAME = "Chord Hero Authored Acoustic Guitar"

SCALE_LENGTH = 10.5
SCALE_INCHES = 25.5
INCH = SCALE_LENGTH / SCALE_INCHES
BODY_LENGTH = 19.75 * INCH
BODY_WIDTH = 15.5 * INCH
BODY_DEPTH = 4.4 * INCH
BODY_CENTER_Z = 5.8
NUT_Z = -3.3
SADDLE_Z = NUT_Z + SCALE_LENGTH
NUT_SPREAD = 1.46 * INCH
SADDLE_SPREAD = 2.15 * INCH
SOUNDHOLE_Z = 5.78
SOUNDHOLE_RADIUS = 0.82
NUT_WIDTH = 1.75 * INCH
TWELFTH_WIDTH = 2.14 * INCH
HEADSTOCK_END_Z = NUT_Z - 2.32
HEADSTOCK_END_WIDTH = 3.5 * INCH
BOARD_END_Z = NUT_Z + SCALE_LENGTH * (1.0 - 2.0 ** (-20.0 / 12.0)) + 0.28
# Keep the authored instrument on the same contact planes as the procedural
# runtime guitar: a shallow fretboard crown, frets just above it, and strings
# around y=.56-.58.  The old .105 crown over a ~.72-wide board read like a
# visibly over-radiused neck and left straight fret tubes floating at the edge.
FRETBOARD_BASE_Y = 0.445
FRETBOARD_CROWN_RISE = 0.025
FRET_CROWN_OFFSET = 0.035
STRING_NUT_Y = 0.56
STRING_SADDLE_Y = 0.58


def blender_point(point):
    """Convert engine X/Y/Z to Blender X/Y/Z for export_yup=True."""
    x, y, z = point
    return (x, -z, y)


def material(name, color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader is not None:
        shader.inputs["Base Color"].default_value = (*color, 1.0)
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        for socket_name, value in (("Specular IOR Level", 0.3), ("Coat Weight", 0.18 if metallic == 0 else 0.35)):
            socket = shader.inputs.get(socket_name)
            if socket is not None:
                socket.default_value = value
    return mat


def embed_grain(mat, image_name, base, grain, along_z=True):
    """Embed a tiny authored grain image and a subtle bump in the GLB."""
    size = 64
    image = bpy.data.images.get(image_name) or bpy.data.images.new(image_name, width=size, height=size, alpha=False)
    pixels = []
    for y in range(size):
        for x in range(size):
            along = y if along_z else x
            across = x if along_z else y
            coarse = math.sin((along // 9) * 12.9898 + (across // 5) * 78.233) * 43758.5453
            coarse -= math.floor(coarse)
            fine = math.sin((along + 1) * 39.3467 + (across + 3) * 11.135) * 24634.6345
            fine -= math.floor(fine)
            amount = max(0.0, min(1.0, 0.08 + 0.09 * math.sin(along * 0.19 + coarse * 2.0) + (fine - 0.5) * 0.035))
            color = tuple(base[index] * (1.0 - amount) + grain[index] * amount for index in range(3))
            pixels.extend((*color, 1.0))
    image.pixels = pixels
    image.pack()
    image["source"] = "Author-generated deterministic grain; no external texture source available"
    image["license"] = "CC0-compatible original data"
    tree = mat.node_tree
    shader = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader is None:
        return
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.name = image_name
    texture.image = image
    texture.interpolation = "Linear"
    tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    bump.inputs["Distance"].default_value = 0.025
    tree.links.new(texture.outputs["Color"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])


SPRUCE = material("Spruce | pale satin", (0.92, 0.76, 0.50), 0.4)
MAHOGANY = material("Mahogany | warm shell", (0.18, 0.055, 0.028), 0.38)
NECK_WOOD = material("Mahogany | neck", (0.24, 0.09, 0.045), 0.4)
EBONY = material("Ebony | fretboard", (0.025, 0.018, 0.014), 0.34)
BINDING = material("Ivory | binding", (0.78, 0.62, 0.38), 0.32)
ROSETTE = material("Rosette | dark pearl", (0.08, 0.18, 0.16), 0.28, 0.12)
METAL = material("Nickel | hardware", (0.28, 0.31, 0.33), 0.22, 0.86)
STRING = material("Steel | strings", (0.48, 0.5, 0.47), 0.18, 0.88)
SOUNDHOLE = material("Soundhole | cavity", (0.008, 0.004, 0.003), 0.86)
PEARL = material("Pearl | inlays", (0.73, 0.87, 0.78), 0.22, 0.1)
# These are stored in a color-managed image and then sampled as an sRGB
# base-color texture by glTF. Keep the authored pixels deliberately pale so
# the visible soundboard reads as spruce under the studio's filmic lighting,
# not the uniformly dark mahogany-like brown of the initial export.
embed_grain(SPRUCE, "ChordHero Spruce Grain 64px", (0.93, 0.78, 0.54), (1.0, 0.91, 0.72), True)
embed_grain(MAHOGANY, "ChordHero Mahogany Grain 64px", (0.14, 0.035, 0.018), (0.32, 0.10, 0.045), False)
embed_grain(NECK_WOOD, "ChordHero Neck Grain 64px", (0.18, 0.05, 0.022), (0.36, 0.12, 0.05), True)


def collection():
    current = bpy.data.collections.get(COLLECTION_NAME)
    if current is None:
        current = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(current)
    for obj in list(current.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    return current


def mesh_object(name, points, faces, mat, target):
    mesh = bpy.data.meshes.new(name + " | mesh")
    mesh.from_pydata([blender_point(point) for point in points], [], faces)
    mesh.update()
    # Blender's glTF exporter does not synthesize UVs for procedural meshes;
    # provide a stable planar mapping so the packed authored grain textures
    # sample across the body/neck instead of collapsing to one texel.
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            x, _y, z = points[vertex_index]
            uv_layer.data[loop_index].uv = (0.5 + x / max(BODY_WIDTH, 0.001), z / max(BODY_LENGTH, 0.001))
    for polygon in mesh.polygons:
        polygon.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.data.materials.append(mat)
    obj["source"] = "Chord Hero Blender authored physical acoustic guitar"
    obj["scale"] = "25.5 inch guitar scale = 10.5 runtime units"
    return obj


def add_bevel(obj, amount, segments=2):
    bevel = obj.modifiers.new("Soft manufactured edge", "BEVEL")
    bevel.width = amount
    bevel.segments = segments
    bevel.limit_method = "ANGLE"
    return obj


def profile_points():
    raw = [
        (0, -4.05), (-1.34, -4.05), (-2.08, -3.74), (-2.3, -3.08),
        (-2.16, -2.23), (-1.73, -1.71), (-1.49, -1.12), (-1.83, -0.68),
        (-2.3, -0.05), (-3.0, 0.4), (-3.19, 1.16), (-3.42, 2.02),
        (-2.96, 2.78), (-2.25, 3.34), (-0.7, 4.08), (0, 4.08),
        (0.7, 4.08), (2.25, 3.34), (2.96, 2.78), (3.42, 2.02),
        (3.19, 1.16), (3.0, 0.4), (2.3, -0.05), (1.83, -0.68),
        (1.49, -1.12), (1.73, -1.71), (2.16, -2.23), (2.3, -3.08),
        (2.08, -3.74), (1.34, -4.05),
    ]
    z_scale = BODY_LENGTH / 8.1
    x_scale = BODY_WIDTH / 6.76
    # Interpolate one half of the measured outline with a monotone cubic
    # envelope. Catmull-Rom overshot the rapid bout/waist transitions and
    # created small scalloped humps in the silhouette; this preserves every
    # measured extremum while keeping the tangent continuous.
    # Use the negative-x half through the upper-bout endpoint. The following
    # raw point is the explicit top-center duplicate, which would create a
    # zero-length secant in the monotone solver.
    side = [(x, z) for x, z in raw[1:15]]
    side_z = [z for _x, z in side]
    side_x = [x for x, _z in side]
    slopes = [0.0] * len(side)
    secants = [(side_x[i + 1] - side_x[i]) / (side_z[i + 1] - side_z[i]) for i in range(len(side) - 1)]
    slopes[0] = secants[0]
    slopes[-1] = secants[-1]
    for i in range(1, len(side) - 1):
        if secants[i - 1] * secants[i] <= 0:
            slopes[i] = 0.0
        else:
            slopes[i] = (secants[i - 1] + secants[i]) * 0.5
    for i in range(len(secants)):
        if abs(secants[i]) < 1e-8:
            slopes[i] = slopes[i + 1] = 0.0
            continue
        a = slopes[i] / secants[i]
        b = slopes[i + 1] / secants[i]
        limit = math.sqrt(a * a + b * b)
        if limit > 3.0:
            scale = 3.0 / limit
            slopes[i] = scale * a * secants[i]
            slopes[i + 1] = scale * b * secants[i]
    interpolated = []
    subdivisions = 6
    for i in range(len(side) - 1):
        z0, z1 = side_z[i], side_z[i + 1]
        x0, x1 = side_x[i], side_x[i + 1]
        interval = z1 - z0
        for step in range(subdivisions):
            t = step / subdivisions
            h00 = 2 * t**3 - 3 * t**2 + 1
            h10 = t**3 - 2 * t**2 + t
            h01 = -2 * t**3 + 3 * t**2
            h11 = t**3 - t**2
            width = h00 * x0 + h10 * interval * slopes[i] + h01 * x1 + h11 * interval * slopes[i + 1]
            interpolated.append((width * x_scale, BODY_CENTER_Z + (z0 + interval * t) * z_scale))
    interpolated.append((side_x[-1] * x_scale, BODY_CENTER_Z + side_z[-1] * z_scale))
    right = [(0.0, BODY_CENTER_Z + raw[0][1] * z_scale), *interpolated]
    left = [(-x, z) for x, z in reversed(interpolated)]
    return right + left


def body(target):
    outline = profile_points()
    # Keep the soundboard below the crowned ebony board. The previous .495
    # cap buried the board over the upper bout, leaving frets 13–20 floating
    # visually over spruce while the strings remained at their calibrated
    # y=.56–.58 contact plane.
    top_y = 0.40
    bottom_y = top_y - BODY_DEPTH
    points = [(x, top_y, z) for x, z in outline] + [(x, bottom_y, z) for x, z in outline]
    n = len(outline)
    faces = []
    # Side walls with consistent winding.
    for index in range(n):
        nxt = (index + 1) % n
        faces.append((index, nxt, n + nxt, n + index))
    # The bottom is closed, while the top is an actual annular soundboard
    # opening. A recessed backing disk is added below, so the cavity is not a
    # black decal painted over a solid cap.
    faces.append(tuple(n + index for index in range(n)))
    shell = mesh_object("Body | deep mahogany shell", points, faces, MAHOGANY, target)
    add_bevel(shell, 0.085, 3)
    # Spruce soundboard ring: smooth outer profile and a true circular inner
    # aperture. Matching vertex counts make a stable annular quad strip.
    cap_y = top_y + 0.018
    ring_count = len(outline)
    outer = [(x, cap_y, z) for x, z in outline]
    # The body outline is a smoothed loop whose winding is not the same as a
    # fresh CCW circle. Radially normalize each corresponding outline vertex
    # so inner/outer rings share ordering and every annular quad stays simple.
    inner = []
    for x, _y, z in outer:
        radial = Vector((x, z - SOUNDHOLE_Z))
        radial.normalize()
        inner.append((radial.x * SOUNDHOLE_RADIUS, cap_y, SOUNDHOLE_Z + radial.y * SOUNDHOLE_RADIUS))
    cap_points = outer + inner
    cap_faces = []
    for index in range(ring_count):
        nxt = (index + 1) % ring_count
        # Preserve the outer contour's start/order for the inner ring. The
        # radial correspondence eliminates the old starburst crossing, while
        # selecting the winding from the engine-space normal keeps the spruce
        # face outward after the Blender axis conversion.
        face = (index, nxt, ring_count + nxt, ring_count + index)
        first = Vector(cap_points[face[1]]) - Vector(cap_points[face[0]])
        second = Vector(cap_points[face[2]]) - Vector(cap_points[face[0]])
        if first.cross(second).y < 0:
            face = tuple(reversed(face))
        cap_faces.append(face)
    cap = mesh_object("Body | spruce soundboard annulus", cap_points, cap_faces, SPRUCE, target)
    # The annulus follows a curved outline; smooth its shared normals so the
    # triangulated spruce surface reads as one continuous soundboard instead
    # of a patchwork of flat triangular facets.
    for polygon in cap.data.polygons:
        polygon.use_smooth = True
    add_bevel(cap, 0.02, 2)
    # Binding is a sequence of short rounded rails, kept sparse enough for a
    # bounded runtime asset while following the whole flared outline.
    for index in range(n - 1):
        a = outer[index]
        b = outer[index + 1]
        tube_between(target, f"Body binding {index:02d}", a, b, 0.03, BINDING, 6)


def tube_between(target, name, start, end, radius, mat, sides=8):
    start_v, end_v = Vector(start), Vector(end)
    axis = end_v - start_v
    length = axis.length
    if length < 1e-6:
        return None
    axis.normalize()
    reference = Vector((0, 1, 0)) if abs(axis.dot(Vector((0, 1, 0))) < 0.9) else Vector((1, 0, 0))
    side = axis.cross(reference).normalized()
    binormal = axis.cross(side).normalized()
    points = []
    for center in (start_v, end_v):
        for index in range(sides):
            angle = math.tau * index / sides
            points.append(tuple(center + side * (math.cos(angle) * radius) + binormal * (math.sin(angle) * radius)))
    faces = []
    for index in range(sides):
        nxt = (index + 1) % sides
        faces.append((index, nxt, sides + nxt, sides + index))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(sides + index for index in range(sides)))
    obj = mesh_object(name, points, faces, mat, target)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def cylinder_y(target, name, center, radius, depth, mat, sides=24):
    x, y, z = center
    return tube_between(target, name, (x, y - depth / 2, z), (x, y + depth / 2, z), radius, mat, sides)


def box(target, name, center, dimensions, mat, bevel=0.0):
    x, y, z = center
    dx, dy, dz = [value / 2 for value in dimensions]
    points = [
        (x - dx, y - dy, z - dz), (x + dx, y - dy, z - dz),
        (x + dx, y - dy, z + dz), (x - dx, y - dy, z + dz),
        (x - dx, y + dy, z - dz), (x + dx, y + dy, z - dz),
        (x + dx, y + dy, z + dz), (x - dx, y + dy, z + dz),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
    obj = mesh_object(name, points, faces, mat, target)
    if bevel:
        add_bevel(obj, bevel, 2)
    return obj


def torus_y(target, name, x, y, z, major_radius, minor_radius, mat, segments=48):
    points = []
    rings = 8
    for index in range(segments):
        outer = math.tau * index / segments
        for ring in range(rings):
            inner = math.tau * ring / rings
            radial = major_radius + minor_radius * math.cos(inner)
            points.append((x + radial * math.cos(outer), y + minor_radius * math.sin(inner), z + radial * math.sin(outer)))
    faces = []
    for index in range(segments):
        nxt = (index + 1) % segments
        for ring in range(rings):
            rn = (ring + 1) % rings
            a = index * rings + ring
            b = nxt * rings + ring
            c = nxt * rings + rn
            d = index * rings + rn
            faces.append((a, b, c, d))
    obj = mesh_object(name, points, faces, mat, target)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def fretboard(target):
    rows, columns = 36, 8
    points = []
    faces = []
    for row in range(rows + 1):
        progress = row / rows
        z = NUT_Z + (BOARD_END_Z - NUT_Z) * progress
        width = NUT_WIDTH + (TWELFTH_WIDTH - NUT_WIDTH) * progress
        for column in range(columns + 1):
            across = column / columns * 2 - 1
            x = across * width / 2
            y = FRETBOARD_BASE_Y + FRETBOARD_CROWN_RISE * (1 - across * across)
            points.append((x, y, z))
    for row in range(rows):
        for column in range(columns):
            a = row * (columns + 1) + column
            b = a + 1
            c = a + columns + 1
            d = c + 1
            # Keep each grid cell as two explicit triangles.  A six-index
            # polygon with repeated vertices is accepted inconsistently by
            # Blender/glTF exporters and can leave degenerate board faces.
            faces.extend(((a, c, b), (b, c, d)))
    board = mesh_object("Fretboard | crowned ebony", points, faces, EBONY, target)
    # Subtle side binding follows the same taper as the board.
    for side in (-1, 1):
        tube_between(target, "Fretboard binding", (side * NUT_WIDTH / 2, FRETBOARD_BASE_Y + 0.01, NUT_Z), (side * TWELFTH_WIDTH / 2, FRETBOARD_BASE_Y + 0.01, BOARD_END_Z), 0.035, BINDING, 6)
    return board


def fret_position(fret):
    return NUT_Z + SCALE_LENGTH * (1.0 - 2.0 ** (-fret / 12.0))


def strings_and_frets(target):
    # Frets are rounded horizontal crowns; each is individually placed over
    # the radiused board so side profile remains visible at close range.
    for fret in range(1, 21):
        z = fret_position(fret)
        progress = max(0.0, min(1.0, (z - NUT_Z) / SCALE_LENGTH))
        width = NUT_WIDTH + (TWELFTH_WIDTH - NUT_WIDTH) * progress + 0.07
        y = FRETBOARD_BASE_Y + FRETBOARD_CROWN_RISE + FRET_CROWN_OFFSET
        # A rounded tube gives the crown a true reflective radius rather than
        # the flat face of a beveled rectangular box.
        tube_between(target, f"Fret crown {fret:02d}", (-width / 2, y, z), (width / 2, y, z), 0.034, METAL, 10)
    # Nut and bridge/saddle hardware.
    box(target, "Nut | bone", (0, 0.49, NUT_Z), (NUT_WIDTH + 0.06, 0.13, 0.08), BINDING, 0.02)
    box(target, "Bridge | rosewood", (0, 0.46, SADDLE_Z), (SADDLE_SPREAD + 0.26, 0.20, 0.48), NECK_WOOD, 0.05)
    box(target, "Saddle | bone", (0, 0.61, SADDLE_Z), (SADDLE_SPREAD, 0.11, 0.06), BINDING, 0.018)
    for string in range(6):
        x = string_x(string, SADDLE_Z)
        cylinder_y(target, f"Bridge pin {string + 1}", (x, 0.60, SADDLE_Z - 0.14), 0.055, 0.10, BINDING, 12)
    # Strings continue from the headstock tuner posts, over the nut and bridge
    # to the measured saddle.  They are separate tubes only at the nut to
    # retain the natural fan while preserving the contact line exactly.
    for string in range(6):
        saddle_x = string_x(string, SADDLE_Z)
        nut_x = string_x(string, NUT_Z)
        tuner_x, tuner_z = tuner_position(string)
        tube_between(target, f"String {string + 1} | speaking length", (nut_x, STRING_NUT_Y, NUT_Z), (saddle_x, STRING_SADDLE_Y, SADDLE_Z), 0.014 if string < 3 else 0.011, STRING, 6)
        tube_between(target, f"String {string + 1} | headstock", (tuner_x, 0.55, tuner_z), (nut_x, STRING_NUT_Y, NUT_Z), 0.013, STRING, 6)


def string_x(string, z):
    progress = max(0.0, min(1.0, (z - NUT_Z) / SCALE_LENGTH))
    spread = NUT_SPREAD + (SADDLE_SPREAD - NUT_SPREAD) * progress
    return (string - 2.5) * spread / 5.0


def tuner_position(string):
    side = -1 if string < 3 else 1
    row = string if string < 3 else string - 3
    return side * (0.29 + row * 0.075), NUT_Z - 0.52 - row * 0.66


def neck_and_headstock(target):
    neck_width = 0.7
    box(target, "Neck | mahogany spine", (0, 0.29, -0.5), (neck_width, 0.36, 5.1), NECK_WOOD, 0.04)
    # Headstock is tapered, with a slightly raised cap and a warm binding rail.
    points = [
        (-NUT_WIDTH / 2, 0.48, NUT_Z), (NUT_WIDTH / 2, 0.48, NUT_Z),
        (HEADSTOCK_END_WIDTH / 2, 0.48, HEADSTOCK_END_Z), (-HEADSTOCK_END_WIDTH / 2, 0.48, HEADSTOCK_END_Z),
        (-NUT_WIDTH / 2, 0.25, NUT_Z), (NUT_WIDTH / 2, 0.25, NUT_Z),
        (HEADSTOCK_END_WIDTH / 2, 0.25, HEADSTOCK_END_Z), (-HEADSTOCK_END_WIDTH / 2, 0.25, HEADSTOCK_END_Z),
    ]
    headstock = mesh_object("Headstock | mahogany", points, [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)], NECK_WOOD, target)
    add_bevel(headstock, 0.05, 3)
    for string in range(6):
        x, z = tuner_position(string)
        cylinder_y(target, f"Tuner post {string + 1}", (x, 0.55, z), 0.055, 0.30, METAL, 12)
        box(target, f"Tuner button {string + 1}", (x * 1.25, 0.55, z), (0.20, 0.12, 0.38), METAL, 0.05)


def soundhole_and_inlays(target):
    # The soundboard is an annulus at y≈0.513. This backing disk sits 0.09
    # units below it, and the short segmented wall makes the depth visible at
    # oblique camera angles.
    cylinder_y(target, "Soundhole | recessed backing", (0, 0.405, SOUNDHOLE_Z), SOUNDHOLE_RADIUS * 0.985, 0.035, SOUNDHOLE, 64)
    wall_points = []
    wall_faces = []
    for index in range(64):
        angle = math.tau * index / 64
        x = SOUNDHOLE_RADIUS * math.cos(angle)
        z = SOUNDHOLE_Z + SOUNDHOLE_RADIUS * math.sin(angle)
        wall_points.extend([(x, 0.410, z), (x, 0.310, z)])
    for index in range(64):
        nxt = (index + 1) % 64
        wall_faces.append((index * 2, nxt * 2, nxt * 2 + 1, index * 2 + 1))
    wall = mesh_object("Soundhole | inner wall", wall_points, wall_faces, SOUNDHOLE, target)
    for polygon in wall.data.polygons:
        polygon.use_smooth = True
    torus_y(target, "Rosette | inner ring", 0, 0.445, SOUNDHOLE_Z, SOUNDHOLE_RADIUS + 0.09, 0.035, ROSETTE, 64)
    torus_y(target, "Rosette | outer ring", 0, 0.448, SOUNDHOLE_Z, SOUNDHOLE_RADIUS + 0.18, 0.022, BINDING, 64)
    for fret in (3, 5, 7, 9, 15, 17, 19):
        z = fret_position(fret) - 0.025
        width = NUT_WIDTH + (TWELFTH_WIDTH - NUT_WIDTH) * max(0.0, min(1.0, (z - NUT_Z) / SCALE_LENGTH))
        z = (fret_position(fret) + fret_position(fret + 1)) / 2
        cylinder_y(target, f"Fret inlay {fret:02d}", (0, 0.49, z), 0.055, 0.022, PEARL, 16)
    z = (fret_position(12) + fret_position(13)) / 2
    width = NUT_WIDTH + (TWELFTH_WIDTH - NUT_WIDTH) * max(0.0, min(1.0, (z - NUT_Z) / SCALE_LENGTH))
    for x in (-width * 0.22, width * 0.22):
        cylinder_y(target, "Fret inlay 12 pair", (x, 0.49, z), 0.05, 0.022, PEARL, 16)


def annotate(target):
    marker = bpy.data.objects.new("Chord Hero authored asset metadata", None)
    target.objects.link(marker)
    marker["asset"] = "acoustic-guitar-authored.glb"
    marker["source"] = "Author-built Blender geometry; downloaded low-poly candidate not shipped"
    marker["scale_inches"] = 25.5
    marker["runtime_scale_units"] = 10.5
    marker["visible_frets"] = 20
    marker["strings"] = 6
    marker["contact_alignment"] = "nut -3.3, saddle 7.2, soundhole center 5.78, soundboard cap y 0.418"


def merge_static_meshes(target):
    """Apply local modifiers and batch static geometry by its sole material."""
    groups = {}
    for obj in list(target.objects):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        # Every authored part is deliberately single-material.  Keep the
        # material identity as the batch key so joining cannot alter shading.
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for material_name, objects in groups.items():
        for obj in objects:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            # Convert applies bevels and leaves a plain mesh for a lossless
            # join.  It also avoids silently dropping modifiers on non-active
            # objects when bpy.ops.object.join() runs below.
            bpy.ops.object.convert(target="MESH", keep_original=False)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            if obj.name in bpy.data.objects:
                obj.select_set(True)
        active = next((obj for obj in objects if obj.name in bpy.data.objects), None)
        if active is None:
            continue
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        active.name = f"{COLLECTION_NAME} | {material_name} batch"


def main():
    target = collection()
    body(target)
    neck_and_headstock(target)
    fretboard(target)
    strings_and_frets(target)
    soundhole_and_inlays(target)
    annotate(target)
    merge_static_meshes(target)
    bpy.context.view_layer.update()
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in target.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next((obj for obj in target.objects if obj.type == "MESH"), None)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    window = bpy.context.window
    view_area = next((area for area in window.screen.areas if area.type == "VIEW_3D"), None) if window else None
    kwargs = dict(
        filepath=str(OUTPUT), export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_animations=False,
        export_nla_strips=False, export_materials="EXPORT",
    )
    if window and view_area:
        view_region = next(region for region in view_area.regions if region.type == "WINDOW")
        with bpy.context.temp_override(window=window, area=view_area, region=view_region):
            bpy.ops.export_scene.gltf(**kwargs)
    else:
        bpy.ops.export_scene.gltf(**kwargs)
    triangle_count = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in target.objects if obj.type == "MESH")
    print(f"CHORD_HERO_GUITAR_OUTPUT={OUTPUT}")
    print(f"CHORD_HERO_GUITAR_TRIANGLES={triangle_count}")
    print(f"CHORD_HERO_GUITAR_SCALE={SCALE_LENGTH}/{SCALE_INCHES}")
    print("CHORD_HERO_GUITAR_SOURCE=blender-authored-physical-geometry")
    print("CHORD_HERO_GUITAR_RAW_DOWNLOAD_SHIPPED=False")


main()

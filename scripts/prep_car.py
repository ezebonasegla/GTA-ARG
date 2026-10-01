# Blender script: turn a downloaded car model (.glb) into a light, game-ready GLB.
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/prep_car.py -- \
#     in.glb public/models/cars/out.glb --length 3.64 --paint Chassi [--drop interior] [--half] [--flip]
# Result: one "body" mesh (paint material renamed to "paint"), four spinnable wheels named
# wheel-{front,back}-{left,right} with their origin on the hub, front towards -Y in Blender
# (+Z in three.js), real length, centered, resting on the ground, Draco-compressed.
import argparse, math, re, sys
import bmesh, bpy
from mathutils import Matrix, Vector

p = argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('out')
p.add_argument('--length', type=float, required=True, help='real length in meters')
p.add_argument('--paint', default='', help='regex of body-paint material names')
p.add_argument('--drop', default='', help='regex of material names whose faces are removed')
p.add_argument('--wheels', default=r'wheel|tire|tyre|rim|llanta|rueda', help='regex of wheel object/material names')
p.add_argument('--target', type=int, default=16000, help='max body triangles')
p.add_argument('--half', action='store_true', help='file has two copies side by side: keep the one at -X')
p.add_argument('--flip', action='store_true', help='turn 180 degrees (front ended up at +Y)')
p.add_argument('--tex', type=int, default=1024, help='max texture size')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
for o in list(bpy.data.objects):
    if o.type == 'MESH':
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o)


def meshes():
    return [o for o in bpy.data.objects if o.type == 'MESH']


def select(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def bounds(objs):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    return lo, hi


def mat_names(o):
    return ' '.join(s.material.name for s in o.material_slots if s.material)


def apply(objs, m):
    for o in objs:
        o.matrix_world = m @ o.matrix_world
    select(objs)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


select(meshes())
bpy.ops.object.make_single_user(object=True, obdata=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

if a.half:
    lo, hi = bounds(meshes())
    mid = (lo.x + hi.x) / 2
    for o in meshes():
        if (o.matrix_world @ Vector(o.bound_box[0])).x + o.dimensions.x / 2 > mid:
            bpy.data.objects.remove(o)

if a.drop:
    drop = re.compile(a.drop, re.I)
    for o in meshes():
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bad = [f for f in bm.faces if o.material_slots and o.material_slots[f.material_index].material
               and drop.search(o.material_slots[f.material_index].material.name)]
        bmesh.ops.delete(bm, geom=bad, context='FACES')
        bm.to_mesh(o.data)
        bm.free()
        if not o.data.polygons:
            bpy.data.objects.remove(o)

# align the car's long axis with Y (principal axis of the vertices in the ground plane)
xs, ys = [], []
for o in meshes():
    vs = o.data.vertices
    for i in range(0, len(vs), max(1, len(vs) // 4000)):
        xs.append(vs[i].co.x); ys.append(vs[i].co.y)
mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
sxx = sum((x - mx) ** 2 for x in xs); syy = sum((y - my) ** 2 for y in ys); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
angle = 0.5 * math.atan2(2 * sxy, sxx - syy)  # direction of the long axis
apply(meshes(), Matrix.Rotation(math.pi / 2 - angle + (math.pi if a.flip else 0), 4, 'Z'))

lo, hi = bounds(meshes())
s = a.length / (hi.y - lo.y)
apply(meshes(), Matrix.Scale(s, 4))
lo, hi = bounds(meshes())
apply(meshes(), Matrix.Translation((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))

# wheels: group wheel parts by corner; anything near the centre line (axles) stays in the body
wheel_re = re.compile(a.wheels, re.I)
corners = {}
for o in meshes():
    if not wheel_re.search(o.name + ' ' + mat_names(o)):
        continue
    lo, hi = bounds([o])
    c = (lo + hi) / 2
    if abs(c.x) < 0.25 or (hi.x - lo.x) > 1.0:
        continue
    key = ('front' if c.y < 0 else 'back', 'left' if c.x > 0 else 'right')
    corners.setdefault(key, []).append(o)
# level the car: front and back wheel hubs at the same height (some models come pitched)
if ('front', 'left') in corners and ('back', 'left') in corners:
    def hub(end):
        cs = [sum(bounds(v), Vector()) / 2 for k, v in corners.items() if k[0] == end]
        return sum(cs, Vector()) / len(cs)
    f, b = hub('front'), hub('back')
    pitch = math.atan2(b.z - f.z, b.y - f.y)
    apply(meshes(), Matrix.Rotation(-pitch, 4, 'X'))
    lo, hi = bounds(meshes())
    apply(meshes(), Matrix.Translation((0, -(lo.y + hi.y) / 2, -lo.z)))

for (fb, lr), objs in corners.items():
    select(objs)
    bpy.ops.object.join()
    w = bpy.context.view_layer.objects.active
    w.name = f'wheel-{fb}-{lr}'
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
wheels = [o for o in meshes() if o.name.startswith('wheel-')]
body = [o for o in meshes() if o not in wheels]
select(body)
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'body'


def simplify(o, target):
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > target:
        m = o.modifiers.new('decimate', 'DECIMATE')
        m.ratio = target / tris
        select([o])
        bpy.ops.object.modifier_apply(modifier=m.name)


simplify(body, a.target)
for w in wheels:
    simplify(w, max(600, a.target // 12))

if a.paint:
    paint = re.compile(a.paint, re.I)
    for i, m in enumerate(sorted({s.material for s in body.material_slots if s.material and paint.search(s.material.name)}, key=lambda m: m.name)):
        m.name = 'paint' if i == 0 else f'paint.{i:03d}'

for img in bpy.data.images:
    if max(img.size) > a.tex:
        f = a.tex / max(img.size)
        img.scale(int(img.size[0] * f), int(img.size[1] * f))

select(meshes())
bpy.ops.export_scene.gltf(filepath=a.out, export_format='GLB', use_selection=True, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
lo, hi = bounds(meshes())
tris = sum(len(p.vertices) - 2 for o in meshes() for p in o.data.polygons)
print(f'DONE {a.out}: size {[round(v, 2) for v in hi - lo]} tris {tris} wheels {sorted(w.name for w in wheels)}')

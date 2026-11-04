"""The whole GTA Quilmes map in the shape the slop engine's tools expect.

usage: prepare.py <dir> public/data/quilmes.json
Writes <dir>/app/tools/data/osm_quilmes.json (streets, water, parks as Overpass-style OSM) and the buildings with
their heights as Open Buildings-style CSVs (<dir>/app/tools/data/cache/gob_quilmes.csv, gob_heights.csv), all from
the game's own map, so both show the same streets and buildings.
"""
import json, math, sys
import numpy as np
from pyproj import Transformer

S, GAME = sys.argv[1], sys.argv[2]
g = json.load(open(GAME))
LAT0, LON0 = g['origin']['lat'], g['origin']['lon']
to_ecef = Transformer.from_crs('EPSG:4326', 'EPSG:4978', always_xy=True)
to_ll = Transformer.from_crs('EPSG:4978', 'EPSG:4326', always_xy=True)
x0, y0, z0 = to_ecef.transform(LON0, LAT0, 0)
la, lo = math.radians(LAT0), math.radians(LON0)
sl, cl, sp, cp = math.sin(lo), math.cos(lo), math.sin(la), math.cos(la)


def lonlat(pts):
    """game (x east, z south) metres -> lon, lat arrays"""
    p = np.asarray(pts, float)
    e, n = p[:, 0], -p[:, 1]
    X = x0 - sl * e - sp * cl * n
    Y = y0 + cl * e - sp * sl * n
    Z = z0 + cp * n
    lon, lat, _ = to_ll.transform(X, Y, Z)
    return lon, lat


# ---------------------------------------------------------------- OSM-like extract
ids = {}


def way(pts, tags, wid):
    lon, lat = lonlat(pts)
    geom, nodes = [], []
    for a, b in zip(lon, lat):
        k = (round(float(b), 6), round(float(a), 6))  # shared vertex (to ~10 cm) = same node
        if k not in ids:
            ids[k] = len(ids) + 1
        nodes.append(ids[k])
        geom.append({'lat': float(b), 'lon': float(a)})
    return {'type': 'way', 'id': wid, 'tags': tags, 'nodes': nodes, 'geometry': geom}


els = []
for i, r in enumerate(g['roads']):
    if len(r['pts']) < 2:
        continue
    t = {'highway': r['kind'], 'width': str(r['w'])}
    if r.get('name'):
        t['name'] = r['name']
    if r.get('oneway'):
        t['oneway'] = 'yes'
    els.append(way(r['pts'], t, 1_000_000 + i))

# parks and plazas get the name of the landmark inside them
def inside(px, pz, ring):
    c = False
    for i in range(len(ring)):
        (xa, za), (xb, zb) = ring[i - 1], ring[i]
        if (za > pz) != (zb > pz) and px < xa + (pz - za) * (xb - xa) / (zb - za):
            c = not c
    return c


named = g['landmarks']
for i, a in enumerate(g['areas']):
    pts = a['pts']
    if len(pts) < 3:
        continue
    ring = pts + [pts[0]] if pts[0] != pts[-1] else pts
    if a['kind'] == 'water':
        t = {'natural': 'water'}
    elif a['kind'] in ('park', 'plaza'):
        t = {'leisure': 'park'}
        for l in named:
            if inside(l['pos'][0], l['pos'][1], pts) and ('Plaza' in l['name'] or 'Parque' in l['name']):
                t['name'] = l['name']
                break
    else:
        continue
    els.append(way(ring, t, 2_000_000 + i))
json.dump({'version': 0.6, 'elements': els}, open(f'{S}/app/tools/data/osm_quilmes.json', 'w'))
print('osm elements', len(els), 'nodes', len(ids))

# ---------------------------------------------------------------- buildings -> Open Buildings-style CSV
rows, heights = ['latitude,longitude,area_in_meters,confidence,geometry,full_plus_code'], ['0,0,0']
for b in g['buildings']:
    p = np.asarray(b['pts'], float)
    if len(p) < 3:
        continue
    x, z = p[:, 0], p[:, 1]
    area = abs(np.dot(x, np.roll(z, 1)) - np.dot(z, np.roll(x, 1))) / 2
    if area < 6:
        continue
    lon, lat = lonlat(p)
    ring = ', '.join(f'{a:.7f} {b2:.7f}' for a, b2 in zip(list(lon) + [lon[0]], list(lat) + [lat[0]]))
    cx, cy = lonlat(p.mean(0, keepdims=True))
    rows.append(f'{cy[0]:.7f},{cx[0]:.7f},{area:.1f},0.9,"POLYGON(({ring}))",x')
    heights.append(f"{b['h']:.1f},100,{b['h']:.1f}")
open(f'{S}/app/tools/data/cache/gob_quilmes.csv', 'w').write('\n'.join(rows) + '\n')
open(f'{S}/app/tools/data/cache/gob_heights.csv', 'w').write('\n'.join(heights) + '\n')
print('buildings', len(rows) - 1)

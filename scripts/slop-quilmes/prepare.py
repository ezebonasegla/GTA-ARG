"""Quilmes data in the shape the slop engine's tools expect (from Overture + our map)."""
import json, math, sys
import numpy as np
from pyproj import Transformer

S, GAME = sys.argv[1], sys.argv[2]
raw = json.load(open(f'{S}/data/overture-raw.json'))
# 1. OSM-like extract: ways get node ids from their coordinates (shared vertex = same id)
ids = {}
def nid(p):
    k = (round(p['lat'], 7), round(p['lon'], 7))
    if k not in ids: ids[k] = len(ids) + 1
    return ids[k]
els = []
for e in raw['elements']:
    t = e.get('tags') or {}
    if e['type'] == 'way' and t.get('building') and not (t.get('name') or t.get('height') or t.get('building:levels')):
        continue  # footprints come from the CSV below
    if e['type'] == 'way' and e.get('geometry'):
        e['nodes'] = [nid(p) for p in e['geometry']]
    els.append(e)
json.dump({'version': 0.6, 'elements': els}, open(f'{S}/app/tools/data/osm_quilmes.json', 'w'))
print('osm elements', len(els))

# 2. Buildings of our map (clipped to the streets, real heights) -> Open Buildings-style CSV
g = json.load(open(GAME))
LAT0, LON0 = -34.7206, -58.2546
to_ecef = Transformer.from_crs('EPSG:4326', 'EPSG:4978', always_xy=True)
to_ll = Transformer.from_crs('EPSG:4978', 'EPSG:4326', always_xy=True)
x0, y0, z0 = to_ecef.transform(LON0, LAT0, 0)
la, lo = math.radians(LAT0), math.radians(LON0)
sl, cl, sp, cp = math.sin(lo), math.cos(lo), math.sin(la), math.cos(la)
def lonlat(pts):
    p = np.asarray(pts, float); e, n = p[:, 0], -p[:, 1]
    X = x0 - sl * e - sp * cl * n; Y = y0 + cl * e - sp * sl * n; Z = z0 + cp * n
    lon, lat, _ = to_ll.transform(X, Y, Z)
    return lon, lat
R = 1500
rows, heights = ['latitude,longitude,area_in_meters,confidence,geometry,full_plus_code'], ['0,0,0']
for b in g['buildings']:
    p = np.asarray(b['pts'], float)
    if np.hypot(*p.mean(0)) > R or len(p) < 3: continue
    x, z = p[:, 0], p[:, 1]
    area = abs(np.dot(x, np.roll(z, 1)) - np.dot(z, np.roll(x, 1))) / 2
    if area < 6: continue
    lon, lat = lonlat(p)
    ring = ', '.join(f'{a:.7f} {b2:.7f}' for a, b2 in zip(list(lon) + [lon[0]], list(lat) + [lat[0]]))
    cx, cy = lonlat(p.mean(0, keepdims=True))
    rows.append(f'{cy[0]:.7f},{cx[0]:.7f},{area:.1f},0.9,"POLYGON(({ring}))",x')
    heights.append(f"{b['h']:.1f},100,{b['h']:.1f}")
open(f'{S}/app/tools/data/cache/gob_quilmes.csv', 'w').write('\n'.join(rows) + '\n')
open(f'{S}/app/tools/data/cache/gob_heights.csv', 'w').write('\n'.join(heights) + '\n')
print('buildings', len(rows) - 1)

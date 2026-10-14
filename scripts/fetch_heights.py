#!/usr/bin/env python3
"""Real building heights for public/data/quilmes.json.

Most footprints in the map (Google Open Buildings, Overture) come without a height, so
fetch-osm.mjs guesses one from the footprint size. This replaces the guess with the
height measured from satellite imagery by Google Open Buildings 2.5D Temporal
(https://sites.research.google/gr/open-buildings/temporal/, CC BY 4.0, ODbL-compatible
attribution in the game credits): 0.5 m rasters of building presence and height, read
straight from the public bucket with HTTP range requests (only the blocks over the map).

For each building: sample the raster on a 1.5 m grid inside the footprint, keep the
pixels where a building is present, take the 75th percentile (edges and courtyards pull
the mean down). Levels and the style of houses / apartment blocks follow the new height.

    pip install rasterio pyproj numpy matplotlib
    python3 scripts/fetch_heights.py            # year 2023
"""
import json
import os
import sys
import zlib

import numpy as np
import rasterio
from matplotlib.path import Path
from pyproj import Transformer
from rasterio.windows import Window

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data/quilmes.json')
YEAR = sys.argv[1] if len(sys.argv) > 1 else '2023'
BUCKET = 'https://storage.googleapis.com/open-buildings-temporal-data'
# S2 level-7 cell 95a34 holds Quilmes; these two tiles (EPSG:32721) cover the whole map
TILES = ['tile_3bMjYuu-pTI.tif', 'tile_F2IX7zA0gqY.tif']
ORIGIN = (-34.7206, -58.2546)  # src/world/geo.js QUILMES_CENTER
SKIP = {'church', 'civic', 'hospital', 'brewery', 'school', 'station'}

os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '4')


def game_to_utm(xs, zs):
    """Game metres (x east, z south, local ENU tangent plane) -> UTM 21S."""
    lat0, lon0 = np.radians(ORIGIN[0]), np.radians(ORIGIN[1])
    to_ecef = Transformer.from_crs('EPSG:4326', 'EPSG:4978', always_xy=True)
    x0, y0, z0 = to_ecef.transform(ORIGIN[1], ORIGIN[0], 0)
    e, n = np.asarray(xs), -np.asarray(zs)
    sl, cl, sp, cp = np.sin(lon0), np.cos(lon0), np.sin(lat0), np.cos(lat0)
    X = x0 - sl * e - sp * cl * n
    Y = y0 + cl * e - sp * sl * n
    Z = z0 + cp * n
    lon, lat, _ = Transformer.from_crs('EPSG:4978', 'EPSG:4326', always_xy=True).transform(X, Y, Z)
    return Transformer.from_crs('EPSG:4326', 'EPSG:32721', always_xy=True).transform(lon, lat)


def area(pts):
    p = np.asarray(pts, dtype=float)
    return abs(np.dot(p[:, 0], np.roll(p[:, 1], 1)) - np.dot(p[:, 1], np.roll(p[:, 0], 1))) / 2


def game_from_lonlat(lon, lat):
    """lon/lat -> game metres (inverse of game_to_utm's first step)."""
    lat0, lon0 = np.radians(ORIGIN[0]), np.radians(ORIGIN[1])
    to_ecef = Transformer.from_crs('EPSG:4326', 'EPSG:4978', always_xy=True)
    x0, y0, z0 = to_ecef.transform(ORIGIN[1], ORIGIN[0], 0)
    X, Y, Z = to_ecef.transform(np.asarray(lon), np.asarray(lat), np.zeros(len(lon)))
    dx, dy, dz = X - x0, Y - y0, Z - z0
    sl, cl, sp, cp = np.sin(lon0), np.cos(lon0), np.sin(lat0), np.cos(lat0)
    east = -sl * dx + cl * dy
    north = -sp * cl * dx - sp * sl * dy + cp * dz
    return east, -north


def osm_tagged(blds):
    """Indices of buildings whose height or levels were tagged in OSM / Overture."""
    raw = os.path.join(ROOT, '.cache/overture-raw.json')
    if not os.path.exists(raw):
        return set()
    els = [e for e in json.load(open(raw))['elements'] if (e.get('tags') or {}).get('building')
           and ('height' in e['tags'] or 'building:levels' in e['tags']) and e.get('geometry')]
    lon = [np.mean([g['lon'] for g in e['geometry']]) for e in els]
    lat = [np.mean([g['lat'] for g in e['geometry']]) for e in els]
    xs, zs = game_from_lonlat(lon, lat)
    paths = [(i, Path(np.asarray(b['pts'], dtype=float))) for i, b in enumerate(blds)]
    cents = np.array([np.mean(b['pts'], 0) for b in blds])
    out = set()
    for x, z in zip(xs, zs):
        near = np.where(np.hypot(cents[:, 0] - x, cents[:, 1] - z) < 40)[0]
        for i in near:
            if paths[i][1].contains_point((x, z)):
                out.add(int(i))
    print(f'{len(out)} buildings keep their OSM height')
    return out


def samples(pts):
    """Grid points every 1.5 m inside a footprint (its centroid if it's tiny)."""
    p = np.asarray(pts, dtype=float)
    lo, hi = p.min(0), p.max(0)
    gx, gz = np.meshgrid(np.arange(lo[0] + 0.75, hi[0], 1.5), np.arange(lo[1] + 0.75, hi[1], 1.5))
    cand = np.column_stack([gx.ravel(), gz.ravel()])
    inside = cand[Path(p).contains_points(cand)] if len(cand) else cand
    if len(inside) > 300:
        inside = inside[np.random.default_rng(len(inside)).choice(len(inside), 300, replace=False)]
    if not len(inside):
        inside = p.mean(0, keepdims=True)
    return inside


def main():
    data = json.load(open(DATA))
    blds = data['buildings']
    todo = [i for i, b in enumerate(blds) if not b.get('special') and b.get('style') not in SKIP]
    pts, owner = [], []
    for i in todo:
        s = samples(blds[i]['pts'])
        pts.append(s)
        owner.append(np.full(len(s), i))
    pts = np.concatenate(pts)
    owner = np.concatenate(owner)
    ux, uy = game_to_utm(pts[:, 0], pts[:, 1])
    height = np.full(len(pts), np.nan, dtype=np.float32)
    print(f'{len(todo)} buildings, {len(pts)} sample points')

    for name in TILES:
        url = f'/vsicurl/{BUCKET}/v1/geotiffs/95a34_{YEAR}_06_30/{name}'
        with rasterio.open(url) as r:
            rows, cols = rasterio.transform.rowcol(r.transform, ux, uy)
            rows, cols = np.asarray(rows), np.asarray(cols)
            hit = (rows >= 0) & (rows < r.height) & (cols >= 0) & (cols < r.width) & np.isnan(height)
            if not hit.any():
                continue
            # read in 2048 px windows, only where there are samples
            B = 2048
            for wr in range(rows[hit].min() // B * B, rows[hit].max() + 1, B):
                for wc in range(cols[hit].min() // B * B, cols[hit].max() + 1, B):
                    m = hit & (rows >= wr) & (rows < wr + B) & (cols >= wc) & (cols < wc + B)
                    if not m.any():
                        continue
                    win = Window(wc, wr, min(B, r.width - wc), min(B, r.height - wr))
                    h = r.read(2, window=win)  # building_height
                    pr = r.read(3, window=win)  # building_presence
                    rr, cc = rows[m] - wr, cols[m] - wc
                    v = np.where(pr[rr, cc] > 0.5, h[rr, cc], np.nan)
                    height[np.where(m)[0]] = v
                    print(f'  {name} window {wr},{wc}: {m.sum()} samples', flush=True)

    changed = 0
    rng_hash = lambda i: zlib.crc32(str(i).encode()) % 100
    order = np.argsort(owner, kind='stable')
    so, sh = owner[order], height[order]
    starts = np.searchsorted(so, todo)
    ends = np.searchsorted(so, todo, side='right')
    tagged = osm_tagged(blds)
    for i, a, b in zip(todo, starts, ends):
        if i in tagged:
            continue  # mapped by hand in OSM: trust it over the satellite estimate
        v = sh[a:b]
        v = v[~np.isnan(v)]
        # most of the footprint must read as building (else the two datasets disagree)
        if len(v) < max(1, 0.3 * (b - a)):
            continue
        h = float(np.median(v))
        if h < 2.2:
            continue
        bld = blds[i]
        # a tall neighbour bleeding into a small footprint: no 9 m wide 80 m towers
        h = min(h, max(10.0, 4.5 * np.sqrt(area(bld['pts']))))
        if bld.get('villa') or bld.get('gen'):
            h = min(h, 10.0)
        h = round(max(2.6, h + 0.3), 1)
        levels = max(1, round((h - 0.3) / 2.9))
        bld['h'], bld['levels'], bld['hsrc'] = h, levels, 'google'
        st = bld.get('style')
        if st in ('house', 'brick') and levels >= 4:
            bld['style'] = 'apartments' if rng_hash(i) < 70 else 'brick'
        elif st in ('apartments', 'office') and levels <= 2:
            bld['style'] = 'brick' if rng_hash(i) < 60 else 'house'
        elif st == 'apartments' and levels >= 12 and rng_hash(i) < 25:
            bld['style'] = 'office'
        changed += 1

    attribution = 'Google Open Buildings 2.5D Temporal (alturas)'
    if attribution not in data.get('attribution', ''):
        data['attribution'] = (data.get('attribution', '') + ', ' + attribution).strip(', ')
    with open(DATA, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    hs = [b['h'] for b in blds if b.get('hsrc') == 'google']
    print(f'real heights for {changed} of {len(todo)} buildings; '
          f'median {np.median(hs):.1f} m, over 20 m: {sum(h > 20 for h in hs)}, over 40 m: {sum(h > 40 for h in hs)}')


if __name__ == '__main__':
    main()

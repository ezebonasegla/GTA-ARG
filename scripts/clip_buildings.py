#!/usr/bin/env python3
"""Keep building footprints off the streets in public/data/quilmes.json.

The footprints (Google Open Buildings, Overture) and the streets (OpenStreetMap) are
traced from different imagery and often disagree by a couple of metres: thousands of
houses stuck out over the carriageway, blocking traffic and looking wrong. Each building
is clipped back to the street line (carriageway plus CLEAR metres of sidewalk); one
that would lose most of its footprint is dropped. The `front` bits (which walls face a
street) are recomputed for the clipped ones.

    pip install shapely numpy
    python3 scripts/clip_buildings.py
"""
import json
import os

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data/quilmes.json')
CLEAR = 1.6  # metres of sidewalk kept clear beyond the carriageway
KEEP = 0.4  # drop a building left with less than this share of its footprint


def ring_area(pts):
    p = np.asarray(pts)
    return (np.dot(p[:, 0], np.roll(p[:, 1], -1)) - np.dot(p[:, 1], np.roll(p[:, 0], -1))) / 2


def main():
    data = json.load(open(DATA))
    roads = [r for r in data['roads'] if r['kind'] not in ('footway', 'pedestrian') and not r.get('pasillo') and not r.get('dirt') and len(r['pts']) > 1]
    lines = [LineString(r['pts']) for r in roads]
    zones = [l.buffer(r['w'] / 2 + CLEAR, cap_style=2, join_style=2) for l, r in zip(lines, roads)]
    tree = STRtree(zones)
    line_tree = STRtree(lines)

    def front_bits(pts):
        """Walls whose outside, 2 m out, is within a street's sidewalk."""
        ccw = ring_area(pts) > 0
        bits = 0
        n = len(pts)
        for i in range(min(n, 30)):
            a, b = np.asarray(pts[i]), np.asarray(pts[(i + 1) % n])
            d = b - a
            l = np.hypot(*d)
            if l < 0.5:
                continue
            out = np.array([d[1], -d[0]]) / l * (1 if ccw else -1)
            m = (a + b) / 2 + out * 2
            pt = LineString([m, m]).centroid
            for j in line_tree.query(pt.buffer(25)):
                if lines[j].distance(pt) < roads[j]['w'] / 2 + 3.5:
                    bits |= 1 << i
                    break
        return bits

    out, clipped, dropped = [], 0, 0
    for b in data['buildings']:
        if b.get('special'):
            out.append(b)
            continue
        try:
            P = Polygon(b['pts']).buffer(0)
        except Exception:
            out.append(b)
            continue
        hits = [zones[j] for j in tree.query(P) if zones[j].intersects(P)]
        if not hits or P.area < 1:
            out.append(b)
            continue
        rest = P.difference(unary_union(hits))
        if rest.is_empty or rest.area < KEEP * P.area:
            dropped += 1
            continue
        if rest.area > P.area - 0.3:
            out.append(b)
            continue
        if rest.geom_type != 'Polygon':
            rest = max(rest.geoms, key=lambda g: g.area)
        rest = rest.simplify(0.05)
        pts = [[round(x, 1), round(z, 1)] for x, z in list(rest.exterior.coords)[:-1]]
        if len(pts) < 3:
            dropped += 1
            continue
        # keep the ring direction the data had
        if (ring_area(pts) > 0) != (ring_area(b['pts']) > 0):
            pts.reverse()
        b['pts'] = pts
        if 'front' in b:
            b['front'] = front_bits(pts)
        out.append(b)
        clipped += 1
    data['buildings'] = out
    with open(DATA, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f'clipped {clipped}, dropped {dropped}, kept {len(out)} buildings')


if __name__ == '__main__':
    main()

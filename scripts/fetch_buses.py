#!/usr/bin/env python3
"""Real colectivo lines of Quilmes from the official AMBA bus GTFS.

Downloads the "Colectivos Buenos Aires" GTFS (Mobility Database mirror of the
feed published by the Buenos Aires government), keeps every route variant
(ramal) whose shape passes through the game map, and writes
public/data/buses.json with each ramal's path and stops in game coordinates.

    python3 scripts/fetch_buses.py [--gtfs path/to/colectivos.zip]
"""
import argparse
import csv
import io
import json
import math
import os
import re
import sys
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = 'https://storage.googleapis.com/storage/v1/b/mdb-latest/o/ar-buenos-aires-colectivos-buenos-aires-gtfs-1220.zip?alt=media'
OFFICIAL = 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-gtfs/colectivos-gtfs.zip'


def download(dest):
    for url in (OFFICIAL, MIRROR):
        try:
            print(f'Descargando GTFS de colectivos desde {url.split("/")[2]}…')
            with urllib.request.urlopen(url, timeout=600) as r, open(dest, 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            return
        except Exception as e:  # noqa: BLE001 - try the next source
            print(f'  falló: {e}')
    sys.exit('No se pudo descargar el GTFS de colectivos.')


def rows(z, name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gtfs', default=os.path.join(ROOT, '.cache', 'colectivos-gtfs.zip'))
    ap.add_argument('--city', default=os.path.join(ROOT, 'public', 'data', 'quilmes.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'data', 'buses.json'))
    ap.add_argument('--margin', type=float, default=250, help='metros fuera del mapa que se conservan')
    a = ap.parse_args()

    with open(a.city) as f:
        city = json.load(f)
    lat0, lon0 = city['origin']['lat'], city['origin']['lon']
    kx, kz = math.cos(math.radians(lat0)) * 111320, 110540
    to_world = lambda la, lo: ((lo - lon0) * kx, -(la - lat0) * kz)  # noqa: E731
    b = city['bounds']
    lim = (b['minX'] - a.margin, b['minZ'] - a.margin, b['maxX'] + a.margin, b['maxZ'] + a.margin)
    inside = lambda x, z: lim[0] <= x <= lim[2] and lim[1] <= z <= lim[3]  # noqa: E731

    if not os.path.exists(a.gtfs):
        os.makedirs(os.path.dirname(a.gtfs), exist_ok=True)
        download(a.gtfs)
    z = zipfile.ZipFile(a.gtfs)
    dates = [r['date'] for r in rows(z, 'calendar_dates.txt')]
    print(f'GTFS con servicios del {min(dates)} al {max(dates)}')

    # shapes that pass through the map
    shapes = {}
    for r in rows(z, 'shapes.txt'):
        shapes.setdefault(r['shape_id'], []).append((int(r['shape_pt_sequence']), float(r['shape_pt_lat']), float(r['shape_pt_lon'])))
    keep = {}
    for sid, pts in shapes.items():
        pts.sort()
        w = [to_world(la, lo) for _, la, lo in pts]
        if sum(1 for x, zz in w if inside(x, zz)) >= 3:
            keep[sid] = w
    print(f'  {len(keep)} recorridos pasan por el mapa')

    routes = {r['route_id']: r for r in rows(z, 'routes.txt')}
    agencies = {r['agency_id']: r['agency_name'] for r in rows(z, 'agency.txt')}
    variants = {}  # shape_id -> trip info (one representative trip)
    for t in rows(z, 'trips.txt'):
        sid = t['shape_id']
        if sid in keep and sid not in variants:
            variants[sid] = t
    trip_ids = {t['trip_id']: sid for sid, t in variants.items()}

    # stop sequence of the representative trips (stop_times is large: stream it)
    seqs = {}
    for r in rows(z, 'stop_times.txt'):
        sid = trip_ids.get(r['trip_id'])
        if sid:
            seqs.setdefault(sid, []).append((int(r['stop_sequence']), r['stop_id']))
    needed = {s for seq in seqs.values() for _, s in seq}
    stops = {}
    for r in rows(z, 'stops.txt'):
        if r['stop_id'] in needed:
            stops[r['stop_id']] = (r['stop_name'].strip(), *to_world(float(r['stop_lat']), float(r['stop_lon'])))

    out_lines = []
    for sid, t in variants.items():
        route = routes[t['route_id']]
        short = route['route_short_name'].strip()
        m = re.match(r'(\d+)', short)
        line = m.group(1) if m else short
        # longest stretch of the path inside the map (+margin)
        w = keep[sid]
        best, run = [], []
        for p in w:
            if inside(*p):
                run.append(p)
            else:
                if len(run) > len(best):
                    best = run
                run = []
        if len(run) > len(best):
            best = run
        if len(best) < 2:
            continue
        path = [[round(x, 1), round(zz, 1)] for x, zz in best]
        cum = [0.0]
        for i in range(1, len(path)):
            cum.append(cum[-1] + math.dist(path[i - 1], path[i]))
        if cum[-1] < 150:
            continue
        # stops of this ramal that lie along the kept stretch, with their distance along it
        ramal_stops = []
        for _, stop_id in sorted(seqs.get(sid, [])):
            st = stops.get(stop_id)
            if not st or not inside(st[1], st[2]):
                continue
            best_d, best_s = 1e9, 0
            for i in range(len(path) - 1):
                (ax, az), (bx, bz) = path[i], path[i + 1]
                dx, dz = bx - ax, bz - az
                l2 = dx * dx + dz * dz or 1
                u = max(0, min(1, ((st[1] - ax) * dx + (st[2] - az) * dz) / l2))
                d = math.dist((ax + dx * u, az + dz * u), (st[1], st[2]))
                if d < best_d:
                    best_d, best_s = d, cum[i] + math.sqrt(l2) * u
            if best_d < 40:
                ramal_stops.append({'id': stop_id, 'name': st[0].title(), 'x': round(st[1], 1), 'z': round(st[2], 1), 's': round(best_s, 1)})
        out_lines.append({
            'line': line,
            'ramal': short,
            'name': route['route_desc'].strip(),
            'agency': agencies.get(route['agency_id'], '').strip(),
            'headsign': t['trip_headsign'].strip(),
            'direction': int(t['direction_id'] or 0),
            'length': round(cum[-1]),
            'path': path,
            'stops': ramal_stops,
        })

    out_lines.sort(key=lambda r: (int(r['line']) if r['line'].isdigit() else 9999, r['ramal'], r['direction']))
    all_stops = {}
    for r in out_lines:
        for s in r['stops']:
            e = all_stops.setdefault(s['id'], {'name': s['name'], 'x': s['x'], 'z': s['z'], 'lines': []})
            if r['line'] not in e['lines']:
                e['lines'].append(r['line'])
    data = {
        'source': 'GTFS Colectivos Buenos Aires (Gobierno de la Ciudad de Buenos Aires / Mobility Database)',
        'validFrom': min(dates),
        'validTo': max(dates),
        'routes': out_lines,
        'stops': [{'id': k, **v} for k, v in all_stops.items()],
    }
    with open(a.out, 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    names = sorted({r['line'] for r in out_lines}, key=lambda x: int(x) if x.isdigit() else 9999)
    print(f'Escrito {os.path.relpath(a.out, ROOT)}: {len(names)} líneas ({", ".join(names)}), '
          f'{len(out_lines)} recorridos, {len(all_stops)} paradas, {os.path.getsize(a.out) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()

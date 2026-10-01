#!/usr/bin/env python3
"""Download Quilmes from Overture Maps (public S3 bucket, no API key) and write it
as an Overpass-style JSON that scripts/fetch-osm.mjs converts into the game map.

Overture combines OpenStreetMap with building footprints detected from satellite
imagery (Google Open Buildings, Microsoft ML Buildings), so it covers the many
houses of the conurbano that are not drawn in OSM.

    pip install pyarrow shapely
    python3 scripts/fetch_overture.py [--lat -34.7206 --lon -58.2546 --radius 2500]
    node scripts/fetch-osm.mjs --input .cache/overture-raw.json --radius 2500

(`npm run fetch-overture` runs both steps.)

Data: © OpenStreetMap contributors, Overture Maps Foundation, Google Open Buildings,
Microsoft ML Buildings — ODbL / CDLA-Permissive / CC-BY 4.0 as published by Overture.
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

try:
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.fs as pafs
    import pyarrow.parquet as pq
    from shapely import wkb
except ImportError:
    sys.exit('Faltan dependencias: pip install pyarrow shapely')

BUCKET = 'overturemaps-us-west-2'
THEMES = {
    'building': 'theme=buildings/type=building',
    'segment': 'theme=transportation/type=segment',
    'water': 'theme=base/type=water',
    'land_use': 'theme=base/type=land_use',
    'place': 'theme=places/type=place',
    'address': 'theme=addresses/type=address',
    'land': 'theme=base/type=land',
    'division': 'theme=divisions/type=division_area',
}

ROAD_CLASSES = {
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified',
    'living_street', 'service', 'pedestrian',
}
PARK_CLASSES = {'park', 'garden', 'grass', 'playground', 'meadow', 'village_green', 'cemetery', 'dog_park', 'recreation_ground', 'forest', 'wood'}
SHOP_WORDS = ('store', 'shop', 'restaurant', 'eatery', 'bar', 'cafe', 'bakery', 'pharmacy', 'bank', 'food', 'beauty', 'salon', 'market', 'kiosk', 'service')
LANDMARK_CATEGORIES = {
    'train_station', 'christian_place_of_worship', 'stadium_arena', 'government_office', 'hospital', 'museum',
    'theatre_venue', 'shopping_mall', 'brewery', 'public_plaza', 'park', 'college_university', 'police_station',
}


def latest_release(s3):
    infos = s3.get_file_info(pafs.FileSelector(f'{BUCKET}/release/'))
    return sorted(i.path.split('/')[-1] for i in infos if i.type == pafs.FileType.Directory)[-1]


def read_theme(s3, release, theme, bb):
    base = f'{BUCKET}/release/{release}/{theme}/'
    files = [i.path for i in s3.get_file_info(pafs.FileSelector(base)) if i.path.endswith('.parquet')]

    def scan(path):
        f = pq.ParquetFile(s3.open_input_file(path))
        md = f.metadata
        names = [md.schema.column(i).path for i in range(md.num_columns)]
        idx = {k: names.index('bbox.' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax')}
        groups = []
        for rg in range(md.num_row_groups):
            st = {k: md.row_group(rg).column(i).statistics for k, i in idx.items()}
            if any(v is None or not v.has_min_max for v in st.values()):
                continue
            if st['xmin'].min <= bb[2] and st['xmax'].max >= bb[0] and st['ymin'].min <= bb[3] and st['ymax'].max >= bb[1]:
                groups.append(rg)
        if not groups:
            return None
        t = f.read_row_groups(groups)
        b = t.column('bbox')
        mask = pc.and_(
            pc.and_(pc.less_equal(pc.struct_field(b, 'xmin'), bb[2]), pc.greater_equal(pc.struct_field(b, 'xmax'), bb[0])),
            pc.and_(pc.less_equal(pc.struct_field(b, 'ymin'), bb[3]), pc.greater_equal(pc.struct_field(b, 'ymax'), bb[1])),
        )
        return t.filter(mask)

    with ThreadPoolExecutor(32) as ex:
        tables = [t for t in ex.map(scan, files) if t is not None and t.num_rows]
    if not tables:
        return []
    return pa.concat_tables(tables, promote_options='permissive').to_pylist()


def num_id(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:12], 16)


def ring(coords):
    return [{'lat': round(y, 7), 'lon': round(x, 7)} for x, y in coords]


def polygons(geom):
    if geom.geom_type == 'Polygon':
        return [geom]
    if geom.geom_type == 'MultiPolygon':
        return list(geom.geoms)
    return []


def name_of(row):
    n = row.get('names') or {}
    return n.get('primary') or ''


def parse_freeform(text):
    """'Av. Mitre 4935' / 'Salta, 603' / 'C. 331 Bis 1350, entre ...' -> (street, number)."""
    parts = [p.strip() for p in text.split(',')]
    first = parts[0]
    if len(parts) > 1 and re.fullmatch(r'\d{1,5}', parts[1]) and not re.search(r'\d', first):
        first = f'{first} {parts[1]}'
    m = re.fullmatch(r'(.*\D)\s+(?:n[°ºo]\.?\s*)?(\d{1,5})(?:\s*(?:bis|[a-z]))?', first, re.I)
    if not m or int(m.group(2)) == 0 or len(m.group(1).strip()) < 2:
        return None
    return m.group(1).strip(), m.group(2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lat', type=float, default=-34.7206)
    ap.add_argument('--lon', type=float, default=-58.2546)
    ap.add_argument('--radius', type=float, default=2500, help='metros')
    ap.add_argument('--extent', default=None, help='archivo con poligonos en metros del juego (scripts/extent.json); reemplaza --radius')
    ap.add_argument('--release', default=None)
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', '.cache', 'overture-raw.json'))
    ap.add_argument('--only-addresses', action='store_true', help='solo actualizar las direcciones de un --out existente')
    a = ap.parse_args()

    kx, kz = 111320 * math.cos(math.radians(a.lat)), 110540
    if a.extent:
        with open(a.extent) as f:
            pts = [p for poly in json.load(f)['polygons'] for p in poly]
        xs, zs = [p[0] for p in pts], [p[1] for p in pts]
        # world x east, z south -> lon/lat, with a 300 m margin
        bb = (a.lon + (min(xs) - 300) / kx, a.lat - (max(zs) + 300) / kz, a.lon + (max(xs) + 300) / kx, a.lat - (min(zs) - 300) / kz)
    else:
        dlat = a.radius / kz * 1.1
        dlon = a.radius / kx * 1.1
        bb = (a.lon - dlon, a.lat - dlat, a.lon + dlon, a.lat + dlat)
    s3 = pafs.S3FileSystem(anonymous=True, region='us-west-2')
    release = a.release or latest_release(s3)
    print(f'Overture {release}, bbox {tuple(round(v, 4) for v in bb)}')

    if a.only_addresses:
        # Keep everything else from a previous download, refresh only the addresses.
        with open(a.out) as f:
            elements = [e for e in json.load(f)['elements'] if 'addr:housenumber' not in (e.get('tags') or {})]
        rows = {k: [] for k in THEMES}
        for key in ('address', 'place'):
            rows[key] = read_theme(s3, release, THEMES[key], bb)
            print(f'  {key}: {len(rows[key])}')
    else:
        elements = []
        rows = {}
        for key, theme in THEMES.items():
            rows[key] = read_theme(s3, release, theme, bb)
            print(f'  {key}: {len(rows[key])}')

    for r in rows['building']:
        if r.get('is_underground'):
            continue
        tags = {'building': r.get('class') or 'yes'}
        if r.get('height'):
            tags['height'] = str(round(r['height'], 1))
        if r.get('num_floors'):
            tags['building:levels'] = str(r['num_floors'])
        if r.get('roof_shape'):
            tags['roof:shape'] = r['roof_shape']
        if r.get('facade_color'):
            tags['building:colour'] = r['facade_color']
        if name_of(r):
            tags['name'] = name_of(r)
        src = (r.get('sources') or [{}])[0].get('dataset') or ''
        if src:
            tags['source'] = src
        for i, poly in enumerate(polygons(wkb.loads(r['geometry']))):
            elements.append({'type': 'way', 'id': num_id(f"{r['id']}:{i}"), 'tags': tags, 'geometry': ring(poly.exterior.coords)})

    for r in rows['segment']:
        geom = wkb.loads(r['geometry'])
        if geom.geom_type != 'LineString':
            continue
        tags = {}
        if r['subtype'] == 'rail':
            tags['railway'] = 'rail'
        elif r['subtype'] == 'road':
            cls = r.get('class') or 'unknown'
            if cls == 'unknown':
                cls = 'residential'
            if cls not in ROAD_CLASSES:
                continue
            tags['highway'] = cls
            if name_of(r):
                tags['name'] = name_of(r)
            for rule in r.get('access_restrictions') or []:
                when = rule.get('when') or {}
                if rule.get('access_type') != 'denied' or not when.get('heading'):
                    continue
                if any(when.get(k) for k in ('during', 'mode', 'using', 'recognized', 'vehicle')):
                    continue
                tags['oneway'] = 'yes' if when['heading'] == 'backward' else '-1'
            flags = [f for fr in (r.get('road_flags') or []) for f in (fr.get('values') or [])]
            if 'is_bridge' in flags:
                tags['bridge'] = 'yes'
            if 'is_tunnel' in flags:
                continue
        else:
            continue
        elements.append({'type': 'way', 'id': num_id(r['id']), 'tags': tags, 'geometry': ring(geom.coords)})

    for r in rows['water']:
        geom = wkb.loads(r['geometry'])
        polys = polygons(geom)
        if not polys:
            continue
        tags = {'natural': 'water', 'water': r.get('subtype') or 'water'}
        if name_of(r):
            tags['name'] = name_of(r)
        for i, poly in enumerate(polys):
            elements.append({'type': 'relation', 'id': num_id(f"{r['id']}:{i}"), 'tags': tags,
                             'members': [{'type': 'way', 'role': 'outer', 'geometry': ring(poly.exterior.coords)}]})

    for r in rows['land_use']:
        cls = r.get('class') or ''
        if cls in PARK_CLASSES:
            tags = {'leisure': 'park'}
        elif cls in ('pitch', 'track'):
            tags = {'leisure': 'pitch'}
        elif cls in ('stadium',):
            tags = {'leisure': 'stadium'}
        elif r.get('subtype') == 'pedestrian' or cls == 'pedestrian':
            tags = {'place': 'square'}
        elif cls in ('beach', 'sand'):
            tags = {'natural': 'beach'}
        elif cls == 'railway':
            tags = {'landuse': 'railway'}
        elif cls in ('brownfield', 'greenfield', 'construction', 'landfill'):
            tags = {'landuse': cls}  # descampados
        else:
            continue
        if name_of(r):
            tags['name'] = name_of(r)
        for i, poly in enumerate(polygons(wkb.loads(r['geometry']))):
            elements.append({'type': 'way', 'id': num_id(f"{r['id']}:{i}"), 'tags': tags, 'geometry': ring(poly.exterior.coords)})

    # Natural land cover: woods, pastizales and bañados along the river.
    for r in rows['land']:
        cls = r.get('class') or ''
        if cls in ('forest', 'wood'):
            tags = {'natural': 'wood'}
        elif cls in ('scrub', 'heath', 'grassland', 'grass', 'meadow'):
            tags = {'natural': 'grassland' if cls in ('grassland', 'grass', 'meadow') else 'scrub'}
        elif cls in ('wetland', 'marsh', 'reedbed', 'swamp', 'wet_meadow'):
            tags = {'natural': 'wetland'}
        else:
            continue
        for i, poly in enumerate(polygons(wkb.loads(r['geometry']))):
            elements.append({'type': 'way', 'id': num_id(f"{r['id']}:{i}"), 'tags': tags, 'geometry': ring(poly.exterior.coords)})

    # Neighbourhood names (to name the villas and barrios).
    for r in rows['division']:
        if r.get('subtype') not in ('neighborhood', 'microhood', 'locality') or r.get('class') != 'land' or not name_of(r):
            continue
        for i, poly in enumerate(polygons(wkb.loads(r['geometry']))):
            elements.append({'type': 'way', 'id': num_id(f"{r['id']}:{i}"), 'tags': {'boundary': 'place', 'place': r['subtype'], 'name': name_of(r)},
                             'geometry': ring(poly.simplify(0.00005).exterior.coords)})

    for r in [] if a.only_addresses else rows['place']:
        cat = r.get('basic_category') or ''
        conf = r.get('confidence') or 0
        if conf < 0.5:
            continue
        p = wkb.loads(r['geometry'])
        tags = {}
        if any(w in cat for w in SHOP_WORDS):
            tags['shop'] = 'yes'
        if cat == 'christian_place_of_worship':
            tags['amenity'] = 'place_of_worship'
        if cat == 'train_station':
            tags['railway'] = 'station'
        if cat in LANDMARK_CATEGORIES and conf >= (0.75 if cat in ('stadium_arena', 'train_station') else 0.9) and name_of(r):
            tags['name'] = name_of(r)
            tags['landmark'] = cat
        if tags:
            elements.append({'type': 'node', 'id': num_id(r['id']), 'lat': p.y, 'lon': p.x, 'tags': tags})

    # House numbers: street corner signs show each block's "altura". The addresses
    # theme has no Argentine data yet, so the street addresses of places (shops,
    # offices...) fill in; fetch-osm.mjs matches them to nearby streets.
    counts = {'address': 0, 'place': 0}

    def add_address(key, rid, geom, num, street):
        p = wkb.loads(geom)
        if p.geom_type != 'Point':
            return
        elements.append({'type': 'node', 'id': num_id(rid + ':addr'), 'lat': round(p.y, 7), 'lon': round(p.x, 7),
                         'tags': {'addr:housenumber': num, 'addr:street': street, 'addr:source': key}})
        counts[key] += 1

    for r in rows['address']:
        num, street = (r.get('number') or '').strip(), (r.get('street') or '').strip()
        if num[:1].isdigit() and street:
            add_address('address', r['id'], r['geometry'], num, street)
    for r in rows['place']:
        for ad in r.get('addresses') or []:
            parsed = parse_freeform(ad.get('freeform') or '')
            if parsed and (ad.get('country') or 'AR') == 'AR':
                add_address('place', r['id'], r['geometry'], parsed[1], parsed[0])
                break
    print(f"  direcciones: {counts['address']} (addresses) + {counts['place']} (de lugares)")

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump({'generator': 'overture', 'release': release, 'elements': elements}, f)
    print(f'Escrito {os.path.relpath(a.out)} ({len(elements)} elementos)')


if __name__ == '__main__':
    main()

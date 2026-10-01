#!/usr/bin/env node
// Downloads real map data of Quilmes from OpenStreetMap (Overpass API) and converts
// it into the game's city format: public/data/quilmes.json
//
//   npm run fetch-osm                          # 2 km around Plaza San Martín (reaches the river)
//   npm run fetch-osm -- --radius 2500         # bigger area (heavier)
//   npm run fetch-osm -- --extent scripts/extent.json   # playable area = union of polygons (world m)
//   npm run fetch-osm -- --lat -34.72 --lon -58.25
//   npm run fetch-osm -- --input raw.json      # convert a saved Overpass response
//   npm run fetch-osm -- --no-infill           # don't fill blocks missing buildings
//   npm run fetch-osm -- --no-split            # don't split merged row-house footprints
//   npm run fetch-osm -- --no-conurbano        # no villas, descampados, rejas... (see conurbano.mjs)
//
// Map data © OpenStreetMap contributors, available under the ODbL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUILMES_CENTER, makeProjection, mulberry32, polygonArea, pointInPolygon,
  closestOnSegment, bbox, SpatialHash, nearestBuilding,
} from '../src/world/geo.js';
import { detectSpecials } from './specials.mjs';
import { computeStreetSigns } from '../src/world/alturas.js';
import { conurbano } from './conurbano.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const center = { lat: +(args.lat ?? QUILMES_CENTER.lat), lon: +(args.lon ?? QUILMES_CENTER.lon) };
// Playable area: a square of `radius` around the center, or the union of the
// polygons (world meters) in an extent file.
const extent = args.extent ? JSON.parse(fs.readFileSync(path.resolve(path.dirname(path.dirname(fileURLToPath(import.meta.url))), args.extent))).polygons : null;
const ext = extent ? bbox(extent.flat()) : null;
const radius = ext ? Math.ceil(Math.max(-ext.minX, ext.maxX, -ext.minZ, ext.maxZ) / 1.05) : +(args.radius ?? 2000);
const outFile = path.resolve(root, args.out ?? 'public/data/quilmes.json');
const cacheFile = path.resolve(root, '.cache/osm-raw.json');

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key.startsWith('no-')) out[key.slice(3)] = false;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}

async function download() {
  const kx = 111320 * Math.cos((center.lat * Math.PI) / 180), kz = 110540;
  const e = ext || { minX: -radius, minZ: -radius, maxX: radius, maxZ: radius };
  const bb = [center.lat - (e.maxZ + 300) / kz, center.lon + (e.minX - 300) / kx, center.lat - (e.minZ - 300) / kz, center.lon + (e.maxX + 300) / kx].map((v) => v.toFixed(6)).join(',');
  const query = `[out:json][timeout:240];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
  way["highway"](${bb});
  way["railway"~"^(rail|light_rail|tram)$"](${bb});
  way["natural"~"^(water|coastline|beach|sand|wood|scrub)$"](${bb});
  relation["natural"="water"](${bb});
  way["waterway"="riverbank"](${bb});
  way["leisure"~"^(park|garden|pitch|playground|stadium|sports_centre)$"](${bb});
  way["landuse"~"^(grass|recreation_ground|village_green|railway|forest|meadow)$"](${bb});
  way["place"="square"](${bb});
  way["amenity"="parking"](${bb});
  node["shop"](${bb});
  node["amenity"~"^(restaurant|cafe|bar|pharmacy|bank|fast_food|ice_cream|pub)$"](${bb});
  node["railway"="station"](${bb});
  node["addr:housenumber"]["addr:street"](${bb});
);
out geom;`;
  for (const url of ENDPOINTS) {
    try {
      console.log(`Descargando datos de OSM desde ${new URL(url).host} (radio ${radius} m)…`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'gta-quilmes/0.1 (map import script)' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(json));
      return json;
    } catch (err) {
      console.warn(`  falló: ${err.message}`);
    }
  }
  throw new Error('No se pudo descargar de ningún servidor Overpass. Probá de nuevo más tarde o usá --input.');
}

// ---------------------------------------------------------------------------
const proj = makeProjection(center);
const r1 = (v) => Math.round(v * 10) / 10;
const toPts = (geom) => geom.map((g) => proj.toWorld(g.lat, g.lon)).map(([x, z]) => [r1(x), r1(z)]);
const closedRing = (pts) => {
  if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) return pts.slice(0, -1);
  return null;
};

function parseNum(v) {
  if (v == null) return NaN;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const ROAD_SPECS = {
  motorway: [24, 'primary'], trunk: [22, 'primary'], primary: [18, 'primary'], secondary: [14, 'secondary'],
  tertiary: [12, 'secondary'], motorway_link: [8, 'secondary'], trunk_link: [8, 'secondary'], primary_link: [8, 'secondary'],
  secondary_link: [8, 'secondary'], tertiary_link: [8, 'residential'], residential: [9, 'residential'],
  unclassified: [9, 'residential'], living_street: [7, 'residential'], road: [8, 'residential'],
  service: [5, 'service'], pedestrian: [8, 'pedestrian'],
};

// Joins open ways (multipolygon outer members) into closed rings.
function joinRings(ways) {
  const rings = [];
  const pool = ways.map((w) => w.slice());
  while (pool.length) {
    let ring = pool.shift();
    let changed = true;
    while (changed && !(ring.length > 3 && same(ring[0], ring[ring.length - 1]))) {
      changed = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        if (same(ring[ring.length - 1], w[0])) ring = ring.concat(w.slice(1));
        else if (same(ring[ring.length - 1], w[w.length - 1])) ring = ring.concat(w.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        changed = true;
        break;
      }
    }
    if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) rings.push(ring.slice(0, -1));
  }
  return rings;
  function same(a, b) {
    return Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  }
}

// Sutherland–Hodgman clip against an axis-aligned rectangle.
function clipRect(pts, minX, minZ, maxX, maxZ) {
  const edges = [
    (p) => p[0] >= minX, (p) => p[0] <= maxX, (p) => p[1] >= minZ, (p) => p[1] <= maxZ,
  ];
  const inter = [
    (a, b) => lerpAt(a, b, (minX - a[0]) / (b[0] - a[0])), (a, b) => lerpAt(a, b, (maxX - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (minZ - a[1]) / (b[1] - a[1])), (a, b) => lerpAt(a, b, (maxZ - a[1]) / (b[1] - a[1])),
  ];
  let out = pts;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const ci = edges[e](cur), pi = edges[e](prev);
      if (ci) {
        if (!pi) out.push(inter[e](prev, cur));
        out.push(cur);
      } else if (pi) out.push(inter[e](prev, cur));
    }
  }
  return out.map(([x, z]) => [r1(x), r1(z)]);
  function lerpAt(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
}

function buildingHeight(tags, area, rng, dist) {
  const h = parseNum(tags.height);
  if (h > 1) return { h, levels: Math.max(1, Math.round(h / 3)) };
  const lv = parseNum(tags['building:levels']);
  const roofLv = parseNum(tags['roof:levels']) || 0;
  if (lv > 0) return { h: lv * 3 + roofLv * 2 + 0.5, levels: lv };
  const b = tags.building;
  const pick = (weights) => {
    let r = rng();
    for (const [levels, w] of weights) if ((r -= w) < 0) return levels;
    return weights[0][0];
  };
  let levels;
  if (['house', 'detached', 'residential', 'semidetached_house', 'terrace', 'bungalow'].includes(b)) levels = pick([[1, 0.55], [2, 0.4], [3, 0.05]]);
  else if (b === 'apartments') levels = 4 + Math.floor(rng() * 9);
  else if (['commercial', 'retail', 'kiosk', 'supermarket'].includes(b)) levels = area > 800 ? 2 : pick([[1, 0.5], [2, 0.5]]);
  else if (b === 'office') levels = 3 + Math.floor(rng() * 6);
  else if (['church', 'cathedral', 'chapel'].includes(b)) return { h: b === 'cathedral' ? 22 : 14, levels: 1 };
  else if (['industrial', 'warehouse', 'hangar'].includes(b)) return { h: 7 + rng() * 4, levels: 1 };
  else if (['garage', 'garages', 'shed', 'roof', 'carport', 'hut'].includes(b)) return { h: 2.8, levels: 1 };
  else if (['school', 'university', 'college', 'hospital', 'civic', 'public', 'government'].includes(b)) levels = 2 + Math.floor(rng() * 3);
  else if (b === 'train_station') return { h: 9, levels: 2 };
  else {
    // No data (most satellite-detected footprints): guess from footprint size and
    // distance to the center, where Quilmes has most of its apartment towers.
    const towerChance = dist < 450 ? 0.33 : dist < 900 ? 0.12 : dist < 1500 ? 0.04 : 0.012;
    if (area < 35) return { h: 2.8, levels: 1 };
    if (area < 150) levels = pick(dist < 900 ? [[1, 0.4], [2, 0.5], [3, 0.1]] : [[1, 0.6], [2, 0.37], [3, 0.03]]);
    else if (area < 900 && rng() < towerChance) levels = dist < 700 ? 6 + Math.floor(rng() * 10) : 4 + Math.floor(rng() * 6);
    else if (area < 900) levels = pick([[1, 0.35], [2, 0.45], [3, 0.2]]);
    else if (dist > 900 && rng() < 0.7) return { h: 7 + rng() * 4, levels: 1, industrial: true };
    else levels = pick([[2, 0.5], [3, 0.3], [4, 0.2]]);
  }
  return { h: levels * 3 + 0.3 + rng() * 0.5, levels };
}

// Cut a footprint into strips across its main axis (lots facing the street), and
// very deep footprints also along the other axis.
function splitIntoLots(ring, rng, allowDeep) {
  let best = 0, ux = 1, uz = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) {
      best = l;
      ux = (b[0] - a[0]) / l;
      uz = (b[1] - a[1]) / l;
    }
  }
  const vx = -uz, vz = ux;
  const proj = (p, dx, dz) => p[0] * dx + p[1] * dz;
  const us = ring.map((p) => proj(p, ux, uz)), vs = ring.map((p) => proj(p, vx, vz));
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  if (u1 - u0 < 16 && v1 - v0 < 50) return [ring];
  if (v1 - v0 >= 40 && !allowDeep) return [ring]; // compact and big: warehouse/factory
  const cuts = (lo, hi, min, max) => {
    const out = [lo];
    let c = lo;
    while (hi - c > max + min / 2) out.push((c += min + rng() * (max - min)));
    out.push(hi);
    return out;
  };
  const uc = cuts(u0, u1, 7.5, 11.5);
  const vc = v1 - v0 > 50 ? cuts(v0, v1, 20, 30) : [v0, v1];
  const parts = [];
  for (let i = 0; i < uc.length - 1; i++) {
    let strip = clipHalf(ring, ux, uz, uc[i], 1);
    strip = clipHalf(strip, ux, uz, uc[i + 1], -1);
    for (let j = 0; j < vc.length - 1 && strip.length >= 3; j++) {
      let cell = clipHalf(strip, vx, vz, vc[j], 1);
      cell = clipHalf(cell, vx, vz, vc[j + 1], -1);
      if (cell.length >= 3 && Math.abs(polygonArea(cell)) > 12) parts.push(cell.map(([x, z]) => [r1(x), r1(z)]));
    }
  }
  return parts;
}

// Keep the part of the polygon where sign * (p·d - c) >= 0.
function clipHalf(pts, dx, dz, c, sign) {
  const out = [];
  const f = (p) => sign * (p[0] * dx + p[1] * dz - c);
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
    const fc = f(cur), fp = f(prev);
    if (fc >= 0) {
      if (fp < 0) out.push(lerp(prev, cur, fp / (fp - fc)));
      out.push(cur);
    } else if (fp >= 0) out.push(lerp(prev, cur, fp / (fp - fc)));
  }
  return out;
  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
}

function buildingStyle(tags, levels, rng, industrial) {
  const b = tags.building;
  if (industrial) return 'industrial';
  if (['church', 'cathedral', 'chapel'].includes(b) || tags.amenity === 'place_of_worship') return 'church';
  if (['civic', 'public', 'government'].includes(b) || tags.amenity === 'townhall') return 'civic';
  if (b === 'train_station') return 'station';
  if (['industrial', 'warehouse', 'hangar'].includes(b)) return 'industrial';
  if (['school', 'university', 'college'].includes(b)) return 'school';
  if (b === 'hospital') return 'hospital';
  if (b === 'office' || (levels >= 10 && rng() < 0.3)) return 'office';
  if (b === 'apartments' || levels >= 4) return rng() < 0.7 ? 'apartments' : 'brick';
  return rng() < 0.7 ? 'house' : 'brick';
}

function convert(osm) {
  const rng = mulberry32(1666);
  const roads = [], buildings = [], areas = [], rails = [], landmarks = [], barriers = [], divisions = [];
  const shopNodes = [], addresses = [];
  const overture = osm.generator === 'overture';
  const lim = radius * 1.05;
  // R: rectangle around the playable area; inside(): really in it
  const R = ext ? { minX: ext.minX - 130, minZ: ext.minZ - 130, maxX: ext.maxX + 130, maxZ: ext.maxZ + 130 } : { minX: -lim, minZ: -lim, maxX: lim, maxZ: lim };
  const inside = ([x, z]) => x >= R.minX && x <= R.maxX && z >= R.minZ && z <= R.maxZ && (!extent || extent.some((poly) => pointInPolygon(x, z, poly)));

  // Points of interest first, so buildings that contain a known place keep their
  // whole footprint (they are not split into lots) and get a special shape.
  const pois = [];
  const poiIndex = new SpatialHash(40);
  for (const el of osm.elements) {
    if (el.type !== 'node') continue;
    const t = el.tags || {};
    const [x, z] = proj.toWorld(el.lat, el.lon);
    const num = parseInt(t['addr:housenumber'], 10);
    if (num > 0 && num < 30000 && t['addr:street']) addresses.push({ x, z, number: num, street: t['addr:street'] });
    if (t.shop || (t.amenity && t.amenity !== 'place_of_worship')) shopNodes.push([x, z]);
    if ((t.railway === 'station' || t.landmark) && t.name) landmarks.push({ name: t.name, pos: [r1(x), r1(z)], kind: t.landmark || 'train_station' });
    let kind = t.landmark || (t.railway === 'station' ? 'train_station' : null);
    if (t.amenity === 'place_of_worship') kind = 'church';
    if (kind) {
      const poi = { x, z, kind, name: t.name || '' };
      pois.push(poi);
      poiIndex.insert(poi, { minX: x, minZ: z, maxX: x, maxZ: z });
    }
  }
  // Named places win over anonymous ones inside the same footprint.
  const poiIn = (ring, id) => {
    const b = bbox(ring);
    let found = null;
    for (const p of poiIndex.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
      if (p.kind !== 'train_station' && pointInPolygon(p.x, p.z, ring) && (!found || (!found.name && p.name))) found = p;
    }
    return found || nearbyPoi.get(id) || null;
  };
  // Important places whose point falls just outside every footprint (e.g. on the
  // sidewalk): attach them to the biggest nearby building.
  const nearbyPoi = new Map();
  {
    const important = pois.filter((p) => p.name && /government_office|theatre_venue|museum|hospital|church/.test(p.kind));
    const best = new Map();
    for (const el of osm.elements) {
      if (el.type !== 'way' || !el.tags?.building || !el.geometry) continue;
      const ring = closedRing(toPts(el.geometry));
      if (!ring) continue;
      const b = bbox(ring);
      for (const p of important) {
        if (p.x < b.minX - 35 || p.x > b.maxX + 35 || p.z < b.minZ - 35 || p.z > b.maxZ + 35) continue;
        if (pointInPolygon(p.x, p.z, ring)) {
          best.set(p, { inside: true });
          continue;
        }
        if (best.get(p)?.inside) continue;
        let d = Infinity;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) d = Math.min(d, Math.sqrt(closestOnSegment(p.x, p.z, ring[j][0], ring[j][1], ring[i][0], ring[i][1])[3]));
        if (d > 30) continue;
        const score = Math.abs(polygonArea(ring)) / (1 + d / 8);
        if (!best.has(p) || score > best.get(p).score) best.set(p, { score, id: el.id });
      }
    }
    for (const [p, v] of best) if (!v.inside) nearbyPoi.set(v.id, p);
  }
  const stadiumAreas = [];

  for (const el of osm.elements) {
    const t = el.tags || {};
    if (el.type === 'node') continue;
    if (el.type === 'way' && el.geometry) {
      const pts = toPts(el.geometry);
      if (t.highway) {
        const spec = ROAD_SPECS[t.highway];
        if (!spec || t.area === 'yes') {
          if (t.highway === 'pedestrian' && closedRing(pts)) areas.push({ kind: 'plaza', pts: closedRing(pts) });
          continue;
        }
        let [w, kind] = spec;
        const lanes = parseNum(t.lanes);
        const width = parseNum(t.width);
        if (width > 2) w = width;
        else if (lanes > 0 && kind !== 'pedestrian') w = Math.max(w, lanes * 3.2 + 1);
        let oneway = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout' || t.highway === 'motorway';
        let rpts = pts;
        if (t.oneway === '-1') {
          oneway = true;
          rpts = pts.slice().reverse();
        }
        if (extent && !rpts.some(inside)) continue;
        roads.push({ pts: rpts, w, name: t.name || '', kind, oneway });
        continue;
      }
      if (t.railway) {
        // keep only the runs inside the playable area (plus a margin)
        const m = 300;
        let run = [], hasInside = false;
        const flush = () => {
          if (hasInside && run.length > 1) rails.push({ pts: run });
          run = [];
          hasInside = false;
        };
        for (const p of pts) {
          if (p[0] >= R.minX - m && p[0] <= R.maxX + m && p[1] >= R.minZ - m && p[1] <= R.maxZ + m) {
            run.push(p);
            hasInside = true;
          } else {
            run.push(p); // close the run just outside the area
            flush();
            run = [p]; // and start the next one from here, in case the track comes back
          }
        }
        flush();
        continue;
      }
      if (t.natural === 'coastline') {
        coastline(pts, areas, barriers);
        continue;
      }
      const ring = closedRing(pts);
      if (!ring) continue;
      if (t.boundary === 'place' && t.name) {
        divisions.push({ name: t.name, pts: ring });
        continue;
      }
      if (t.building) {
        addBuilding(ring, t, el.id);
        continue;
      }
      const kind = areaKind(t);
      if (kind) addArea(kind, ring, t);
    } else if (el.type === 'relation' && el.members) {
      const outers = el.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => toPts(m.geometry));
      for (const ring of joinRings(outers)) {
        if (t.building) addBuilding(ring, t, el.id);
        else if (areaKind(t)) addArea(areaKind(t), ring, t);
      }
    }
  }

  function areaKind(t) {
    if (t.natural === 'water' || t.waterway === 'riverbank') return 'water';
    if (t.natural === 'beach' || t.natural === 'sand') return 'sand';
    if (t.leisure === 'pitch') return 'pitch';
    if (t.leisure || t.landuse === 'grass' || t.landuse === 'recreation_ground' || t.landuse === 'village_green' || t.landuse === 'meadow') return 'park';
    if (t.natural === 'wood' || t.landuse === 'forest') return 'wood';
    if (t.natural === 'wetland') return 'wetland';
    if (t.natural === 'scrub' || t.natural === 'heath' || t.natural === 'grassland') return 'scrub';
    if (['brownfield', 'greenfield', 'construction', 'landfill'].includes(t.landuse)) return 'waste';
    if (t.landuse === 'railway') return 'railway';
    if (t.place === 'square') return 'plaza';
    if (t.amenity === 'parking') return 'parking';
    return null;
  }

  function addArea(kind, ring, t) {
    const clipped = clipRect(ring, R.minX - 200, R.minZ - 200, R.maxX + 200, R.maxZ + 200);
    if (clipped.length < 3) return;
    if (kind === 'water' && Math.abs(polygonArea(ring)) > 4e6) {
      // big river: draw it to the horizon, collide only inside the playable area
      const far = clipRect(ring, R.minX - 6000, R.minZ - 6000, R.maxX + 6000, R.maxZ + 6000);
      areas.push({ kind, pts: far, noCollide: true });
      barriers.push({ pts: clipped });
      return;
    }
    const area = { kind, pts: clipped };
    if (t.name) area.name = t.name;
    if (t.leisure === 'stadium') stadiumAreas.push({ pts: clipped, name: t.name || '' });
    areas.push(area);
    if (t.name && (kind === 'park' || kind === 'plaza') && Math.abs(polygonArea(clipped)) > 1500) {
      const b = bbox(clipped);
      landmarks.push({ name: t.name, pos: [r1((b.minX + b.maxX) / 2), r1((b.minZ + b.maxZ) / 2)], kind: 'park' });
    }
  }

  function addBuilding(ring, t, id, piece = false) {
    const b = bbox(ring);
    if (!inside([(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2])) return;
    const area = Math.abs(polygonArea(ring));
    if (area < 6) return;
    // Satellite footprints often merge a whole row of attached houses into one
    // polygon: split those into ~8.66 m lots so every house gets its own height.
    const untagged = !t.height && !t['building:levels'] && !t.name && (!t.building || t.building === 'yes' || t.building === 'residential' || t.building === 'house');
    const poi = piece ? null : poiIn(ring, id);
    if (!piece && !poi && untagged && args.split !== false && area > 260) {
      const cdist = Math.hypot((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
      const parts = splitIntoLots(ring, mulberry32((id + 7) % 2147483647), cdist < 900);
      if (parts.length > 1) {
        parts.forEach((p, i) => addBuilding(p, t, (id * 31 + i + 1) % 2147483647, true));
        return;
      }
    }
    const brng = mulberry32(id % 2147483647);
    const dist = Math.hypot((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
    const { h, levels, industrial } = buildingHeight(t, area, brng, dist);
    const bld = { pts: ring, h: r1(h), levels, style: buildingStyle(t, levels, brng, industrial) };
    if (t.shop || ['retail', 'commercial', 'kiosk', 'supermarket'].includes(t.building)) bld.shop = true;
    if (poi) bld.poi = poi;
    const shape = t['roof:shape'];
    if ((shape === 'gabled' || shape === 'hipped') && ring.length === 4) bld.roof = 'gable';
    if (t.building === 'cathedral' || (t.building === 'church' && area > 400)) bld.roof = 'gable';
    const colour = t['building:colour'] || t['building:color'];
    if (colour && /^#?[0-9a-f]{6}$|^[a-z]+$/i.test(colour)) bld.color = colour.startsWith('#') || /^[a-z]+$/i.test(colour) ? colour : `#${colour}`;
    if (t.name) {
      bld.name = t.name;
      if (['church', 'cathedral', 'train_station', 'civic', 'public', 'government', 'stadium', 'hospital', 'university'].includes(t.building) || t.amenity || t.tourism) {
        landmarks.push({ name: t.name, pos: [r1((b.minX + b.maxX) / 2), r1((b.minZ + b.maxZ) / 2)] });
      }
    }
    buildings.push(bld);
  }

  function coastline(pts, areas, barriers) {
    // OSM convention: land on the left, water on the right of the way direction.
    const L = 4000, near = 45;
    const normals = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len, nz = (bx - ax) / len; // right side
      normals.push([nx, nz]);
      if (Math.max(ax, bx) < R.minX || Math.min(ax, bx) > R.maxX || Math.max(az, bz) < R.minZ || Math.min(az, bz) > R.maxZ) continue;
      areas.push({ kind: 'water', noCollide: true, pts: [[ax, az], [bx, bz], [r1(bx + nx * L), r1(bz + nz * L)], [r1(ax + nx * L), r1(az + nz * L)]] });
      barriers.push({ pts: [[ax, az], [bx, bz], [r1(bx + nx * near), r1(bz + nz * near)], [r1(ax + nx * near), r1(az + nz * near)]] });
    }
    for (let i = 1; i < pts.length - 1; i++) {
      if (!inside(pts[i])) continue;
      const [n0, n1] = [normals[i - 1], normals[i]];
      const [x, z] = pts[i];
      areas.push({ kind: 'water', noCollide: true, pts: [[x, z], [r1(x + n0[0] * L), r1(z + n0[1] * L)], [r1(x + n1[0] * L), r1(z + n1[1] * L)]] });
    }
  }

  // Mark buildings that contain / front a shop or bar POI as having a commercial ground floor.
  const bIndex = new SpatialHash(30);
  buildings.forEach((b) => bIndex.insert(b, bbox(b.pts)));
  for (const [x, z] of shopNodes) {
    const best = nearestBuilding(bIndex, x, z);
    if (best && best.h >= 3) best.shop = true;
  }

  // ------------------------------------------------------------ infill
  let infilled = 0;
  // Well-known places get their own shapes in the game.
  const sp = detectSpecials({ buildings, areas, rails, roads, pois, stadiumAreas });
  buildings.length = 0;
  buildings.push(...sp.buildings);
  const specials = sp.specials;
  console.log(`  lugares especiales: ${specials.length + buildings.filter((b) => b.special).length} (${sp.removed} edificios reemplazados)`);

  if (args.infill ?? !overture) infilled = infill(roads, buildings, areas, bIndex, rng, inside);

  // Villas, pasillos, descampados, rejas and street fronts.
  let extra = {};
  if (args.conurbano !== false) {
    const t0 = Date.now();
    const c = conurbano({ roads, buildings, areas, rails, specials, divisions, radius, inside: extent ? inside : null });
    roads.push(...c.pasillos);
    delete c.pasillos;
    extra = c;
    console.log(`  conurbano: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }

  // ------------------------------------------------------------ street corner signs
  const solidIndex = new SpatialHash(30);
  buildings.forEach((b) => solidIndex.insert(b.pts, bbox(b.pts)));
  for (const a of areas) if (a.kind === 'water' || a.kind === 'railway') solidIndex.insert(a.pts, bbox(a.pts));
  const signs = computeStreetSigns(roads.filter((r) => !r.pasillo && (inside(r.pts[0]) || inside(r.pts[r.pts.length - 1]))), addresses, {
    blocked: (x, z) => {
      if (!inside([x, z])) return true;
      for (const pts of solidIndex.query(x - 1, z - 1, x + 1, z + 1)) {
        if (pointInPolygon(x, z, pts)) return true;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (closestOnSegment(x, z, pts[j][0], pts[j][1], pts[i][0], pts[i][1])[3] < 0.36) return true;
      }
      return false;
    },
  });
  const ss = signs.stats;
  console.log(`  carteles de esquina: ${ss.posts} postes, ${ss.plates} chapas (${ss.withNum} con altura)`);
  console.log(`  direcciones: ${ss.addresses} (${ss.matched} ubicadas en su calle); cuadras: ${ss.blocks}, con altura real: ${ss.known}, estimada: ${ss.estimated}`);

  // ------------------------------------------------------------ spawn near the center
  let spawn = [0, 8], spawnHeading = 0, best = Infinity;
  for (const r of roads) {
    if (r.kind === 'service' || r.kind === 'footway') continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [a, b] = [r.pts[i], r.pts[i + 1]];
      const c = closestOnSegment(0, 0, a[0], a[1], b[0], b[1]);
      if (c[3] < best) {
        best = c[3];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
        const off = r.kind === 'pedestrian' ? 0 : r.w / 2 + 1.5;
        spawn = [r1(c[0] - dz * off), r1(c[1] + dx * off)];
        spawnHeading = Math.atan2(dx, dz);
      }
    }
  }

  const all = roads.flatMap((r) => r.pts).concat(buildings.flatMap((b) => b.pts));
  const bounds = bbox(all);
  const dedupLandmarks = [];
  // Keep the famous places first and only a few of each kind (there are dozens of churches and clinics).
  const priority = ['train_station', 'government_office', 'stadium_arena', 'brewery', 'museum', 'theatre_venue', 'shopping_mall', 'park', 'christian_place_of_worship', 'hospital'];
  const perKind = { christian_place_of_worship: 2, hospital: 2, park: 6, government_office: 2, shopping_mall: 2 };
  const famous = /catedral|municipalidad de quilmes|estaci[oó]n quilmes|plaza san mart|cervecer[ií]a y malter|centenario|iriarte|teatro municipal/i;
  const rank = (l) => (famous.test(l.name) ? -1 : priority.includes(l.kind) ? priority.indexOf(l.kind) : priority.length);
  landmarks.sort((a, b) => rank(a) - rank(b));
  const used = {};
  for (const l of landmarks) {
    if (!inside(l.pos) || dedupLandmarks.some((d) => d.name === l.name || Math.hypot(d.pos[0] - l.pos[0], d.pos[1] - l.pos[1]) < 60)) continue;
    if (!famous.test(l.name) && (used[l.kind] = (used[l.kind] || 0) + 1) > (perKind[l.kind] ?? 3)) continue;
    delete l.kind;
    dedupLandmarks.push(l);
  }
  return {
    data: {
      source: overture ? 'overture' : 'osm',
      attribution: overture
        ? '© OpenStreetMap contributors, Overture Maps Foundation, Google Open Buildings, Microsoft'
        : '© OpenStreetMap contributors (ODbL)',
      generated: new Date().toISOString(),
      origin: center,
      radius,
      ...(extent ? { extent } : {}),
      bounds,
      roads, buildings, areas, rails, barriers, specials,
      ...extra,
      landmarks: dedupLandmarks.slice(0, 30),
      streetSigns: signs.posts,
      spawn, spawnHeading,
    },
    infilled,
  };
}

// Blocks in OSM often miss many houses. Fill the street frontage with plausible
// lots (8.66 m wide, typical of the Buenos Aires suburbs) wherever nothing is mapped.
function infill(roads, buildings, areas, bIndex, rng, inside) {
  const roadIndex = new SpatialHash(40);
  for (const r of roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      roadIndex.insert({ a, b, w: r.w }, { minX: Math.min(a[0], b[0]) - 20, minZ: Math.min(a[1], b[1]) - 20, maxX: Math.max(a[0], b[0]) + 20, maxZ: Math.max(a[1], b[1]) + 20 });
    }
  }
  const areaIndex = new SpatialHash(60);
  for (const a of areas) if (!a.noCollide && a.kind !== 'parking') areaIndex.insert(a, bbox(a.pts));
  const endpointCount = new Map();
  const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;
  for (const r of roads) for (const p of r.pts) endpointCount.set(key(p), (endpointCount.get(key(p)) || 0) + 1);

  const blocked = (pts) => {
    const b = bbox(pts);
    for (const o of bIndex.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
      for (const [x, z] of pts) if (pointInPolygon(x, z, o.pts)) return true;
      for (const [x, z] of o.pts) if (pointInPolygon(x, z, pts)) return true;
    }
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    for (const a of areaIndex.query(b.minX, b.minZ, b.maxX, b.maxZ)) if (pointInPolygon(cx, cz, a.pts)) return true;
    for (const s of roadIndex.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
      for (const [x, z] of [...pts, [cx, cz]]) {
        if (Math.sqrt(closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3]) < s.w / 2 + 2.5) return true;
      }
    }
    return false;
  };

  let count = 0;
  for (const r of roads) {
    if (!['residential', 'secondary', 'primary'].includes(r.kind)) continue;
    const main = r.kind !== 'residential';
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 25 || !inside(a) || !inside(b)) continue;
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
      const trimA = (endpointCount.get(key(a)) || 0) > 1 ? 9 : 2;
      const trimB = (endpointCount.get(key(b)) || 0) > 1 ? 9 : 2;
      for (const side of [-1, 1]) {
        const nx = -dz * side, nz = dx * side;
        let s = trimA;
        while (s < len - trimB - 6) {
          const width = Math.min(len - trimB - s, 8 + rng() * 3.5);
          const depth = 14 + rng() * 12;
          const o1 = r.w / 2 + 3, o2 = o1 + depth;
          const p = (t, o) => [r1(a[0] + dx * t + nx * o), r1(a[1] + dz * t + nz * o)];
          const pts = [p(s, o1), p(s + width, o1), p(s + width, o2), p(s, o2)];
          s += width;
          if (rng() < 0.05 || blocked(pts)) continue;
          const tall = main ? rng() < 0.18 : rng() < 0.04;
          const levels = tall ? 4 + Math.floor(rng() * 6) : rng() < 0.55 ? 1 : rng() < 0.9 ? 2 : 3;
          const bld = { pts, h: r1(levels * 3 + 0.3 + rng() * 0.5), levels, style: tall ? (rng() < 0.6 ? 'apartments' : 'brick') : rng() < 0.7 ? 'house' : 'brick', gen: true };
          if (main && rng() < 0.55) bld.shop = true;
          if (!tall && rng() < 0.2) bld.roof = 'gable';
          buildings.push(bld);
          bIndex.insert(bld, bbox(pts));
          count++;
        }
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
const osm = args.input ? JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8')) : await download();
console.log(`Procesando ${osm.elements.length.toLocaleString('es-AR')} elementos de OSM…`);
const { data, infilled } = convert(osm);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(data));
const mapped = data.buildings.length - infilled;
console.log(`Listo: ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB)`);
console.log(`  calles: ${data.roads.length}, edificios: ${mapped}, lotes completados: ${infilled}, áreas: ${data.areas.length}, vías: ${data.rails.length}`);
console.log(`  Datos: ${data.attribution}`);

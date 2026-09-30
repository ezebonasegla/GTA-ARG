#!/usr/bin/env node
// Downloads real map data of Quilmes from OpenStreetMap (Overpass API) and converts
// it into the game's city format: public/data/quilmes.json
//
//   npm run fetch-osm                          # 2 km around Plaza San Martín (reaches the river)
//   npm run fetch-osm -- --radius 2500         # bigger area (heavier)
//   npm run fetch-osm -- --lat -34.72 --lon -58.25
//   npm run fetch-osm -- --input raw.json      # convert a saved Overpass response
//   npm run fetch-osm -- --no-infill           # don't fill blocks missing buildings
//
// Map data © OpenStreetMap contributors, available under the ODbL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUILMES_CENTER, makeProjection, mulberry32, polygonArea, pointInPolygon,
  closestOnSegment, bbox, SpatialHash,
} from '../src/world/geo.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const center = { lat: +(args.lat ?? QUILMES_CENTER.lat), lon: +(args.lon ?? QUILMES_CENTER.lon) };
const radius = +(args.radius ?? 2000);
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
  const dLat = radius / 110540;
  const dLon = radius / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const bb = [center.lat - dLat, center.lon - dLon, center.lat + dLat, center.lon + dLon].map((v) => v.toFixed(6)).join(',');
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

function buildingHeight(tags, area, rng) {
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
  else levels = area < 120 ? pick([[1, 0.6], [2, 0.4]]) : area < 400 ? pick([[1, 0.3], [2, 0.5], [3, 0.2]]) : pick([[2, 0.4], [3, 0.3], [4, 0.3]]);
  return { h: levels * 3 + 0.3 + rng() * 0.5, levels };
}

function buildingStyle(tags, levels, rng) {
  const b = tags.building;
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
  const roads = [], buildings = [], areas = [], rails = [], landmarks = [], barriers = [];
  const shopNodes = [];
  const lim = radius * 1.05;
  const inside = ([x, z]) => Math.abs(x) <= lim && Math.abs(z) <= lim;

  for (const el of osm.elements) {
    const t = el.tags || {};
    if (el.type === 'node') {
      const [x, z] = proj.toWorld(el.lat, el.lon);
      if (t.shop || t.amenity) shopNodes.push([x, z]);
      if (t.railway === 'station' && t.name) landmarks.push({ name: t.name, pos: [r1(x), r1(z)] });
      continue;
    }
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
        roads.push({ pts: rpts, w, name: t.name || '', kind, oneway });
        continue;
      }
      if (t.railway) {
        rails.push({ pts });
        continue;
      }
      if (t.natural === 'coastline') {
        coastline(pts, areas, barriers);
        continue;
      }
      const ring = closedRing(pts);
      if (!ring) continue;
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
    if (t.natural === 'wood' || t.natural === 'scrub' || t.landuse === 'forest') return 'park';
    if (t.landuse === 'railway') return 'railway';
    if (t.place === 'square') return 'plaza';
    if (t.amenity === 'parking') return 'parking';
    return null;
  }

  function addArea(kind, ring, t) {
    const clipped = clipRect(ring, -lim - 200, -lim - 200, lim + 200, lim + 200);
    if (clipped.length < 3) return;
    const area = { kind, pts: clipped };
    areas.push(area);
    if (t.name && (kind === 'park' || kind === 'plaza') && Math.abs(polygonArea(clipped)) > 1500) {
      const b = bbox(clipped);
      landmarks.push({ name: t.name, pos: [r1((b.minX + b.maxX) / 2), r1((b.minZ + b.maxZ) / 2)] });
    }
  }

  function addBuilding(ring, t, id) {
    const b = bbox(ring);
    if (!inside([(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2])) return;
    const area = Math.abs(polygonArea(ring));
    if (area < 6) return;
    const brng = mulberry32(id % 2147483647);
    const { h, levels } = buildingHeight(t, area, brng);
    const bld = { pts: ring, h: r1(h), levels, style: buildingStyle(t, levels, brng) };
    if (t.shop || ['retail', 'commercial', 'kiosk', 'supermarket'].includes(t.building)) bld.shop = true;
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
      if (Math.max(ax, bx) < -lim || Math.min(ax, bx) > lim || Math.max(az, bz) < -lim || Math.min(az, bz) > lim) continue;
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
    let best = null, bestD = 12;
    for (const b of bIndex.query(x - 12, z - 12, x + 12, z + 12)) {
      if (pointInPolygon(x, z, b.pts)) {
        best = b;
        break;
      }
      const p = b.pts;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const d = Math.sqrt(closestOnSegment(x, z, p[j][0], p[j][1], p[i][0], p[i][1])[3]);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
    }
    if (best && best.h >= 3) best.shop = true;
  }

  // ------------------------------------------------------------ infill
  let infilled = 0;
  if (args.infill !== false) infilled = infill(roads, buildings, areas, bIndex, rng, inside);

  // ------------------------------------------------------------ spawn near the center
  let spawn = [0, 8], spawnHeading = 0, best = Infinity;
  for (const r of roads) {
    if (r.kind === 'service') continue;
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
  for (const l of landmarks) if (!dedupLandmarks.some((d) => d.name === l.name)) dedupLandmarks.push(l);
  return {
    data: {
      source: 'osm',
      attribution: '© OpenStreetMap contributors (ODbL)',
      generated: new Date().toISOString(),
      origin: center,
      radius,
      bounds,
      roads, buildings, areas, rails, barriers,
      landmarks: dedupLandmarks.slice(0, 40),
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
console.log(`  calles: ${data.roads.length}, edificios de OSM: ${mapped}, lotes completados: ${infilled}, áreas: ${data.areas.length}, vías: ${data.rails.length}`);
console.log('  Datos del mapa © colaboradores de OpenStreetMap (ODbL).');

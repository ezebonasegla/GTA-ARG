// Detects well-known places in the imported map and describes them as "specials"
// that the game builds with their own shapes (cathedral, churches, stations,
// stadiums, the Quilmes brewery, civic buildings, plazas and football pitches).
import { SpatialHash, bbox, closestOnSegment, orientedBox, boxCorners, pointInPolygon, polygonArea } from '../src/world/geo.js';

const r1 = (v) => Math.round(v * 10) / 10;
const centroid = (pts) => {
  const b = bbox(pts);
  return [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
};
const roundBox = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));

function overlaps(pts, rect) {
  for (const [x, z] of pts) if (pointInPolygon(x, z, rect)) return true;
  for (const [x, z] of rect) if (pointInPolygon(x, z, pts)) return true;
  const [cx, cz] = centroid(pts);
  return pointInPolygon(cx, cz, rect);
}

// pois: [{ x, z, kind, name }] ; stadiumAreas: polygons tagged leisure=stadium
export function detectSpecials({ buildings, areas, rails, roads, pois, stadiumAreas }) {
  const specials = [];
  const remove = new Set();
  const bIndex = new SpatialHash(30);
  buildings.forEach((b) => bIndex.insert(b, bbox(b.pts)));
  const clear = (rect) => {
    const bb = bbox(rect);
    for (const b of bIndex.query(bb.minX, bb.minZ, bb.maxX, bb.maxZ)) if (!b.special && overlaps(b.pts, rect)) remove.add(b);
  };

  // --- buildings that contain a known place ------------------------------------
  for (const b of buildings) {
    const poi = b.poi;
    delete b.poi;
    if (!poi) continue;
    const area = Math.abs(polygonArea(b.pts));
    const o = roundBox(orientedBox(b.pts));
    const cathedral = /catedral/i.test(poi.name || '');
    // big warehouses used as churches keep their normal shape
    if ((poi.kind === 'church' || poi.kind === 'christian_place_of_worship') && area >= 200 && (cathedral || (area <= 1600 && o.hv <= 16))) {
      b.special = { type: cathedral ? 'cathedral' : 'church', name: poi.name || '', box: o };
      b.h = Math.max(b.h, cathedral ? 17 : 10);
    } else if (['government_office', 'theatre_venue', 'museum'].includes(poi.kind) && area >= 150) {
      b.special = { type: 'civic', name: poi.name, box: o, flag: /municipalidad/i.test(poi.name) };
      b.h = Math.max(b.h, /municipalidad/i.test(poi.name) ? 14 : 10);
      b.style = 'civic';
    } else if (poi.kind === 'hospital' && area >= 150) {
      b.special = { type: 'hospital', name: poi.name, box: o };
      b.style = 'hospital';
      b.h = Math.max(b.h, 12);
    }
    if (b.special) delete b.shop;
  }

  // --- cathedral: satellite data often only catches a fragment of it. Rebuild a
  // full nave footprint (~24 x 58 m) facing the nearest street.
  for (const p of pois.filter((p) => /catedral/i.test(p.name))) {
    const has = buildings.find((b) => b.special?.type === 'cathedral' && Math.abs(polygonArea(b.pts)) > 800);
    if (has) continue;
    let best = null;
    for (const r of roads) {
      if (r.kind === 'service' || r.kind === 'footway') continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [a, b] = [r.pts[i], r.pts[i + 1]];
        const c = closestOnSegment(p.x, p.z, a[0], a[1], b[0], b[1]);
        if (!best || c[3] < best.d) best = { d: c[3], x: c[0], z: c[1], a, b, w: r.w };
      }
    }
    if (!best) continue;
    const l = Math.hypot(best.b[0] - best.a[0], best.b[1] - best.a[1]);
    const ux = (best.b[0] - best.a[0]) / l, uz = (best.b[1] - best.a[1]) / l;
    let vx = -uz, vz = ux; // from the street into the block
    if ((p.x - best.x) * vx + (p.z - best.z) * vz < 0) {
      vx = -vx;
      vz = -vz;
    }
    const front = best.w / 2 + 3.5, depth = 58, half = 12;
    const at = (a, b) => [r1(best.x + ux * a + vx * b), r1(best.z + uz * a + vz * b)];
    const pts = [at(-half, front), at(half, front), at(half, front + depth), at(-half, front + depth)];
    if (polygonArea(pts) < 0) pts.reverse();
    for (const b of buildings) if (b.special?.type === 'cathedral') delete b.special;
    clear(pts);
    const b = { pts, h: 17, levels: 1, style: 'church', special: { type: 'cathedral', name: p.name, box: roundBox(orientedBox(pts)) } };
    buildings.push(b);
    bIndex.insert(b, bbox(pts));
  }

  // --- Cervecería Quilmes: brick industrial complex, silos, chimney and sign ---------
  for (const p of pois.filter((p) => p.kind === 'brewery' && /quilmes/i.test(p.name) && /malter/i.test(p.name))) {
    let biggest = null, bigArea = 0;
    for (const b of bIndex.query(p.x - 260, p.z - 260, p.x + 260, p.z + 260)) {
      const [cx, cz] = centroid(b.pts);
      const area = Math.abs(polygonArea(b.pts));
      if (Math.hypot(cx - p.x, cz - p.z) > 260 || area < 350) continue;
      b.style = 'brewery';
      b.h = Math.max(b.h, 10 + (area > 2000 ? 6 : 0));
      delete b.shop;
      if (area > bigArea) {
        bigArea = area;
        biggest = b;
      }
    }
    if (biggest) specials.push({ type: 'brewery', name: p.name, box: roundBox(orientedBox(biggest.pts)), h: biggest.h });
  }

  // --- train stations: platforms with canopies along the tracks -----------------
  const railSegs = [];
  for (const r of rails) for (let i = 0; i < r.pts.length - 1; i++) railSegs.push([r.pts[i], r.pts[i + 1]]);
  for (const p of pois.filter((p) => p.kind === 'train_station')) {
    let best = null;
    for (const [a, b] of railSegs) {
      const c = closestOnSegment(p.x, p.z, a[0], a[1], b[0], b[1]);
      if (c[3] < 90 * 90 && (!best || c[3] < best.d)) best = { d: c[3], x: c[0], z: c[1], a, b };
    }
    if (!best) continue;
    const len = Math.hypot(best.b[0] - best.a[0], best.b[1] - best.a[1]);
    const ux = (best.b[0] - best.a[0]) / len, uz = (best.b[1] - best.a[1]) / len;
    const vx = -uz, vz = ux;
    // lateral extent of all parallel tracks near the station
    let lo = 0, hi = 0;
    for (const [a, b] of railSegs) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (Math.abs(((b[0] - a[0]) * ux + (b[1] - a[1]) * uz) / l) < 0.9) continue;
      const c = closestOnSegment(best.x, best.z, a[0], a[1], b[0], b[1]);
      if (c[3] > 30 * 30) continue;
      const off = (c[0] - best.x) * vx + (c[1] - best.z) * vz;
      lo = Math.min(lo, off);
      hi = Math.max(hi, off);
    }
    const st = { type: 'station', name: p.name.replace(/\s*\[.*\]\s*/, ''), cx: r1(best.x), cz: r1(best.z), ux: +ux.toFixed(4), uz: +uz.toFixed(4), lo: r1(lo), hi: r1(hi), length: 180 };
    // the station house goes on the side of the POI
    st.houseSide = (p.x - best.x) * vx + (p.z - best.z) * vz >= 0 ? 1 : -1;
    specials.push(st);
    const rect = (v0, v1, half) => [[-half, v0], [half, v0], [half, v1], [-half, v1]].map(([a, b]) => [best.x + ux * a + vx * b, best.z + uz * a + vz * b]);
    clear(rect(lo - 12, lo - 1, st.length / 2 + 5));
    clear(rect(hi + 1, hi + 12, st.length / 2 + 5));
    clear(st.houseSide > 0 ? rect(hi + 10, hi + 26, 25) : rect(lo - 26, lo - 10, 25));
  }

  // --- stadiums: big pitches with a stadium nearby or inside a stadium area -------
  const stadiumPois = pois.filter((p) => p.kind === 'stadium_arena');
  for (const a of areas.filter((a) => a.kind === 'pitch')) {
    const area = Math.abs(polygonArea(a.pts));
    if (area < 3500) continue;
    const [cx, cz] = centroid(a.pts);
    let poi = null;
    for (const p of stadiumPois) {
      const d = Math.hypot(p.x - cx, p.z - cz);
      if (d < 170 && (!poi || d < Math.hypot(poi.x - cx, poi.z - cz))) poi = p;
    }
    const ground = stadiumAreas.find((s) => pointInPolygon(cx, cz, s.pts));
    if (!poi && !ground) continue;
    a.stadium = true;
    const box = roundBox(orientedBox(a.pts));
    // stands must fit inside the stadium ground when it is mapped
    let depth;
    if (ground) {
      const g = orientedBox(ground.pts);
      const room = Math.min(g.hu - box.hu, g.hv - box.hv) - 4;
      depth = Math.max(6, Math.min(area > 6500 ? 24 : 12, room));
    }
    addStadium(box, ground?.name || poi?.name || '', area, depth);
  }

  // Stadium grounds with no pitch mapped inside (e.g. Argentino de Quilmes):
  // put a pitch in the middle of the ground and the stands around it.
  const stadiumSpecials = specials.filter((s) => s.type === 'stadium');
  for (const g of stadiumAreas) {
    const area = Math.abs(polygonArea(g.pts));
    if (area < 5000) continue;
    const o = orientedBox(g.pts);
    if (stadiumSpecials.some((s) => pointInPolygon(s.box.cx, s.box.cz, g.pts))) continue;
    let name = g.name;
    if (!name) {
      const p = stadiumPois.find((p) => pointInPolygon(p.x, p.z, g.pts));
      name = p?.name || '';
    }
    const depth = area > 12000 ? 14 : 10;
    const pitch = { ...o, hu: Math.min(55, o.hu - depth - 5), hv: Math.min(36, o.hv - depth - 5) };
    if (pitch.hu < 20 || pitch.hv < 12) continue;
    const box = roundBox(pitch);
    const pts = boxCorners(box).map(([x, z]) => [r1(x), r1(z)]);
    areas.push({ kind: 'pitch', pts, stadium: true });
    addStadium(box, name, pitch.hu * pitch.hv * 4, depth);
    specials.push({ type: 'pitch', box });
  }

  function addStadium(box, name, pitchArea, depth) {
    let colors = ['#d9d9d9', '#8c8c8c'];
    if (/centenario|quilmes atl/i.test(name)) colors = ['#ffffff', '#1b3a8c'];
    else if (/argentino/i.test(name)) colors = ['#75aadb', '#ffffff'];
    const hockey = /hockey/i.test(name);
    const big = pitchArea > 6500;
    const st = { type: 'stadium', name, box, colors, depth: depth ?? (big ? 24 : 12), height: big ? 14 : 6, turf: hockey ? '#2a64b8' : null };
    if (depth) st.height = Math.max(6, Math.min(14, depth * 0.7));
    specials.push(st);
    clear(boxCorners(box, st.depth + 4, st.depth + 4));
  }

  // --- plazas: paths, benches and a monument ------------------------------------
  for (const a of areas) {
    if (a.kind !== 'park' && a.kind !== 'plaza') continue;
    if (!a.name) {
      // unnamed park polygon: take the name of a plaza/park place inside it
      const p = pois.find((p) => /park|plaza/.test(p.kind) && /^(plaza|parque general)/i.test(p.name) && pointInPolygon(p.x, p.z, a.pts));
      if (p) a.name = p.name;
    }
    if (!/^(plaza|parque general)/i.test(a.name || '')) continue;
    const area = Math.abs(polygonArea(a.pts));
    if (area < 1500 || area > 40000) continue;
    const box = roundBox(orientedBox(a.pts));
    const monument = /san mart/i.test(a.name) ? 'equestrian' : /bicentenario|belgrano|rivadavia/i.test(a.name) ? 'obelisk' : area > 6000 ? 'fountain' : 'bust';
    specials.push({ type: 'plaza', name: a.name, box, monument });
    clear(boxCorners(box, -2, -2));
  }

  // --- football pitches: goals ----------------------------------------------------
  for (const a of areas) {
    if (a.kind !== 'pitch') continue;
    const area = Math.abs(polygonArea(a.pts));
    if (area < 250) continue;
    const box = roundBox(orientedBox(a.pts));
    if (box.hu < 12 || box.hv < 7) continue;
    specials.push({ type: 'pitch', box });
  }

  return { specials, buildings: buildings.filter((b) => !remove.has(b)), removed: remove.size };
}

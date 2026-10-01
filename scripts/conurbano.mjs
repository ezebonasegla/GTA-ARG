// Conurbano details derived from the map data (used by fetch-osm.mjs):
// - villas / asentamientos: superblocks without inner streets that are packed with
//   small, irregular footprints; they get winding pasillos (walkable footways) and
//   are filled with self-built houses along them
// - descampados and baldíos: empty land that is not a park, road or building
// - what stands on the property line of every street: rejas, walls, portones,
//   hedges, alambrados in front of baldíos
// - which walls of each building face the street (the others are medianeras)
// - corner shops (almacén, kiosco)
import { SpatialHash, mulberry32, polygonArea, pointInPolygon, closestOnSegment, bbox } from '../src/world/geo.js';

const SIDEWALK = 3;
const C = 10; // analysis grid (m)
const r1 = (v) => Math.round(v * 10) / 10;
export const FENCE_TYPES = ['reja', 'muro', 'bajo', 'ligustro', 'alambre', 'porton'];
const F = Object.fromEntries(FENCE_TYPES.map((t, i) => [t, i]));

export function conurbano({ roads, buildings, areas, rails, specials = [], divisions = [], radius, inside = null, log = console.log }) {
  const rng = mulberry32(1917);
  const L = Math.ceil((radius * 1.05 + 40) / C) * C;
  const N = (2 * L) / C;
  const cellOf = (x, z) => [Math.floor((x + L) / C), Math.floor((z + L) / C)];
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
  const kOf = (x, z) => {
    const [i, j] = cellOf(x, z);
    return inGrid(i, j) ? j * N + i : -1;
  };
  const center = (k) => [-L + ((k % N) + 0.5) * C, -L + (Math.floor(k / N) + 0.5) * C];
  const vehicular = (r) => !['service', 'pedestrian', 'footway'].includes(r.kind);

  // ------------------------------------------------------------ road distance fields
  const rdV = new Float32Array(N * N).fill(99); // to the edge of the nearest street
  const rdA = new Float32Array(N * N).fill(99); // to the edge of any road or path
  const segV = new SpatialHash(40), segA = new SpatialHash(40);
  for (const r of roads) {
    const veh = vehicular(r);
    for (let s = 0; s < r.pts.length - 1; s++) {
      const a = r.pts[s], b = r.pts[s + 1];
      const seg = { a, b, w: r.w, road: r };
      const bb = { minX: Math.min(a[0], b[0]) - r.w, minZ: Math.min(a[1], b[1]) - r.w, maxX: Math.max(a[0], b[0]) + r.w, maxZ: Math.max(a[1], b[1]) + r.w };
      segA.insert(seg, bb);
      if (veh) segV.insert(seg, bb);
      const M = 60;
      const [i0, j0] = cellOf(bb.minX - M, bb.minZ - M), [i1, j1] = cellOf(bb.maxX + M, bb.maxZ + M);
      for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
        for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
          const k = j * N + i;
          const [x, z] = center(k);
          const d = Math.sqrt(closestOnSegment(x, z, a[0], a[1], b[0], b[1])[3]) - r.w / 2;
          if (d < rdA[k]) rdA[k] = d;
          if (veh && d < rdV[k]) rdV[k] = d;
        }
      }
    }
  }
  const nearestSeg = (hash, x, z, R) => {
    let best = null, bd = R;
    for (const s of hash.query(x - R, z - R, x + R, z + R)) {
      const c = closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1]);
      const d = Math.sqrt(c[3]) - s.w / 2;
      if (d < bd) {
        bd = d;
        best = { s, d, cx: c[0], cz: c[1] };
      }
    }
    return best;
  };
  const clearOfRoads = (x, z, extra) => {
    for (const s of segA.query(x - 30, z - 30, x + 30, z + 30)) {
      const side = vehicular(s.road) ? SIDEWALK + extra : 0.4;
      if (Math.sqrt(closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3]) < s.w / 2 + side) return false;
    }
    return true;
  };

  // ------------------------------------------------------------ masks
  const mask = new Uint8Array(N * N); // 1 park/water/plaza/... 2 rails, 3 scrub/brownfield (counts as empty land)
  const raster = (pts, fn) => {
    const b = bbox(pts);
    const [i0, j0] = cellOf(b.minX, b.minZ), [i1, j1] = cellOf(b.maxX, b.maxZ);
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const k = j * N + i;
        const [x, z] = center(k);
        if (pointInPolygon(x, z, pts)) fn(k);
      }
    }
  };
  for (const a of areas) {
    const empty = a.kind === 'scrub' || a.kind === 'waste';
    raster(a.pts, (k) => (mask[k] = empty ? (mask[k] === 1 ? 1 : 3) : 1));
  }
  // plazas, stadiums, stations and pitches modelled in landmarks.js
  for (const sp of specials) {
    const o = sp.box;
    if (!o) continue;
    const du = o.hu + 5, dv = o.hv + 5;
    const pts = [[-du, -dv], [du, -dv], [du, dv], [-du, dv]].map(([u, v]) => [o.cx + o.ux * u + o.vx * v, o.cz + o.uz * u + o.vz * v]);
    raster(pts, (k) => (mask[k] = 1));
  }
  for (const r of rails) {
    for (let s = 0; s < r.pts.length - 1; s++) {
      const a = r.pts[s], b = r.pts[s + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= len; t += C / 2) {
        const k = kOf(a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len);
        if (k >= 0 && mask[k] !== 1) mask[k] = 2;
      }
    }
  }
  const occ = new Uint8Array(N * N);
  const bIndex = new SpatialHash(20);
  const cellBuildings = new Map();
  for (const b of buildings) {
    b._bb = bbox(b.pts);
    b._area = Math.abs(polygonArea(b.pts));
    bIndex.insert(b, b._bb);
    raster(b.pts, (k) => (occ[k] = 1));
    const cx = (b._bb.minX + b._bb.maxX) / 2, cz = (b._bb.minZ + b._bb.maxZ) / 2;
    const k = kOf(cx, cz);
    if (k < 0) continue;
    occ[k] = 1;
    if (!cellBuildings.has(k)) cellBuildings.set(k, []);
    cellBuildings.get(k).push(b);
  }
  const insideBuilding = (x, z) => {
    for (const b of bIndex.query(x, z, x, z)) if (pointInPolygon(x, z, b.pts)) return b;
    return null;
  };

  const flood = (seedOk, conn8 = false) => {
    const comp = new Int32Array(N * N).fill(-1);
    const comps = [];
    const nb = conn8 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let s = 0; s < N * N; s++) {
      if (comp[s] >= 0 || !seedOk(s)) continue;
      const cells = [s];
      comp[s] = comps.length;
      for (let q = 0; q < cells.length; q++) {
        const c = cells[q], i = c % N, j = (c - i) / N;
        for (const [di, dj] of nb) {
          const ii = i + di, jj = j + dj;
          if (!inGrid(ii, jj)) continue;
          const n = jj * N + ii;
          if (comp[n] >= 0 || !seedOk(n)) continue;
          comp[n] = comps.length;
          cells.push(n);
        }
      }
      comps.push(cells);
    }
    return { comp, comps };
  };

  // ------------------------------------------------------------ villas
  // Superblocks: land far from every street. Formal blocks (~100-130 m) leave only
  // a small core; villas are big superblocks with small, misaligned houses.
  const sb = flood((k) => rdV[k] >= 28 && mask[k] !== 1 && mask[k] !== 2);
  const stats = sb.comps.map((cells) => {
    const bl = cells.flatMap((k) => cellBuildings.get(k) || []);
    const ha = (cells.length * C * C) / 1e4;
    let mis = 0, sumA = 0, bigA = 0;
    for (const b of bl) {
      sumA += b._area;
      if (b._area > 500) bigA += b._area;
      const cx = (b._bb.minX + b._bb.maxX) / 2, cz = (b._bb.minZ + b._bb.maxZ) / 2;
      const ns = nearestSeg(segV, cx, cz, 120);
      if (!ns) continue;
      const ra = Math.atan2(ns.s.b[1] - ns.s.a[1], ns.s.b[0] - ns.s.a[0]);
      let diff = Math.abs((((longAxis(b.pts) - ra) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
      diff = Math.min(diff, Math.PI / 2 - diff);
      if (diff > 0.2) mis++;
    }
    const n = bl.length || 1;
    return { cells, ha, n: bl.length, dens: bl.length / ha, meanA: sumA / n, mis: mis / n, big: bigA / (ha * 1e4), special: bl.some((b) => b.special || b.poi) };
  });
  if (process.env.DEBUG_VILLAS) {
    for (const s of stats.filter((s) => s.ha >= 0.8 && s.n >= 8).sort((a, b) => b.dens * b.mis - a.dens * a.mis).slice(0, 25)) {
      log(`    manzana @${center(s.cells[0]).map(Math.round)} ha=${s.ha.toFixed(1)} n=${s.n} dens=${s.dens.toFixed(0)} A=${s.meanA.toFixed(0)} mis=${s.mis.toFixed(2)} big=${s.big.toFixed(2)}${s.special ? ' special' : ''}`);
    }
  }
  const isSeed = (s) => s.ha >= 1 && s.dens >= 10 && s.meanA < 140 && s.mis >= 0.4 && s.big < 0.1 && !s.special;
  const canGrow = (s) => s.ha >= 0.3 && s.n >= 5 && s.dens >= 5 && s.meanA < 160 && s.mis >= 0.4 && s.big < 0.1 && !s.special;
  const villaOfComp = new Int32Array(stats.length).fill(-1);
  const villaSeeds = [];
  stats.forEach((s, c) => {
    if (isSeed(s)) {
      villaOfComp[c] = villaSeeds.length;
      villaSeeds.push([c]);
    }
  });
  // grow into neighbouring superblocks (within 40 m) that look alike
  for (let v = 0; v < villaSeeds.length; v++) {
    for (let q = 0; q < villaSeeds[v].length; q++) {
      for (const k of stats[villaSeeds[v][q]].cells) {
        const i = k % N, j = (k - i) / N;
        for (let dj = -4; dj <= 4; dj++) {
          for (let di = -4; di <= 4; di++) {
            if (!inGrid(i + di, j + dj)) continue;
            const c = sb.comp[(j + dj) * N + i + di];
            if (c < 0 || villaOfComp[c] >= 0 || !canGrow(stats[c])) continue;
            villaOfComp[c] = v;
            villaSeeds[v].push(c);
          }
        }
      }
    }
  }
  // zone = superblock cores dilated towards the surrounding streets
  const zone = new Int16Array(N * N).fill(-1);
  const bigBuilding = (k) => (cellBuildings.get(k) || []).some((b) => b._area > 400 || b.special || b.poi);
  villaSeeds.forEach((comps, v) => {
    let front = comps.flatMap((c) => stats[c].cells);
    for (const k of front) zone[k] = v;
    for (let step = 0; step < 3; step++) {
      const next = [];
      for (const k of front) {
        const i = k % N, j = (k - i) / N;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!inGrid(i + di, j + dj)) continue;
          const n = (j + dj) * N + i + di;
          if (zone[n] >= 0 || rdV[n] < 1.5 || mask[n] === 1 || mask[n] === 2 || bigBuilding(n)) continue;
          zone[n] = v;
          next.push(n);
        }
      }
      front = next;
    }
  });
  const inZone = (x, z, v) => {
    const k = kOf(x, z);
    return k >= 0 && zone[k] === v;
  };

  const villas = villaSeeds.map((comps, v) => {
    const cells = [];
    for (let k = 0; k < N * N; k++) if (zone[k] === v) cells.push(k);
    let sx = 0, sz = 0;
    for (const k of cells) {
      const [x, z] = center(k);
      sx += x;
      sz += z;
    }
    const cx = sx / cells.length, cz = sz / cells.length;
    return { v, cells, center: [r1(cx), r1(cz)], name: placeName(divisions, cx, cz) };
  });

  // Service roads inside a villa are dirt streets.
  for (const r of roads) {
    if (r.kind !== 'service') continue;
    const m = r.pts[Math.floor(r.pts.length / 2)];
    const k = kOf(m[0], m[1]);
    if (k >= 0 && zone[k] >= 0) r.dirt = true;
  }

  // Existing footprints inside a villa become self-built houses.
  let restyled = 0;
  for (const b of buildings) {
    const cx = (b._bb.minX + b._bb.maxX) / 2, cz = (b._bb.minZ + b._bb.maxZ) / 2;
    const k = kOf(cx, cz);
    if (k < 0 || zone[k] < 0 || b._area > 400 || b.special || b.poi) continue;
    b.villa = true;
    b._zone = zone[k];
    b.style = 'villa';
    b.shop = false;
    b.roof = undefined;
    if (b.levels > 3 || b.h > 9.5) {
      b.levels = 3;
      b.h = 8.4;
    }
    restyled++;
  }

  // Pasillos: winding footways that start at the surrounding streets.
  const pasillos = [];
  const pIndex = new SpatialHash(12);
  const addPasSeg = (a, b, w, id) => pIndex.insert({ a, b, w, id }, { minX: Math.min(a[0], b[0]) - w, minZ: Math.min(a[1], b[1]) - w, maxX: Math.max(a[0], b[0]) + w, maxZ: Math.max(a[1], b[1]) + w });
  const nearPas = (x, z, R, id) => {
    let best = null, bd = R * R;
    for (const s of pIndex.query(x - R, z - R, x + R, z + R)) {
      if (s.id === id) continue;
      const c = closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1]);
      if (c[3] < bd) {
        bd = c[3];
        best = [r1(c[0]), r1(c[1])];
      }
    }
    return best;
  };
  // strict: any building; otherwise small villa houses may give way to the pasillo
  const houseAt = (x, z, strict = true) => {
    for (const b of bIndex.query(x - 0.1, z - 0.1, x + 0.1, z + 0.1)) if ((strict || !b.villa || b._area > 90) && pointInPolygon(x, z, b.pts)) return true;
    return false;
  };
  villas.forEach((vl) => {
    const v = vl.v;
    const vr = mulberry32(4000 + v);
    // entries: zone cells that touch a street
    const entries = [];
    for (const k of vl.cells) {
      if (rdV[k] > 8) continue;
      const [x, z] = center(k);
      const ns = nearestSeg(segV, x, z, 20);
      if (!ns) continue;
      const dx = x - ns.cx, dz = z - ns.cz, dl = Math.hypot(dx, dz) || 1;
      const ex = ns.cx + (dx / dl) * (ns.s.w / 2), ez = ns.cz + (dz / dl) * (ns.s.w / 2);
      if (entries.some((e) => Math.hypot(e.x - ex, e.z - ez) < 26 + vr() * 14)) continue;
      entries.push({ x: ex, z: ez, ang: Math.atan2(dz, dx), w: vr() < 0.3 ? 2.4 + vr() * 0.8 : 1.3 + vr() * 0.7, gen: 0 });
    }
    if (!entries.length) entries.push({ x: vl.center[0], z: vl.center[1], ang: vr() * 6.28, w: 2, gen: 0 });
    const queue = entries.sort(() => vr() - 0.5);
    const maxPas = Math.max(6, Math.round(vl.cells.length / 7));
    let count = 0;
    while (queue.length && count < maxPas) {
      const st = queue.shift();
      const id = pasillos.length + 1;
      const pts = [[r1(st.x), r1(st.z)]];
      let x = st.x, z = st.z, ang = st.ang;
      const STEP = 3;
      const hw = st.w / 2 + 0.4;
      for (let step = 0; step < 70; step++) {
        let ok = false, nx = 0, nz = 0, na = ang;
        const wobble = (vr() - 0.5) * 0.45 + (vr() < 0.08 ? (vr() - 0.5) * 1.4 : 0);
        const tries = [wobble, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1];
        for (let t = 0; t < tries.length * 2 && !ok; t++) {
          const strict = t < tries.length && step % 4 !== 3;
          na = ang + tries[t % tries.length];
          const cx = Math.cos(na), cz = Math.sin(na);
          nx = x + cx * STEP;
          nz = z + cz * STEP;
          if (step > 1 && !inZone(nx, nz, v)) continue;
          const mx = (x + nx) / 2, mz = (z + nz) / 2;
          const hit = (px, pz) => houseAt(px, pz, strict);
          if (hit(nx, nz) || hit(nx - cz * hw, nz + cx * hw) || hit(nx + cz * hw, nz - cx * hw) || hit(mx, mz) || hit(mx - cz * hw, mz + cx * hw) || hit(mx + cz * hw, mz - cx * hw)) continue;
          ok = true;
        }
        if (!ok) break;
        const joined = step > 1 ? nearPas(nx, nz, st.w / 2 + 1.6, id) : null;
        pts.push([r1(nx), r1(nz)]);
        addPasSeg([x, z], [nx, nz], st.w, id);
        x = nx;
        z = nz;
        ang = na;
        if (joined) {
          pts.push(joined);
          break;
        }
        if (step > 3) {
          const ns = nearestSeg(segV, x, z, 4);
          if (ns) break; // reached another street
        }
        if (st.gen < 3 && step > 1 && vr() < 0.1) {
          const side = vr() < 0.5 ? 1 : -1;
          queue.push({ x, z, ang: ang + side * (Math.PI / 2 + (vr() - 0.5) * 0.5), w: Math.max(1.1, st.w * (0.7 + vr() * 0.25)), gen: st.gen + 1 });
        }
      }
      if (pts.length >= 3) {
        pasillos.push({ pts, w: r1(st.w), kind: 'footway', pasillo: true, villa: v, oneway: false, name: '' });
        count++;
      }
    }
  });

  // Existing footprints still in the way of a pasillo (joins, corners) give way.
  {
    const gone = new Set();
    for (const p of pasillos) {
      for (let s = 0; s < p.pts.length - 1; s++) {
        const a = p.pts[s], b = p.pts[s + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.05) continue;
        const nx = (-(b[1] - a[1]) / len) * (p.w / 2 + 0.4), nz = ((b[0] - a[0]) / len) * (p.w / 2 + 0.4);
        const corridor = [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
        const cb = bbox(corridor);
        for (const o of bIndex.query(cb.minX, cb.minZ, cb.maxX, cb.maxZ)) {
          if (o.villa && !gone.has(o) && polysOverlap(corridor, o.pts)) gone.add(o);
        }
      }
    }
    for (let i = buildings.length - 1; i >= 0; i--) if (gone.has(buildings[i])) buildings.splice(i, 1);
    for (const o of gone) o.pts = [];
    restyled -= gone.size;
  }

  // Self-built houses along the pasillos, the streets around and in every gap.
  const placed = new SpatialHash(16);
  for (const b of buildings) if (b.villa || zone[kOf((b._bb.minX + b._bb.maxX) / 2, (b._bb.minZ + b._bb.maxZ) / 2)] >= 0) placed.insert(b.pts, b._bb);
  // big neighbours too, so new houses do not overlap them
  for (const vl of villas) {
    for (const k of vl.cells) {
      const [x, z] = center(k);
      for (const b of bIndex.query(x - C, z - C, x + C, z + C)) if (!b._inPlaced) {
        b._inPlaced = true;
        placed.insert(b.pts, b._bb);
      }
    }
  }
  const newHouses = [];
  const tryHouse = (q, v, vr) => {
    for (const p of q) if (!inZone(p[0], p[1], v)) return false;
    const b = bbox(q);
    for (const o of placed.query(b.minX, b.minZ, b.maxX, b.maxZ)) if (polysOverlap(q, o)) return false;
    // keep pasillos, sidewalks and paths clear
    for (let e = 0; e < 4; e++) {
      const a = q[e], c = q[(e + 1) % 4];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      for (let t = 0; t <= len; t += 1) {
        const x = a[0] + ((c[0] - a[0]) * t) / len, z = a[1] + ((c[1] - a[1]) * t) / len;
        for (const s of pIndex.query(x - 3, z - 3, x + 3, z + 3)) {
          if (closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3] < (s.w / 2 + 0.05) ** 2) return false;
        }
        if (!clearOfRoads(x, z, 0.1)) return false;
      }
    }
    for (const s of pIndex.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
      if (pointInPolygon(s.a[0], s.a[1], q) || pointInPolygon(s.b[0], s.b[1], q) || pointInPolygon((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, q)) return false;
    }
    const pts = q.map(([x, z]) => [r1(x), r1(z)]);
    placed.insert(pts, bbox(pts));
    const area = Math.abs(polygonArea(pts));
    const r = vr();
    const levels = r < 0.52 ? 1 : r < 0.9 || area < 22 ? 2 : 3;
    newHouses.push({ pts, h: r1(levels * 2.6 + 0.2 + vr() * 0.3), levels, style: 'villa', villa: true, gen: true, _v: v });
    return true;
  };
  const quad = (x, z, ux, uz, w, d) => {
    const vx = -uz, vz = ux;
    return [[x, z], [x + ux * w, z + uz * w], [x + ux * w + vx * d, z + uz * w + vz * d], [x + vx * d, z + vz * d]];
  };
  villas.forEach((vl) => {
    const v = vl.v;
    const vr = mulberry32(7000 + v);
    // along pasillos, both sides
    for (const p of pasillos) {
      if (p.villa !== v) continue;
      for (let s = 0; s < p.pts.length - 1; s++) {
        const a = p.pts[s], b = p.pts[s + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.5) continue;
        for (const side of [1, -1]) {
          let t = vr() * 1.5;
          while (t < len) {
            const w = 3.2 + vr() * 3.3, d = 4 + vr() * 5;
            const jit = (vr() - 0.5) * 0.16;
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + jit;
            let ux = Math.cos(ang), uz = Math.sin(ang);
            const off = p.w / 2 + 0.1 + vr() * 0.35;
            const px = a[0] + ((b[0] - a[0]) * t) / len, pz = a[1] + ((b[1] - a[1]) * t) / len;
            const nx = -Math.sin(ang) * side, nz = Math.cos(ang) * side;
            let q = quad(px + nx * off, pz + nz * off, ux, uz, w, d * side);
            if (side < 0) q = q.reverse();
            tryHouse(q, v, vr);
            t += w + (vr() < 0.2 ? 0.4 + vr() * 1.2 : 0.05);
          }
        }
      }
    }
    // facing the streets around the villa
    for (const k of vl.cells) {
      if (rdV[k] > 10) continue;
      const [x, z] = center(k);
      const ns = nearestSeg(segV, x, z, 20);
      if (!ns) continue;
      const ra = Math.atan2(ns.s.b[1] - ns.s.a[1], ns.s.b[0] - ns.s.a[0]);
      const ux = Math.cos(ra), uz = Math.sin(ra);
      const dx = x - ns.cx, dz = z - ns.cz, dl = Math.hypot(dx, dz) || 1;
      const nx = dx / dl, nz = dz / dl;
      const off = ns.s.w / 2 + SIDEWALK + 0.15;
      for (let t = -5; t < 5; t += 3.5 + vr() * 2) {
        const w = 3.5 + vr() * 3, d = 6 + vr() * 5;
        const px = ns.cx + ux * t + nx * off, pz = ns.cz + uz * t + nz * off;
        const side = ux * nz - uz * nx > 0 ? 1 : -1;
        let q = quad(px, pz, ux, uz, w, d * side);
        if (side < 0) q = q.reverse();
        tryHouse(q, v, vr);
      }
    }
    // fill the remaining gaps
    for (let rep = 0; rep < 3; rep++) {
      for (const k of vl.cells) {
        for (let n = 0; n < 3; n++) {
          const [cx, cz] = center(k);
          const x = cx + (vr() - 0.5) * C, z = cz + (vr() - 0.5) * C;
          const near = nearPas(x, z, 14, -1);
          let ang = vr() * Math.PI;
          if (near) {
            const s = [...pIndex.query(near[0] - 1, near[1] - 1, near[0] + 1, near[1] + 1)][0];
            if (s) ang = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) + (vr() - 0.5) * 0.2;
          }
          const w = 3.5 + vr() * 3.5, d = 4 + vr() * 4;
          tryHouse(quad(x, z, Math.cos(ang), Math.sin(ang), w, d), v, vr);
        }
      }
    }
    // pack: new rooms and houses leaning on the walls of the existing ones
    for (let rep = 0; rep < 3; rep++) {
      const list = newHouses.filter((h) => h._v === v).concat(buildings.filter((b) => b.villa && b._zone === v));
      for (const h of list) {
        const p = h.pts;
        for (let e = 0; e < p.length; e++) {
          if (vr() < 0.35) continue;
          const a = p[e], b = p[(e + 1) % p.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 2.5) continue;
          const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
          const ccw = polygonArea(p) >= 0 ? 1 : -1;
          const ox = uz * ccw, oz = -ux * ccw; // outward
          const w0 = Math.min(len + 1.5, 3 + vr() * 3.5), d0 = 3.5 + vr() * 4;
          const t0 = (vr() - 0.3) * Math.max(0.5, len - w0 + 1);
          for (const [w, d, t] of [[w0, d0, t0], [len, d0 * 0.6, 0], [Math.min(len, 3), 2.6, vr() * (len - Math.min(len, 3))]]) {
            const x0 = a[0] + ux * t + ox * 0.03, z0 = a[1] + uz * t + oz * 0.03;
            const q = [[x0, z0], [x0 + ux * w, z0 + uz * w], [x0 + ux * w + ox * d, z0 + uz * w + oz * d], [x0 + ox * d, z0 + oz * d]];
            if (tryHouse(q, v, vr)) break;
          }
        }
      }
    }
  });
  buildings.push(...newHouses);
  for (const h of newHouses) {
    h._bb = bbox(h.pts);
    h._area = Math.abs(polygonArea(h.pts));
    bIndex.insert(h, h._bb);
  }
  villas.forEach((vl) => {
    vl.houses = buildings.filter((b) => b.villa && zone[kOf((b._bb.minX + b._bb.maxX) / 2, (b._bb.minZ + b._bb.maxZ) / 2)] === vl.v).length;
    vl.pasillos = pasillos.filter((p) => p.villa === vl.v).length;
  });

  // ------------------------------------------------------------ descampados / baldíos
  const nearOcc = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) {
    if (!occ[k]) continue;
    const i = k % N, j = (k - i) / N;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inGrid(i + di, j + dj)) nearOcc[(j + dj) * N + i + di] = 1;
  }
  const lim = radius * 1.05 - 10;
  const inMap = (k) => {
    const [x, z] = center(k);
    return inside ? inside([x, z]) : Math.abs(x) < lim && Math.abs(z) < lim;
  };
  const emptyCell = (k) => inMap(k) && zone[k] < 0 && (mask[k] === 0 || mask[k] === 3) && rdA[k] > 2 && (!nearOcc[k] || mask[k] === 3);
  const wf = flood(emptyCell);
  const wasteOf = new Int32Array(N * N).fill(-1);
  const wastes = [];
  for (const cells of wf.comps) {
    const forced = cells.some((k) => mask[k] === 3);
    const touches = cells.filter((k) => rdA[k] < 12).length;
    if (!forced && !(touches >= 2 && cells.length >= 3) && cells.length < 150) continue;
    const id = wastes.length;
    let sx = 0, sz = 0;
    for (const k of cells) {
      wasteOf[k] = id;
      const [x, z] = center(k);
      sx += x;
      sz += z;
    }
    const w = { cells, center: [r1(sx / cells.length), r1(sz / cells.length)], big: cells.length >= 150 };
    // potrero: a 30 x 18 m flat patch with two goals, aligned with the nearest street
    if (cells.length >= 30 && rng() < (w.big ? 0.7 : 0.45)) {
      for (let tries = 0; tries < 25 && !w.potrero; tries++) {
        const [x, z] = center(cells[Math.floor(rng() * cells.length)]);
        const ns = nearestSeg(segA, x, z, 200);
        const a = ns ? Math.atan2(ns.s.b[1] - ns.s.a[1], ns.s.b[0] - ns.s.a[0]) : 0;
        const ux = Math.cos(a), uz = Math.sin(a);
        let ok = true;
        for (const [u, t] of [[0, 0], [-15, -9], [15, -9], [15, 9], [-15, 9], [0, -9], [0, 9], [-15, 0], [15, 0], [-8, -5], [8, 5]]) {
          const k = kOf(x + ux * u - uz * t, z + uz * u + ux * t);
          if (k < 0 || wasteOf[k] !== id) ok = false;
        }
        if (ok) w.potrero = { c: [r1(x), r1(z)], a: Math.round(a * 1000) / 1000 };
      }
    }
    wastes.push(w);
  }

  // ------------------------------------------------------------ property line
  const fences = [];
  const nodeCount = new Map();
  const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;
  for (const r of roads) if (vehicular(r) || r.kind === 'service') for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) nodeCount.set(key(p), (nodeCount.get(key(p)) || 0) + 1);
  const junctions = [];
  for (const r of roads) {
    if (!vehicular(r)) continue;
    for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) if ((nodeCount.get(key(p)) || 0) >= 3) junctions.push(p);
  }
  const lineClear = (x, z, self) => {
    for (const s of segA.query(x - 30, z - 30, x + 30, z + 30)) {
      if (s === self) continue;
      const pad = vehicular(s.road) ? SIDEWALK + 0.6 : s.road.kind === 'service' ? 1.2 : 0.6;
      if (Math.sqrt(closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3]) < s.w / 2 + pad) return false;
    }
    return true;
  };
  for (const r of roads) {
    if (!vehicular(r) || r.kind === 'primary' && r.w > 20) continue;
    for (let s = 0; s < r.pts.length - 1; s++) {
      const a = r.pts[s], b = r.pts[s + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 8) continue;
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
      const self = [...segA.query(a[0], a[1], a[0], a[1])].find((q) => q.a === a && q.b === b);
      for (const side of [1, -1]) {
        const nx = -dz * side, nz = dx * side;
        const off = r.w / 2 + SIDEWALK + 0.15;
        let run = null;
        const flush = () => {
          if (run && run.t1 - run.t0 >= 2) emitRun(run);
          run = null;
        };
        const emitRun = ({ t0, t1, behind }) => {
          const hr = mulberry32((Math.round(a[0] * 7 + t0 * 13 + side * 101 + a[1] * 3) >>> 0) + 5);
          const P = (t) => [r1(a[0] + dx * t + nx * off), r1(a[1] + dz * t + nz * off)];
          let type;
          const rr = hr();
          if (behind === 'waste') type = rr < 0.55 ? F.alambre : rr < 0.93 ? F.muro : -1;
          else type = rr < 0.5 ? F.reja : rr < 0.66 ? F.muro : rr < 0.82 ? F.bajo : F.ligustro;
          if (type < 0) return;
          const L = t1 - t0;
          if ((type === F.reja || type === F.muro) && L >= 5 && hr() < 0.75) {
            const gw = Math.min(L - 1.2, 2.4 + hr() * 0.8);
            const g0 = t0 + 0.6 + hr() * (L - gw - 1.2);
            if (g0 - t0 > 0.5) fences.push(...P(t0), ...P(g0), type);
            fences.push(...P(g0), ...P(g0 + gw), F.porton);
            if (t1 - g0 - gw > 0.5) fences.push(...P(g0 + gw), ...P(t1), type);
          } else fences.push(...P(t0), ...P(t1), type);
        };
        for (let t = 1; t < len - 1; t += 1) {
          const x = a[0] + dx * t + nx * off, z = a[1] + dz * t + nz * off;
          const k = kOf(x, z);
          let open = k >= 0 && zone[k] < 0 && mask[k] !== 1 && mask[k] !== 2 && !nearPas(x, z, 2.5, -1);
          if (open) open = !insideBuilding(x + nx * 0.7, z + nz * 0.7) && !insideBuilding(x - nx * 0.3, z - nz * 0.3);
          if (open) open = lineClear(x, z, self) && !junctions.some((p) => Math.abs(p[0] - x) < 12 && Math.abs(p[1] - z) < 12 && Math.hypot(p[0] - x, p[1] - z) < 10);
          if (!open) {
            flush();
            continue;
          }
          const kb = kOf(x + nx * 6, z + nz * 6);
          const behind = kb >= 0 && wasteOf[kb] >= 0 ? 'waste' : 'house';
          if (run && (run.behind !== behind || run.t1 - run.t0 > 24)) flush();
          if (!run) run = { t0: t, t1: t, behind };
          run.t1 = t + 1;
        }
        flush();
      }
    }
  }

  // ------------------------------------------------------------ street-facing walls + corner shops
  let fronts = 0, corner = 0;
  const jIndex = new SpatialHash(30);
  for (const p of junctions) jIndex.insert(p, { minX: p[0], minZ: p[1], maxX: p[0], maxZ: p[1] });
  for (const b of buildings) {
    if (b.special || b.villa) continue;
    const pts = b.pts;
    const ccw = polygonArea(pts) >= 0;
    let fm = 0;
    const n = Math.min(pts.length, 30);
    for (let e = 0; e < n; e++) {
      const p0 = pts[e], p1 = pts[(e + 1) % pts.length];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len < 1.5) continue;
      // outward normal (the builder reverses clockwise rings the same way)
      let ox = (p1[1] - p0[1]) / len, oz = -(p1[0] - p0[0]) / len;
      if (!ccw) {
        ox = -ox;
        oz = -oz;
      }
      const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
      const ns = nearestSeg(segA, mx + ox * 2, mz + oz * 2, SIDEWALK + 12);
      if (!ns || ns.s.road.kind === 'footway') continue;
      const tx = ns.s.b[0] - ns.s.a[0], tz = ns.s.b[1] - ns.s.a[1], tl = Math.hypot(tx, tz) || 1;
      if (Math.abs((tx * oz - tz * ox) / tl) < 0.6) continue; // not parallel to the street
      const toX = ns.cx - mx, toZ = ns.cz - mz;
      if (toX * ox + toZ * oz < 0) continue; // street behind the wall
      fm |= 1 << e;
    }
    b.front = fm >>> 0;
    if (fm) fronts++;
    // corner almacén / kiosco
    if (!b.shop && fm && b.h < 8 && (b.style === 'house' || b.style === 'brick') && b._area < 300) {
      const cx = (b._bb.minX + b._bb.maxX) / 2, cz = (b._bb.minZ + b._bb.maxZ) / 2;
      const near = [...jIndex.query(cx - 16, cz - 16, cx + 16, cz + 16)].some((p) => Math.hypot(p[0] - cx, p[1] - cz) < 16);
      const hr = mulberry32(Math.round(Math.abs(cx * 31 + cz * 17)) + 3)();
      if (near && hr < 0.3) {
        b.shop = true;
        corner++;
      }
    }
  }
  for (const b of buildings) {
    delete b._bb;
    delete b._area;
    delete b._inPlaced;
    delete b._zone;
    delete b._v;
  }

  const rle = (cells) => {
    const s = cells.slice().sort((x, y) => x - y);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (out.length && out[out.length - 2] + out[out.length - 1] === s[i]) out[out.length - 1]++;
      else out.push(s[i], 1);
    }
    return out;
  };
  log(`  villas: ${villas.map((v) => `${v.name} (${v.houses} casas, ${v.pasillos} pasillos)`).join(', ') || 'ninguna'}`);
  log(`  casas de villa: ${restyled} existentes + ${newHouses.length} nuevas; descampados: ${wastes.length} (${wastes.filter((w) => w.big).length} grandes, ${wastes.filter((w) => w.potrero).length} potreros)`);
  log(`  frentes: ${fences.length / 5} tramos de reja/muro/alambrado, ${fronts} edificios con frente a la calle, ${corner} almacenes de esquina`);
  return {
    pasillos,
    grid: { x0: -L, z0: -L, cell: C, n: N },
    villas: villas.map((v) => ({ name: v.name, center: v.center, cells: rle(v.cells), houses: v.houses })),
    wastes: wastes.map((w) => ({ center: w.center, big: w.big, cells: rle(w.cells), ...(w.potrero ? { potrero: w.potrero } : {}) })),
    fences,
    fenceTypes: FENCE_TYPES,
  };
}

// Angle of the longest edge.
function longAxis(pts) {
  let best = 0, ang = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) {
      best = l;
      ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  return ang;
}

function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function polysOverlap(p, q) {
  for (const v of p) if (pointInPolygon(v[0], v[1], q)) return true;
  for (const v of q) if (pointInPolygon(v[0], v[1], p)) return true;
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      if (segsCross(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
    }
  }
  return false;
}

// Name of the neighbourhood (Overture divisions) that contains a point, or the nearest one.
function placeName(divisions, x, z) {
  const inside = divisions.filter((d) => pointInPolygon(x, z, d.pts)).sort((a, b) => Math.abs(polygonArea(a.pts)) - Math.abs(polygonArea(b.pts)));
  if (inside.length) return inside[0].name;
  let best = null, bd = 1200;
  for (const d of divisions) {
    const b = bbox(d.pts);
    const dd = Math.hypot((b.minX + b.maxX) / 2 - x, (b.minZ + b.maxZ) / 2 - z);
    if (dd < bd) {
      bd = dd;
      best = d.name;
    }
  }
  return best || 'Asentamiento';
}

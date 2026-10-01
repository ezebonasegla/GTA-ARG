// Closed corridors: the autopista and the railway can only be crossed where the real
// city lets you (OSM data from scripts/fetch-crossings.mjs). The autopista is fenced
// off and reached by its ramps; the tracks have fences on both sides with level
// crossings (barreras that drop when a train comes); streets on a bridge go over and
// pasos bajo nivel dip under in a trench. Every other street ends at the fence.
import * as THREE from 'three';
import { SpatialHash, closestOnSegment, bbox } from './geo.js';
import { GeoBuf } from './geobuf.js';
import { ATLAS } from './conurbanoTextures.js';
import { railing } from './buildings.js';

const H_UP = 6.2, H_DOWN = -5.6; // bridge deck / trench floor at the obstacle
const RAMP = 42; // meters of ramp on each side
const MW_W = 11.5; // carriageway: three 3.5 m lanes and the shoulders
const RAIL_HALF = 3.6, MW_HALF = MW_W / 2 + 2.2;
// solids that only exist at street level (an elevated or sunken vehicle passes them)
export const GROUND_ONLY = new Set(['barrier', 'railfence', 'deckwall', 'tree', 'pole', 'prop', 'building', 'platform']);

function intersect(a, b, c, d) {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1];
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t >= 0 && t < 1 && u >= 0 && u <= 1 ? t : null; // a crossing is often a shared vertex
}
const polyDist = (x, z, pts) => {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, closestOnSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])[3]);
  return Math.sqrt(best);
};
// sub-polyline of pts between distances sa and sb along it
function slice(pts, cum, sa, sb) {
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };
  const out = [at(sa)];
  for (let i = 0; i < pts.length; i++) if (cum[i] > sa && cum[i] < sb) out.push(pts[i]);
  out.push(at(sb));
  return out;
}

// Runs before the road graph: cuts the streets that can't cross, tidies the autopista
// and returns the decks (bridges and trenches) and level crossings.
export function planCorridors(data) {
  const out = { decks: [], levels: [], obstacles: [] };
  if (!data.decks) return out;
  const mws = data.roads.filter((r) => r.motorway);
  const ramps = data.roads.filter((r) => r.ramp);
  // the first import had the interchange connectors as 24 m "primary" roads: the real
  // ramps replace them
  data.roads = data.roads.filter((r) => !(r.kind === 'primary' && r.w >= 24 && r.oneway && !r.motorway &&
    r.pts.filter(([x, z]) => ramps.some((p) => polyDist(x, z, p.pts) < 5)).length >= r.pts.length * 0.6));
  for (const r of mws) r.w = MW_W;

  const obs = new SpatialHash(60);
  const addOb = (pts, type, half) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const s = { a: pts[i], b: pts[i + 1], type, half };
      obs.insert(s, bbox([pts[i], pts[i + 1]]));
      out.obstacles.push(s);
    }
  };
  for (const r of data.rails || []) addOb(r.pts, 'rail', RAIL_HALF);
  for (const r of mws) addOb(r.pts, 'mw', MW_HALF);

  const deckNear = (x, z, ux, uz, own) => data.decks.find((d) => {
    if (own ? d.rail || d.highway === 'motorway' : !(d.rail || d.highway === 'motorway')) return false;
    if (polyDist(x, z, d.pts) > (own ? 8 : 30)) return false;
    if (!own) return true;
    const [a, b] = [d.pts[0], d.pts[d.pts.length - 1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return Math.abs(((b[0] - a[0]) * ux + (b[1] - a[1]) * uz) / l) > 0.6;
  });
  const levelNear = (x, z) => data.levelCrossings.some((c) => Math.hypot(c.x - x, c.z - z) < 16);

  // a deck needs a street lined up with its ramps (OSM sometimes has just the tunnel stub)
  const segs = new SpatialHash(40);
  for (const r of data.roads) {
    if (r.kind === 'footway' || r.motorway) continue;
    for (let i = 0; i < r.pts.length - 1; i++) segs.insert([r.pts[i], r.pts[i + 1], r.w], bbox([r.pts[i], r.pts[i + 1]]));
  }
  const drivable = (d) => {
    let ok = 0, n = 0;
    for (let a = d.span + 2; a < d.span + d.ramp; a += 3) {
      for (const sg of [-1, 1]) {
        const x = d.x + d.ux * a * sg, z = d.z + d.uz * a * sg;
        n++;
        for (const [p, q, w] of segs.query(x, z, x, z)) {
          const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
          if (Math.abs(((q[0] - p[0]) * d.ux + (q[1] - p[1]) * d.uz) / l) > 0.8 && closestOnSegment(x, z, p[0], p[1], q[0], q[1])[3] < (w / 2) ** 2) {
            ok++;
            break;
          }
        }
      }
    }
    return ok >= n * 0.45;
  };

  const roads = [];
  for (const r of data.roads) {
    if (r.motorway || r.pasillo) {
      roads.push(r);
      continue;
    }
    const cum = [0];
    for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
    const hits = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      for (const s of obs.query(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]))) {
        if (r.ramp && s.type === 'mw') continue; // ramps meet the carriageway
        const t = intersect(a, b, s.a, s.b);
        if (t === null) continue;
        const sl = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, ul = cum[i + 1] - cum[i] || 1;
        const sin = Math.abs(((b[0] - a[0]) * (s.b[1] - s.a[1]) - (b[1] - a[1]) * (s.b[0] - s.a[0])) / (sl * ul));
        hits.push({ s: cum[i] + ul * t, half: s.half / Math.max(0.35, sin), type: s.type });
      }
    }
    if (!hits.length) {
      roads.push(r);
      continue;
    }
    hits.sort((p, q) => p.s - q.s);
    const clusters = [];
    for (const h of hits) {
      const c = clusters[clusters.length - 1];
      if (c && h.s - h.half - c.s1 < 30) {
        c.s1 = Math.max(c.s1, h.s + h.half);
        c.types.add(h.type);
      } else clusters.push({ s0: h.s - h.half, s1: h.s + h.half, types: new Set([h.type]) });
    }
    const cuts = [];
    for (const c of clusters) {
      const sm = (c.s0 + c.s1) / 2;
      const [mx, mz] = slice(r.pts, cum, sm, sm)[0];
      const [p, q] = slice(r.pts, cum, Math.max(0, sm - 5), Math.min(cum[cum.length - 1], sm + 5));
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / l, uz = (q[1] - p[1]) / l;
      const own = deckNear(mx, mz, ux, uz, true);
      let mode = own ? (own.type === 'bridge' ? 'over' : 'under') : deckNear(mx, mz, ux, uz, false) ? 'under' : null;
      if (!mode && !c.types.has('mw') && levelNear(mx, mz)) mode = 'level';
      if (mode === 'level') {
        out.levels.push({ x: mx, z: mz, ux, uz, w: r.w, half: (c.s1 - c.s0) / 2, ped: r.kind === 'footway' || r.kind === 'pedestrian' || r.kind === 'steps' });
        continue;
      }
      if (!mode) {
        cuts.push([c.s0 - 3, c.s1 + 3]);
        continue;
      }
      const span = (c.s1 - c.s0) / 2 + 1.5;
      const ped = r.kind === 'footway' || r.kind === 'pedestrian';
      const id = out.decks.find((d) => Math.hypot(d.x - mx, d.z - mz) < 10);
      if (id) continue; // both carriageways of a street share one deck
      const deck = {
        x: mx, z: mz, ux, uz, span, ramp: ped ? 26 : RAMP, half: ped ? r.w / 2 + 0.6 : r.w / 2 + 2.2,
        h: mode === 'over' ? (ped ? 5.4 : H_UP) : H_DOWN, mode, rail: c.types.has('rail'), mw: c.types.has('mw'), ped, name: r.name,
      };
      if (drivable(deck)) out.decks.push(deck);
      else cuts.push([c.s0 - 3, c.s1 + 3]);
    }
    if (!cuts.length) {
      roads.push(r);
      continue;
    }
    let s = 0;
    const end = cum[cum.length - 1];
    for (const [a, b] of cuts) {
      if (a - s > 4) roads.push({ ...r, pts: slice(r.pts, cum, s, a) });
      s = b;
    }
    if (end - s > 4) roads.push({ ...r, pts: slice(r.pts, cum, s, end) });
  }
  data.roads = roads;
  for (const d of out.decks) d.len = d.span + d.ramp;
  return out;
}

// Height of a deck at (x, z) for something moving along (dx, dz) (null: on foot, any way).
// fromY: under a bridge / on top of a trench's slab you stay at street level.
export function deckHeight(d, x, z, dx, dz, fromY = null) {
  const rx = x - d.x, rz = z - d.z;
  const s = rx * d.ux + rz * d.uz, t = rx * -d.uz + rz * d.ux;
  if (Math.abs(t) > d.half || Math.abs(s) > d.len) return null;
  if (dx != null && Math.abs(dx * d.ux + dz * d.uz) < 0.5) return null;
  const a = Math.abs(s);
  if (a <= d.span) return fromY !== null && Math.abs(fromY - d.h) > Math.abs(fromY) ? null : d.h;
  const k = (a - d.span) / d.ramp; // smooth S-curve ramp
  return d.h * (1 - k * k * (3 - 2 * k));
}

export function buildCorridors(data, plan, { root, chunks, collision, tex, flatMat, graph }) {
  const { decks, levels, obstacles } = plan;
  collision.decks = decks;
  const decksHash = new SpatialHash(80);
  for (const d of decks) decksHash.insert(d, { minX: d.x - d.len, maxX: d.x + d.len, minZ: d.z - d.len, maxZ: d.z + d.len });
  collision.decksAt = (x, z) => decksHash.query(x, z, x, z);
  collision.inDeck = (...a) => inDeck(...a);
  const inDeck = (x, z, pad = 0, mode = null) => {
    for (const d of decksHash.query(x - pad, z - pad, x + pad, z + pad)) {
      if (mode && d.mode !== mode) continue;
      const rx = x - d.x, rz = z - d.z;
      if (Math.abs(rx * d.ux + rz * d.uz) < d.len + pad && Math.abs(rx * -d.uz + rz * d.ux) < d.half + pad) return d;
    }
    return null;
  };
  const white = new THREE.Color(1, 1, 1);

  // ------------------------------------------------------------ decks
  const top = new GeoBuf(), side = new GeoBuf(), walk = new GeoBuf(), mask = new GeoBuf(), slab = new GeoBuf();
  const conc = new THREE.Color(0.86, 0.85, 0.82), dark = new THREE.Color(0.55, 0.54, 0.52);
  const N = 14;
  for (const d of decks) {
    const P = (s, t, y) => [d.x + d.ux * s - d.uz * t, y, d.z + d.uz * s + d.ux * t];
    const ys = [];
    for (let i = 0; i <= N * 2; i++) {
      const s = -d.len + (2 * d.len * i) / (N * 2);
      ys.push([s, deckHeight(d, d.x + d.ux * s, d.z + d.uz * s, null)]);
    }
    const road = d.ped ? 0 : d.half - 2.2, up = d.mode === 'over';
    for (let i = 0; i < ys.length - 1; i++) {
      const [s0, y0] = ys[i], [s1, y1] = ys[i + 1];
      const lift = 0.07;
      if (road > 0) top.quad(P(s0, -road, y0 + lift), P(s0, road, y0 + lift), P(s1, road, y1 + lift), P(s1, -road, y1 + lift), [0, s0 / 12], [1, s0 / 12], [1, s1 / 12], [0, s1 / 12], white, [0, 1, 0]);
      for (const sg of [-1, 1]) {
        const a = sg * road, b = sg * d.half;
        walk.quad(P(s0, a, y0 + 0.2), P(s0, b, y0 + 0.2), P(s1, b, y1 + 0.2), P(s1, a, y1 + 0.2), [a / 3, s0 / 3], [b / 3, s0 / 3], [b / 3, s1 / 3], [a / 3, s1 / 3], white, [0, 1, 0]);
        // side: parapet over the deck, and either the embankment wall down to the
        // ground (ramps) or the slab edge (span); trench walls from the floor up
        const inSpan = Math.abs((s0 + s1) / 2) < d.span;
        const yb0 = up ? (inSpan ? y0 - 1 : 0) : y0, yb1 = up ? (inSpan ? y1 - 1 : 0) : y1;
        // trench: walls up to a parapet over the street; under the slab, up to its bottom
        const yt0 = up ? y0 + 1.1 : inSpan ? -1 : Math.max(0.9, y0 + 1.1), yt1 = up ? y1 + 1.1 : inSpan ? -1 : Math.max(0.9, y1 + 1.1);
        const p = [P(s0, b, yb0), P(s1, b, yb1), P(s1, b, yt1), P(s0, b, yt0)];
        side.quad(...p, [s0 / 4, yb0 / 4], [s1 / 4, yb1 / 4], [s1 / 4, yt1 / 4], [s0 / 4, yt0 / 4], conc, null);
        side.quad(p[1], p[0], p[3], p[2], [s1 / 4, yb1 / 4], [s0 / 4, yb0 / 4], [s0 / 4, yt0 / 4], [s1 / 4, yt1 / 4], conc, null);
        if (up && inSpan) {
          const u0 = P(s0, -d.half, y0 - 1), u1 = P(s0, d.half, y0 - 1), u2 = P(s1, d.half, y1 - 1), u3 = P(s1, -d.half, y1 - 1);
          side.quad(u0, u3, u2, u1, [0, 0], [0, 1], [1, 1], [1, 0], dark, [0, -1, 0]);
        }
      }
      if (!up) mask.quad(P(s0, -d.half - 0.4, 0.3), P(s0, d.half + 0.4, 0.3), P(s1, d.half + 0.4, 0.3), P(s1, -d.half - 0.4, 0.3), [0, 0], [1, 0], [1, 1], [0, 1], white, [0, 1, 0]);
    }
    // abutments facing the obstacle (bridge) / the slab carrying the obstacle (trench)
    for (const sg of [-1, 1]) {
      const s = sg * d.span, y = up ? d.h - 1 : 0;
      if (up) side.quad(P(s, -d.half, 0), P(s, d.half, 0), P(s, d.half, y), P(s, -d.half, y), [0, 0], [1, 0], [1, 1], [0, 1], conc, [-sg * d.ux, 0, -sg * d.uz]);
      else side.quad(P(s, -d.half, -1), P(s, d.half, -1), P(s, d.half, 0.08), P(s, -d.half, 0.08), [0, 0], [1, 0], [1, 1], [0, 1], conc, [sg * d.ux, 0, sg * d.uz]);
    }
    if (!up) {
      const sp = d.span;
      slab.quad(P(-sp, -d.half - 0.4, 0.075), P(-sp, d.half + 0.4, 0.075), P(sp, d.half + 0.4, 0.075), P(sp, -d.half - 0.4, 0.075), [0, 0], [1, 0], [1, 1], [0, 1], white, [0, 1, 0]);
      side.quad(P(-sp, -d.half, -1), P(sp, -d.half, -1), P(sp, d.half, -1), P(-sp, d.half, -1), [0, 0], [1, 0], [1, 1], [0, 1], dark, [0, -1, 0]);
    }
    // collision: the embankment / trench sides along the ramps (where they're tall)
    for (const sg of [-1, 1]) {
      // the outer third of each ramp is too low to need a wall
      for (const [lo, hi] of [[-d.len + d.ramp * 0.35, -d.span], [d.span, d.len - d.ramp * 0.35]]) {
        const t0 = sg * d.half, t1 = sg * (d.half + 0.4);
        const q = [P(lo, t0, 0), P(hi, t0, 0), P(hi, t1, 0), P(lo, t1, 0)].map((p) => [p[0], p[2]]);
        collision.addPolygon(q, 1.2, up ? 'deckwall' : 'trench');
      }
    }
  }
  const concMat = new THREE.MeshStandardMaterial({ map: tex.concrete, vertexColors: true, roughness: 0.95 });
  const add = (buf, mat, cast = true) => {
    if (buf.empty) return;
    const m = new THREE.Mesh(buf.geometry(), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    root.add(m);
  };
  add(top, new THREE.MeshStandardMaterial({ map: tex.road2, roughness: 0.95 }), false);
  add(walk, new THREE.MeshStandardMaterial({ map: tex.sidewalk, roughness: 0.95 }), false);
  add(side, concMat);
  add(slab, new THREE.MeshStandardMaterial({ map: tex.asphalt, color: 0x9a968e, roughness: 0.95 }), false);
  if (!mask.empty) {
    // marks the trenches in the stencil buffer so the ground and flat layers skip them
    const m = new THREE.Mesh(mask.geometry(), new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, depthTest: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    }));
    m.renderOrder = -11;
    root.add(m);
  }

  // ------------------------------------------------------------ fences and barriers
  // rail fence: an alambrado on each side of the tracks, left open at level crossings
  const ramps = data.roads.filter((r) => r.ramp);
  const rampHash = new SpatialHash(40);
  for (const r of ramps) for (let i = 0; i < r.pts.length - 1; i++) rampHash.insert([r.pts[i], r.pts[i + 1]], bbox([r.pts[i], r.pts[i + 1]]));
  const nearRamp = (x, z, d) => {
    for (const [a, b] of rampHash.query(x - d, z - d, x + d, z + d)) if (closestOnSegment(x, z, a[0], a[1], b[0], b[1])[3] < d * d) return true;
    return false;
  };
  const obsHash = new SpatialHash(40);
  for (const s of obstacles) obsHash.insert(s, bbox([s.a, s.b]));
  const otherWithin = (x, z, type, d, self) => {
    for (const s of obsHash.query(x - d, z - d, x + d, z + d)) {
      if (s.type !== type || s === self) continue;
      if (closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3] < d * d) return true;
    }
    return false;
  };
  const atLevel = (x, z) => levels.some((l) => {
    const rx = x - l.x, rz = z - l.z;
    return Math.abs(rx * -l.uz + rz * l.ux) < l.w / 2 + 2.5 && Math.abs(rx * l.ux + rz * l.uz) < l.half + 8;
  });
  const roadAt = (x, z) => {
    const n = graph.nearest(x, z, 20);
    return n && !n.seg.road.motorway && !n.seg.road.ramp && n.dist < n.seg.road.w / 2 + 0.8 ? n.seg.road : null;
  };

  // walk an offset line of every obstacle segment and emit runs of kept points
  const runs = (type, off, keep) => {
    const out = [];
    for (const s of obstacles) {
      if (s.type !== type) continue;
      const [a, b] = [s.a, s.b], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      let run = [];
      const flush = () => {
        if (run.length > 1) out.push(run);
        run = [];
      };
      for (let t = 0; t <= len; t += 2) {
        const x = a[0] + ux * t - uz * off, z = a[1] + uz * t + ux * off;
        if (keep(x, z, s)) run.push([x, z]);
        else flush();
      }
      flush();
    }
    return out;
  };
  const fenceRect = ATLAS.alambre;
  const props = (x, z) => chunks.at(x, z).props;
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const tplBox = (() => {
    const g = box.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  })();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
  const place = (x, y, z, sx, sy, sz, ry) => _m.compose(new THREE.Vector3(x, y, z), _q.setFromAxisAngle(_y, ry), new THREE.Vector3(sx, sy, sz));
  const fence = (run, tag, height, posts) => {
    for (let i = 0; i < run.length - 1; i++) {
      const p0 = run[i], p1 = run[i + 1];
      const ch = chunks.at(p0[0], p0[1]);
      railing(ch.alpha, p0, p1, 0, height, fenceRect, 2.5);
      if (i % 2 === 0 && posts) ch.props.add(tplBox, place(p0[0], 0, p0[1], 0.12, height + 0.15, 0.12, 0), posts);
    }
    for (let i = 0; i < run.length - 1; i += 4) {
      const seg = run.slice(i, i + 5);
      if (seg.length < 2) continue;
      const a = seg[0], b = seg[seg.length - 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * 0.12, nz = (b[0] - a[0]) / l * 0.12;
      collision.addPolygon([[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]], height, tag);
    }
  };
  const postCol = new THREE.Color(0.62, 0.6, 0.56);
  for (const off of [-RAIL_HALF, RAIL_HALF]) {
    for (const run of runs('rail', off, (x, z, s) => !otherWithin(x, z, 'rail', RAIL_HALF - 0.3, s) && !atLevel(x, z) && !inDeck(x, z, 0.5, 'under') &&
      !collision.isBlocked(x, z, 0.3))) fence(run, 'railfence', 1.9, postCol);
  }

  // autopista: New Jersey in the median, guardrail + alambrado on the outer edge,
  // open only where a ramp leaves or joins
  const jersey = new THREE.Color(0.84, 0.83, 0.8), steel = new THREE.Color(0.7, 0.72, 0.74);
  const mwRoads = data.roads.filter((r) => r.motorway);
  for (const r of mwRoads) {
    for (const sg of [-1, 1]) {
      const off = sg * (MW_W / 2 + (sg < 0 ? 0.35 : 0.6));
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.5) continue;
        const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, ry = Math.atan2(ux, uz);
        let run = [];
        const flush = () => {
          if (run.length > 1) {
            if (sg < 0) {
              for (let k = 0; k < run.length - 1; k++) {
                const [p, q] = [run[k], run[k + 1]];
                props(p[0], p[1]).add(tplBox, place((p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2, 0.45, 0.82, Math.hypot(q[0] - p[0], q[1] - p[1]) + 0.05, ry), jersey, 0.05);
              }
              const A = run[0], B = run[run.length - 1];
              collision.addPolygon([[A[0] - uz * 0.25, A[1] + ux * 0.25], [B[0] - uz * 0.25, B[1] + ux * 0.25], [B[0] + uz * 0.25, B[1] - ux * 0.25], [A[0] + uz * 0.25, A[1] - ux * 0.25]], 0.8, 'barrier');
            } else {
              for (let k = 0; k < run.length - 1; k++) {
                const [p, q] = [run[k], run[k + 1]];
                const ch = props(p[0], p[1]);
                ch.add(tplBox, place((p[0] + q[0]) / 2, 0.45, (p[1] + q[1]) / 2, 0.06, 0.32, Math.hypot(q[0] - p[0], q[1] - p[1]) + 0.05, ry), steel);
                if (k % 2 === 0) ch.add(tplBox, place(p[0], 0, p[1], 0.1, 0.75, 0.1, ry), steel);
              }
              fence(run.map(([x, z]) => [x - uz * 2.4, z + ux * 2.4]), 'barrier', 2.2, postCol);
            }
          }
          run = [];
        };
        for (let t = 0; t <= len; t += 2) {
          const x = a[0] + ux * t - uz * off, z = a[1] + uz * t + ux * off;
          if (nearRamp(x, z, sg > 0 ? 7 : 3) || inDeck(x, z, 0.5, 'under')) flush();
          else run.push([x, z]);
        }
        flush();
      }
    }
  }

  // ------------------------------------------------------------ autopista design
  // lane lines (dashed between lanes, solid edges), tall lamps and green exit signs
  const lineBuf = new GeoBuf();
  const strip = (a, b, off, w) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    const o0 = off - w / 2, o1 = off + w / 2;
    lineBuf.quad([a[0] + nx * o0, 0.075, a[1] + nz * o0], [a[0] + nx * o1, 0.075, a[1] + nz * o1], [b[0] + nx * o1, 0.075, b[1] + nz * o1], [b[0] + nx * o0, 0.075, b[1] + nz * o0],
      [0, 0], [1, 0], [1, 1], [0, 1], white, [0, 1, 0]);
  };
  const lamps = [];
  for (const r of mwRoads) {
    let along = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (const off of [-MW_W / 2 + 0.5, MW_W / 2 - 0.4]) strip(a, b, off, 0.18);
      for (let t = (3 - (along % 12) + 12) % 12; t + 4 < len; t += 12) {
        const p = [a[0] + ux * t, a[1] + uz * t], q = [a[0] + ux * (t + 4), a[1] + uz * (t + 4)];
        for (const off of [-MW_W / 2 + 0.5 + 3.5, -MW_W / 2 + 0.5 + 7]) strip(p, q, off, 0.15);
      }
      for (let t = (40 - (along % 40)) % 40; t < len; t += 40) {
        const x = a[0] + ux * t + uz * (MW_W / 2 + 1.2), z = a[1] + uz * t - ux * (MW_W / 2 + 1.2);
        if (!nearRamp(x, z, 4) && !inDeck(x, z, 1)) lamps.push([x, z, Math.atan2(-uz, ux)]); // in the median, arm over the lanes
      }
      along += len;
    }
  }
  if (!lineBuf.empty) {
    const m = new THREE.Mesh(lineBuf.geometry(), flatMat(null, 0xf4f4f0));
    m.renderOrder = -6.4;
    root.add(m);
  }

  // exits: a green sign where each ramp leaves the carriageway
  const mwKey = new Set(mwRoads.flatMap((r) => r.pts.map(([x, z]) => `${Math.round(x)},${Math.round(z)}`)));
  const signs = [];
  for (const r of ramps) {
    const [x0, z0] = r.pts[0];
    if (!mwKey.has(`${Math.round(x0)},${Math.round(z0)}`) || r.pts.length < 2) continue;
    const [x1, z1] = r.pts[Math.min(r.pts.length - 1, 3)];
    const l = Math.hypot(x1 - x0, z1 - z0) || 1, ux = (x1 - x0) / l, uz = (z1 - z0) / l;
    const [ex, ez] = r.pts[r.pts.length - 1];
    let dest = r.name;
    if (!dest) {
      const n = graph.nearest(ex, ez, 60);
      dest = n && !n.seg.road.ramp && !n.seg.road.motorway ? n.seg.road.name : '';
      if (!dest) {
        let best = Infinity;
        for (const rr of data.roads) {
          if (!rr.name || rr.ramp || rr.motorway) continue;
          const d = polyDist(ex, ez, rr.pts);
          if (d < best && d < 150) [best, dest] = [d, rr.name];
        }
      }
    }
    // 60 m back along the carriageway, on its right
    const sx = x0 - ux * 60 + uz * 8, sz = z0 - uz * 60 - ux * 8;
    if (signs.some((s) => Math.hypot(s.x - sx, s.z - sz) < 40)) continue;
    signs.push({ x: sx, z: sz, ry: Math.atan2(ux, uz), dest });
  }
  for (const s of signs) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b6b3a';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 176);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText('SALIDA', 28, 58);
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.fillText((s.dest || 'Quilmes').replace(/^Avenida /, 'Av. ').slice(0, 20), 28, 124, 456);
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText('↗', 450, 58);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const post = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.6, roughness: 0.4 });
    for (const x of [-2.6, 2.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.4, 6), post);
      p.position.set(x, 3.7, 0);
      g.add(p);
      collision.addCircle(s.x + Math.cos(s.ry) * x, s.z - Math.sin(s.ry) * x, 0.2, 'pole');
    }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6, 2.25, 0.12), [post, post, post, post, new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15 }), post]);
    panel.position.set(0, 6.2, 0);
    panel.castShadow = true;
    g.add(panel);
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.ry + Math.PI; // face the oncoming traffic
    root.add(g);
  }

  // ------------------------------------------------------------ barreras
  const gates = [];
  for (const l of levels) {
    if (l.ped) continue; // footpath crossings: just the gap in the fence
    for (const sg of [-1, 1]) {
      // pivot on the right of each approach, just outside the fence
      const s = sg * (l.half + 2.2), t = -sg * (l.w / 2 + 0.6);
      const x = l.x + l.ux * s - l.uz * t, z = l.z + l.uz * s + l.ux * t;
      // the arm swings down across the incoming half of the street (local +x)
      const Dx = -sg * l.uz, Dz = sg * l.ux;
      gates.push({ x, z, ry: Math.atan2(-Dz, Dx), Dx, Dz, len: l.w / 2 + 0.2, l, a: Math.PI / 2 });
      collision.addCircle(x, z, 0.2, 'pole');
    }
  }
  let gateMesh = null;
  if (gates.length) {
    const arm = new THREE.BoxGeometry(1, 0.12, 0.12).translate(0.5, 0, 0);
    const map = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 4;
      const ctx = c.getContext('2d');
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#f4f4f4' : '#d11f1f';
        ctx.fillRect(i * 8, 0, 8, 4);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    gateMesh = new THREE.InstancedMesh(arm, new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), gates.length);
    gateMesh.castShadow = true;
    gateMesh.userData.dynamic = true; // its matrices change: keep the CPU copy
    root.add(gateMesh);
    const postG = [], crossG = [];
    for (const g of gates) {
      postG.push(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 6).translate(g.x, 0.6, g.z), new THREE.BoxGeometry(0.35, 0.5, 0.35).translate(g.x, 1.0, g.z));
      // cruz de San Andrés
      const pole = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5).translate(0, 1.6, 0);
      const bar = (r) => new THREE.BoxGeometry(1.4, 0.22, 0.04).rotateZ(r).translate(0, 2.9, 0.06);
      for (const piece of [pole, bar(0.6), bar(-0.6)]) crossG.push(piece.applyMatrix4(new THREE.Matrix4().makeRotationY(g.ry + Math.PI / 2).setPosition(g.x - g.Dx * 0.7, 0, g.z - g.Dz * 0.7)));
    }
    const merge = (list, mat) => {
      const m = new THREE.Mesh(mergeList(list), mat);
      m.castShadow = true;
      root.add(m);
    };
    merge(postG, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }));
    merge(crossG, new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 }));
  }
  const _gm = new THREE.Matrix4(), _e = new THREE.Euler();
  const gateQ = new THREE.Quaternion();
  const drawGates = () => {
    gates.forEach((g, i) => {
      _e.set(0, g.ry, g.a, 'YXZ');
      gateQ.setFromEuler(_e);
      _gm.compose(new THREE.Vector3(g.x, 1.05, g.z), gateQ, new THREE.Vector3(g.len, 1, 1));
      gateMesh.setMatrixAt(i, _gm);
    });
    gateMesh.instanceMatrix.needsUpdate = true;
  };
  if (gateMesh) drawGates();
  // crossing s on every track, for the trains
  let trackPos = null;
  return {
    lamps,
    levels,
    decks,
    inDeck,
    // barreras go down while a train is within ~250 m of the crossing
    update(dt, trains) {
      if (!gateMesh || !trains?.trains?.length) return;
      if (!trackPos) {
        trackPos = levels.map((l) => trains.trains.map((tr) => {
          const p = tr.track.project(l.x, l.z);
          return p.d < 20 ? p.s : null;
        }));
      }
      const closed = levels.map((l, i) => trains.trains.some((tr, k) => trackPos[i][k] !== null && Math.abs(tr.s - trackPos[i][k]) < 250));
      let changed = false;
      for (const g of gates) {
        const want = closed[levels.indexOf(g.l)] ? 0 : Math.PI / 2 - 0.05;
        const a = g.a + Math.sign(want - g.a) * Math.min(Math.abs(want - g.a), dt * 0.9);
        if (a !== g.a) {
          g.a = a;
          changed = true;
        }
      }
      if (changed) drawGates();
      this.closed = closed;
    },
    // is the level crossing near (x, z) closed?
    closedAt(x, z) {
      if (!this.closed) return false;
      return levels.some((l, i) => this.closed[i] && Math.hypot(l.x - x, l.z - z) < l.half + 14);
    },
  };
}

function mergeList(list) {
  let n = 0;
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

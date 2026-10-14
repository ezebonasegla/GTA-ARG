// Street fronts of the low houses of the conurbano, laid out from the real width of
// each front: a garage portón, the front door, windows with persianas and rejas, and on
// the upper floor windows above them (sometimes a balcony).
//
// Two levels of detail share the same layout (rebuilt from a seed, nothing per opening
// is stored):
//   - far: the wall with flat openings, in the chunk's facade buffer (whole city);
//   - near: the 3D relief, built per cell only around the camera (HouseDetail): window
//     mouldings and sills, rejas, door frames and steps, garage lintels, zócalos, light
//     fixtures, gas meters, balconies, and the front fence with its gate when the house
//     stands back from the sidewalk.
import * as THREE from 'three';
import { mulberry32 } from './geo.js';
import { GeoBuf } from './geobuf.js';
import { ATLAS } from './conurbanoTextures.js';

const FLOOR = 2.9;
const UP = [0, 1, 0];
const DOOR_TINTS = ['#2f4a35', '#3b3b3b', '#7a2e22', '#e8e8e8', '#5a4632', '#1f3550'].map((c) => new THREE.Color(c));
const GATE_TINTS = ['#3b3b3b', '#2f4a35', '#e8e8e8', '#5a5a5a', '#6b3a22', '#1f3550', '#9a9a98'].map((c) => new THREE.Color(c));
const ZOCALO = ['#8f8a82', '#5d5a56', '#a4553a', '#c9c2b4', '#3f3f3f'].map((c) => new THREE.Color(c));
const WHITE = new THREE.Color(1, 1, 1);

// Openings of one front: { kind: window|door|garage|balcony, a (metres from p0), w, y0, y1, ... }
export function frontLayout(len, h, levels, seed, main) {
  const rng = mulberry32(seed);
  const items = [];
  if (len < 2.2 || h < 2.4) return items;
  const gh = Math.min(3, h);
  const busy = [];
  if (main && len >= 6.2 && rng() < 0.45) {
    const w = Math.min(2.9, 2.5 + rng() * 0.4), left = rng() < 0.5;
    const a = left ? 0.35 : len - 0.35 - w;
    items.push({ kind: 'garage', a, w, y0: 0, y1: Math.min(2.3, gh - 0.35), tint: GATE_TINTS[Math.floor(rng() * GATE_TINTS.length)] });
    busy.push([a - 0.45, a + w + 0.45]);
  }
  if (main && len >= 2.6) {
    const dw = 0.9;
    const g = items[0];
    let a;
    if (g) a = g.a < len / 2 ? g.a + g.w + 0.55 : g.a - 0.55 - dw;
    else if (len >= 6.5) a = rng() < 0.5 ? 0.7 : len - 0.7 - dw;
    else a = len < 4 ? len - dw - 0.4 : (len - dw) / 2 + (rng() - 0.5) * (len - dw - 1.2);
    if (a >= 0.3 && a + dw <= len - 0.3) {
      items.push({ kind: 'door', a, w: dw, y0: 0, y1: 2.1, v: rng() < 0.55 ? 0 : 1, tint: DOOR_TINTS[Math.floor(rng() * DOOR_TINTS.length)] });
      busy.push([a - 0.5, a + dw + 0.5]);
    }
  }
  // windows fill the free stretches of the ground floor
  busy.sort((p, q) => p[0] - q[0]);
  const spans = [];
  let s = 0.4;
  for (const [b0, b1] of busy) {
    if (b0 > s) spans.push([s, b0]);
    s = Math.max(s, b1);
  }
  if (len - 0.4 > s) spans.push([s, len - 0.4]);
  const kindOf = () => {
    const r = rng();
    return r < 0.45 ? 'ventana' : r < 0.7 ? 'ventanaCortina' : 'ventanaPersiana';
  };
  const ground = [];
  for (const [a0, a1] of spans) {
    const sp = a1 - a0;
    let ww = sp > 4.2 ? 1.5 : 1.25;
    let n = Math.floor((sp + 0.8) / (ww + 0.8));
    if (!n && sp >= 0.9) {
      n = 1;
      ww = Math.min(1, sp - 0.3);
    }
    const gap = (sp - n * ww) / (n + 1);
    for (let k = 0; k < n; k++) {
      const it = { kind: 'window', a: a0 + gap + k * (ww + gap), w: ww, y0: 0.95, y1: Math.min(gh - 0.45, 2.2), tex: kindOf(), reja: rng() < 0.85 };
      items.push(it);
      ground.push(it);
    }
  }
  // upper floors: windows above the ground ones and above the garage
  const above = [...ground.map((g) => [g.a, g.w]), ...items.filter((i) => i.kind === 'garage').map((g) => [g.a + 0.4, g.w - 0.8])];
  if (!above.length && len >= 2.4) above.push([(len - 1.2) / 2, 1.2]);
  const balconyFloor = levels >= 2 && len >= 5 && rng() < 0.4 ? 1 : 0;
  for (let f = 1; f < levels; f++) {
    const base = f * FLOOR;
    if (base + 2.4 > h - 0.3) break;
    let widest = -1;
    above.forEach(([, w], i) => {
      if (widest < 0 || w > above[widest][1]) widest = i;
    });
    above.forEach(([a, w], i) => {
      if (f === balconyFloor && i === widest) {
        const bw = Math.max(1.4, Math.min(w, 2));
        items.push({ kind: 'balcony', a: a + (w - bw) / 2, w: bw, y0: base + 0.05, y1: base + 2.15, tex: 'ventanaCortina' });
      } else items.push({ kind: 'window', a, w, y0: base + 0.95, y1: base + 2.2, tex: kindOf(), reja: rng() < 0.25 });
    });
  }
  return items;
}

// Front of an apartment block: a glass portal on the main front, windows on the ground
// floor, and bays every ~3.3 m up the floors, either balconies (every other bay) or
// windows. Floor height follows the building's real height.
export function blockLayout(len, h, levels, seed, main) {
  const rng = mulberry32(seed);
  const items = [];
  if (len < 3 || levels < 3) return items;
  const fh = Math.min(3.3, Math.max(2.7, (h - 0.6) / levels));
  const balconies = rng() < 0.55;
  const bays = Math.max(1, Math.floor((len - 0.6) / 3.3)), bw = (len - 0.6) / bays;
  const tex = rng() < 0.5 ? 'ventanaPersiana' : rng() < 0.5 ? 'ventana' : 'ventanaCortina';
  const pick = () => (rng() < 0.6 ? tex : rng() < 0.5 ? 'ventanaCortina' : 'ventanaPersiana');
  let portalBay = -1;
  if (main) {
    portalBay = Math.floor(rng() * bays);
    const pw = Math.min(2, bw - 0.6);
    if (pw >= 1.2) items.push({ kind: 'portal', a: 0.3 + portalBay * bw + (bw - pw) / 2, w: pw, y0: 0, y1: Math.min(2.6, fh - 0.25) });
    else portalBay = -1;
  }
  for (let b = 0; b < bays; b++) {
    if (b === portalBay) continue;
    const ww = Math.min(1.6, bw - 0.9);
    if (ww > 0.7) items.push({ kind: 'window', a: 0.3 + b * bw + (bw - ww) / 2, w: ww, y0: 0.95, y1: Math.min(2.25, fh - 0.4), tex: pick(), reja: rng() < 0.6 });
  }
  for (let f = 1; f < levels; f++) {
    const base = f * fh;
    if (base + 2.3 > h - 0.3) break;
    for (let b = 0; b < bays; b++) {
      if (balconies && (b % 2 === 0 || bays <= 2)) {
        const w = Math.min(1.8, bw - 0.7);
        if (w > 0.9) items.push({ kind: 'balcony', a: 0.3 + b * bw + (bw - w) / 2, w, y0: base + 0.05, y1: base + 2.15, tex: 'ventanaCortina', block: true });
      } else {
        const w = Math.min(1.5, bw - 0.9);
        if (w > 0.7) items.push({ kind: 'window', a: 0.3 + b * bw + (bw - w) / 2, w, y0: base + 0.9, y1: base + 2.15, tex: pick(), reja: false, ac: rng() < 0.15 });
      }
    }
  }
  items.fh = fh;
  return items;
}

// ------------------------------------------------------------ far: wall + flat openings
export function frontWall(buf, L, p0, p1, h, top, tint, wallLayer, uOff, items) {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const ux = (p1[0] - p0[0]) / len, uz = (p1[1] - p0[1]) / len, ox = uz, oz = -ux;
  buf.wall(p0, p1, 0, top, uOff, 3, 3, tint, wallLayer);
  const P = (s, y, d = 0.03) => [p0[0] + ux * s + ox * d, y, p0[1] + uz * s + oz * d];
  const n = [ox, 0, oz];
  for (const it of items) {
    if (it.y1 > top + 0.01) continue;
    const layer = it.kind === 'door' ? L[`puerta${it.v}`] : it.kind === 'garage' ? L.porton : it.kind === 'portal' ? L.portal : L[it.tex];
    const color = it.kind === 'garage' || (it.kind === 'door' && it.v === 1) ? it.tint : WHITE;
    buf.quad(P(it.a, it.y0), P(it.a + it.w, it.y0), P(it.a + it.w, it.y1), P(it.a, it.y1), [1, 0], [0, 0], [0, 1], [1, 1], color, n, layer);
  }
}

// ------------------------------------------------------------ near: 3D relief
const CELL = 75;
const BUDGET = 2; // ms of baking per frame: spread over frames instead of a hitch

export class HouseDetail {
  constructor() {
    this.cells = new Map();
  }
  // one street front of a low house
  add(p0, p1, h, top, levels, tint, seed, main, setback, kind) {
    const k = `${Math.floor(((p0[0] + p1[0]) / 2) / CELL)},${Math.floor(((p0[1] + p1[1]) / 2) / CELL)}`;
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = { fronts: [], mesh: null, alpha: null }));
    c.fronts.push({ p0, p1, h, top, levels, tint: tint.getHex(), seed, main, setback, kind });
  }
  // a side wall (medianera) taller than its neighbours: coping and pipes
  addMed(p0, p1, h, seed) {
    const k = `${Math.floor(((p0[0] + p1[0]) / 2) / CELL)},${Math.floor(((p0[1] + p1[1]) / 2) / CELL)}`;
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = { fronts: [], mesh: null, alpha: null }));
    (c.meds ||= []).push(p0[0], p0[1], p1[0], p1[1], h, seed);
  }
  build(root, mats) {
    this.root = root;
    this.mats = mats;
    for (const [k, c] of this.cells) {
      const [ix, iz] = k.split(',').map(Number);
      c.cx = (ix + 0.5) * CELL;
      c.cz = (iz + 0.5) * CELL;
    }
  }
  // bake the cells around the camera, nearest first, a couple of milliseconds a frame;
  // drop the far ones
  update(p, initial = false) {
    const R = 150 + CELL * 0.7;
    let next = null, nd = Infinity;
    for (const c of this.cells.values()) {
      const d2 = (c.cx - p.x) ** 2 + (c.cz - p.z) ** 2;
      if (d2 < R * R) {
        if (!c.mesh && d2 < nd) {
          nd = d2;
          next = c;
        }
      } else if (c.mesh && d2 > (R * 1.3) ** 2) {
        for (const m of [c.mesh, c.alpha]) {
          if (!m) continue;
          this.root.remove(m);
          m.geometry?.dispose();
        }
        c.mesh = c.alpha = null;
      } else if (c.job && d2 > (R * 1.3) ** 2) c.job = null;
    }
    if (initial) {
      for (const c of this.cells.values()) {
        if (!c.mesh && (c.cx - p.x) ** 2 + (c.cz - p.z) ** 2 < R * R) this.bake(c, Infinity);
      }
      return;
    }
    // keep working on the cell already started if it is still wanted
    const busy = this.busy?.job && !this.busy.mesh ? this.busy : next;
    if (busy) {
      this.busy = busy;
      this.bake(busy, BUDGET);
    }
  }
  bake(c, budget) {
    const t0 = performance.now();
    const job = (c.job ||= { solid: new GeoBuf(), alpha: new GeoBuf(), i: 0, j: 0 });
    const m = c.meds || [];
    while (job.i < c.fronts.length) {
      relief(job.solid, job.alpha, c.fronts[job.i++]);
      if (performance.now() - t0 > budget) return;
    }
    while (job.j < m.length) {
      medRelief(job.solid, [m[job.j], m[job.j + 1]], [m[job.j + 2], m[job.j + 3]], m[job.j + 4], m[job.j + 5]);
      job.j += 6;
      if (performance.now() - t0 > budget) return;
    }
    const { solid, alpha } = job;
    c.job = null;
    if (!solid.empty) {
      c.mesh = new THREE.Mesh(solid.geometry(), this.mats.props);
      c.mesh.castShadow = c.mesh.receiveShadow = true;
      this.root.add(c.mesh);
    }
    if (!alpha.empty) {
      c.alpha = new THREE.Mesh(alpha.geometry(), this.mats.alpha);
      c.alpha.receiveShadow = true;
      this.root.add(c.alpha);
    }
    if (!c.mesh) c.mesh = new THREE.Object3D(); // nothing to show: don't retry every frame
  }
}

function relief(solid, alpha, f) {
  const { p0, p1, h, top } = f;
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const ux = (p1[0] - p0[0]) / len, uz = (p1[1] - p0[1]) / len, ox = uz, oz = -ux;
  const rng = mulberry32(f.seed ^ 0x5bd1e995);
  const tint = new THREE.Color(f.tint);
  const light = tint.clone().lerp(WHITE, 0.45);
  const P = (s, y, d) => [p0[0] + ux * s + ox * d, y, p0[1] + uz * s + oz * d];
  const box = makeBox(solid, p0, ux, uz);
  // alpha-tested panel (rejas, barandas) parallel to the wall, `d` out
  const panel = (s0, s1, y0, y1, d, rect, tile = 1.2) => {
    const [a0, b0, a1, b1] = rect;
    const k = Math.max(1, Math.round((s1 - s0) / tile));
    for (let i = 0; i < k; i++) {
      const sa = s0 + ((s1 - s0) * i) / k, sb = s0 + ((s1 - s0) * (i + 1)) / k;
      alpha.quad(P(sa, y0, d), P(sb, y0, d), P(sb, y1, d), P(sa, y1, d), [a0, b0], [a1, b0], [a1, b1], [a0, b1], WHITE, [ox, 0, oz]);
    }
  };
  const block = f.kind === 'block';
  const items = block ? blockLayout(len, h, f.levels, f.seed, f.main) : frontLayout(len, h, f.levels, f.seed, f.main);
  const holes = items.filter((i) => i.kind === 'door' || i.kind === 'garage' || i.kind === 'portal').map((i) => [i.a - 0.12, i.a + i.w + 0.12]);

  // zócalo along the foot of the wall, interrupted by the door and the garage
  const zh = 0.45 + rng() * 0.4, zc = ZOCALO[Math.floor(rng() * ZOCALO.length)];
  let s = 0;
  for (const [a, b] of [...holes.sort((p, q) => p[0] - q[0]), [len, len]]) {
    if (a - s > 0.1) box(s, Math.min(a, len), 0, zh, 0, 0.035, zc);
    s = Math.max(s, b);
  }
  // a moulded band between the floors (every floor on the blocks)
  const fh = items.fh || FLOOR;
  for (let k = 1; k < (block ? f.levels : 2); k++) if (f.levels > k && top > k * fh + 0.5) box(0, len, k * fh - 0.1, k * fh + 0.08, 0, block ? 0.04 : 0.06, light);

  for (const it of items) {
    if (it.y1 > top + 0.01) continue;
    const { a, w, y0, y1 } = it;
    if (it.kind === 'window') {
      box(a - 0.12, a + w + 0.12, y1, y1 + 0.12, 0, 0.07, light); // dintel
      box(a - 0.12, a, y0, y1, 0, 0.07, light);
      box(a + w, a + w + 0.12, y0, y1, 0, 0.07, light);
      box(a - 0.17, a + w + 0.17, y0 - 0.07, y0, 0, 0.15, new THREE.Color(0.86, 0.84, 0.8)); // alféizar
      if (it.reja) panel(a - 0.05, a + w + 0.05, y0 - 0.02, y1 + 0.05, 0.13, ATLAS.reja, 1.3);
      if (it.ac) box(a + w + 0.2, a + w + 1.0, y0 + 0.2, y0 + 0.75, 0, 0.32, new THREE.Color(0.93, 0.93, 0.91));
    } else if (it.kind === 'door') {
      const fc = it.v === 0 ? new THREE.Color(0.25, 0.16, 0.09) : new THREE.Color(0.18, 0.18, 0.18);
      box(a - 0.1, a, 0, y1 + 0.1, 0, 0.06, fc);
      box(a + w, a + w + 0.1, 0, y1 + 0.1, 0, 0.06, fc);
      box(a - 0.1, a + w + 0.1, y1, y1 + 0.1, 0, 0.06, fc);
      box(a - 0.35, a + w + 0.35, 0, 0.14, 0, 0.32, new THREE.Color(0.78, 0.76, 0.72)); // umbral
      // aplique, número and timbre beside the door
      const side = a > len / 2 ? -1 : 1, sx = side > 0 ? a + w + 0.3 : a - 0.3;
      box(sx - 0.07, sx + 0.07, 2.15, 2.4, 0, 0.12, new THREE.Color(0.95, 0.92, 0.8));
      box(sx - 0.14, sx + 0.14, 1.55, 1.7, 0, 0.02, new THREE.Color(0.95, 0.95, 0.95));
      box(sx - 0.03, sx + 0.03, 1.3, 1.4, 0, 0.02, new THREE.Color(0.2, 0.2, 0.2));
      // gabinete del medidor de gas
      if (rng() < 0.4) {
        const gx = side > 0 ? Math.min(len - 0.4, a + w + 0.9) : Math.max(0.4, a - 0.9);
        box(gx - 0.3, gx + 0.3, 0.3, 0.95, 0, 0.12, new THREE.Color(0.62, 0.64, 0.64));
      }
    } else if (it.kind === 'portal') {
      const fc = new THREE.Color(0.3, 0.24, 0.17);
      box(a - 0.12, a, 0, y1 + 0.12, 0, 0.08, fc);
      box(a + w, a + w + 0.12, 0, y1 + 0.12, 0, 0.08, fc);
      box(a - 0.12, a + w + 0.12, y1, y1 + 0.12, 0, 0.08, fc);
      box(a - 0.6, a + w + 0.6, y1 + 0.3, y1 + 0.42, 0, 1.3, light); // marquesina
      box(a - 0.5, a + w + 0.5, 0, 0.12, 0, 0.6, new THREE.Color(0.7, 0.68, 0.64)); // escalón
      const sx = a + w + 0.35;
      box(sx - 0.12, sx + 0.12, 1.2, 1.6, 0, 0.04, new THREE.Color(0.75, 0.75, 0.73)); // portero eléctrico
      box(a + w / 2 - 0.25, a + w / 2 + 0.25, y1 + 0.5, y1 + 0.75, 0, 0.03, new THREE.Color(0.95, 0.95, 0.95)); // número
    } else if (it.kind === 'garage') {
      box(a - 0.15, a + w + 0.15, y1, y1 + 0.28, 0, 0.1, light); // dintel
      box(a - 0.15, a, 0, y1, 0, 0.1, light);
      box(a + w, a + w + 0.15, 0, y1, 0, 0.1, light);
    } else if (it.kind === 'balcony' && it.block) {
      box(a - 0.12, a + w + 0.12, y1, y1 + 0.12, 0, 0.07, light); // slab and railing: far props
    } else if (it.kind === 'balcony') {
      box(a - 0.12, a + w + 0.12, y1, y1 + 0.12, 0, 0.07, light);
      box(a - 0.4, a + w + 0.4, y0 - 0.17, y0, 0, 0.9, new THREE.Color(0.82, 0.8, 0.76)); // losa
      const rail = (s0, s1, d0, d1) => {
        const A = P(s0, y0, d0), B = P(s1, y0, d1);
        const k = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[2] - A[2]) / 1.2));
        for (let i = 0; i < k; i++) {
          const q0 = [A[0] + ((B[0] - A[0]) * i) / k, A[2] + ((B[2] - A[2]) * i) / k];
          const q1 = [A[0] + ((B[0] - A[0]) * (i + 1)) / k, A[2] + ((B[2] - A[2]) * (i + 1)) / k];
          const [a0, b0, a1, b1] = ATLAS.baranda;
          alpha.quad([q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [q1[0], y0 + 1, q1[1]], [q0[0], y0 + 1, q0[1]], [a0, b0], [a1, b0], [a1, b1], [a0, b1], WHITE, [q1[1] - q0[1], 0, q0[0] - q1[0]]);
        }
      };
      rail(a - 0.35, a + w + 0.35, 0.85, 0.85);
      rail(a - 0.35, a - 0.35, 0, 0.85);
      rail(a + w + 0.35, a + w + 0.35, 0.85, 0);
    }
  }

  // set back from the sidewalk: front yard, low wall with reja, pillars and a gate
  const sb = f.setback;
  if (f.main && sb > 1.6 && sb < 12) {
    const d = sb - 0.1;
    const yard = rng() < 0.55 ? new THREE.Color(0.36, 0.5, 0.25) : new THREE.Color(0.66, 0.6, 0.55);
    solid.quad(P(0, 0.15, 0.05), P(len, 0.15, 0.05), P(len, 0.15, d - 0.15), P(0, 0.15, d - 0.15), [0, 0], [1, 0], [1, 1], [0, 1], yard, UP);
    const wallC = tint.clone().lerp(WHITE, 0.2), wallH = 0.5 + rng() * 0.3, total = wallH + 1.2;
    const gate = items.find((i) => i.kind === 'garage') || items.find((i) => i.kind === 'door') || items.find((i) => i.kind === 'portal');
    const ga = gate ? gate.a - 0.1 : -1, gb = gate ? gate.a + gate.w + 0.1 : -1;
    const pillar = (x) => box(x - 0.17, x + 0.17, 0, total + 0.1, d - 0.17, d + 0.17, wallC);
    // fence segments either side of the gate
    for (const [s0, s1] of gate ? [[0, ga], [gb, len]] : [[0, len]]) {
      if (s1 - s0 < 0.3) continue;
      box(s0, s1, 0, wallH, d - 0.1, d + 0.1, wallC);
      // reja panels are drawn at the fence line, facing the street
      const [a0, b0, a1, b1] = ATLAS.reja;
      const k = Math.max(1, Math.round((s1 - s0) / 1.4));
      for (let i = 0; i < k; i++) {
        const sa = s0 + ((s1 - s0) * i) / k, sbb = s0 + ((s1 - s0) * (i + 1)) / k;
        alpha.quad(P(sa, wallH, d), P(sbb, wallH, d), P(sbb, total, d), P(sa, total, d), [a0, b0], [a1, b0], [a1, b1], [a0, b1], WHITE, [ox, 0, oz]);
      }
      pillar(s0 + 0.17);
      pillar(s1 - 0.17);
    }
    if (gate) {
      const gc = gate.tint || GATE_TINTS[0];
      // portón / puerta de reja: bars as thin boxes, painted
      for (let x = ga + 0.05; x < gb - 0.04; x += 0.12) box(x, x + 0.03, 0.05, total - 0.05, d - 0.02, d + 0.02, gc);
      box(ga, gb, total - 0.12, total - 0.04, d - 0.03, d + 0.03, gc);
      box(ga, gb, 0.05, 0.13, d - 0.03, d + 0.03, gc);
      box(ga, gb, total * 0.5, total * 0.5 + 0.06, d - 0.03, d + 0.03, gc);
    }
  }
}

// Coping along the top of a medianera, a rain pipe down it, sometimes the yellow gas pipe.
const PVC = new THREE.Color(0.62, 0.62, 0.6), GAS = new THREE.Color(0.93, 0.74, 0.12), COPING = new THREE.Color(0.7, 0.68, 0.64);
function medRelief(solid, p0, p1, h, seed) {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (len < 1) return;
  const ux = (p1[0] - p0[0]) / len, uz = (p1[1] - p0[1]) / len;
  const rng = mulberry32(seed);
  const box = makeBox(solid, p0, ux, uz);
  box(0, len, h, h + 0.12, -0.2, 0.06, COPING);
  if (rng() < 0.4) {
    const s = 0.3 + rng() * (len - 0.6);
    box(s - 0.05, s + 0.05, 0, h + 0.05, 0.02, 0.12, PVC);
  }
  if (rng() < 0.2 && h > 5) {
    const s = 0.5 + rng() * (len - 1), y = 1.2 + rng() * (h - 3);
    box(Math.max(0, s - 2.5), Math.min(len, s + 2.5), y, y + 0.05, 0.02, 0.08, GAS);
    box(s - 0.025, s + 0.025, 0.4, y, 0.02, 0.08, GAS);
  }
}

// Box on a wall (along s0..s1, height y0..y1, out d0..d1): front, top, bottom and ends,
// written straight into the buffer (relief is thousands of these per cell; allocating
// corner arrays for each made the garbage collector stall the frame).
const V = new Float64Array(12);
function makeBox(buf, p0, ux, uz) {
  const ox = uz, oz = -ux, bx = p0[0], bz = p0[1];
  const put = (i, s, y, d) => {
    V[i] = bx + ux * s + ox * d;
    V[i + 1] = y;
    V[i + 2] = bz + uz * s + oz * d;
  };
  const face = (s0, y0, d0, s1, y1, d1, s2, y2, d2, s3, y3, d3, color, wx, wy, wz) => {
    put(0, s0, y0, d0);
    put(3, s1, y1, d1);
    put(6, s2, y2, d2);
    put(9, s3, y3, d3);
    buf.quadRaw(V, color, wx, wy, wz);
  };
  return (s0, s1, y0, y1, d0, d1, color) => {
    face(s0, y0, d1, s1, y0, d1, s1, y1, d1, s0, y1, d1, color, ox, 0, oz);
    face(s0, y1, d0, s1, y1, d0, s1, y1, d1, s0, y1, d1, color, 0, 1, 0);
    face(s0, y0, d0, s1, y0, d0, s1, y0, d1, s0, y0, d1, color, 0, -1, 0);
    face(s0, y0, d0, s0, y0, d1, s0, y1, d1, s0, y1, d0, color, -ux, 0, -uz);
    face(s1, y0, d0, s1, y0, d1, s1, y1, d1, s1, y1, d0, color, ux, 0, uz);
  };
}

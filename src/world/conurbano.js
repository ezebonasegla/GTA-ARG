// Runtime details of the conurbano built from the data computed by
// scripts/conurbano.mjs: dirt ground of the villas with laundry lines and tangled
// cables over the pasillos, descampados with dry grass, cortaderas, trash, rubble,
// car wrecks and potreros, rejas / walls / portones / alambrados on the property
// line, and wooden utility poles with their cables along every street.
import * as THREE from 'three';
import { mulberry32, hashString, pointInPolygon, bbox, polygonArea } from './geo.js';
import { GeoBuf, template } from './geobuf.js';
import { ATLAS } from './conurbanoTextures.js';
import { railing } from './buildings.js';

const SIDEWALK = 3;
const box = (w, h, d, y = h / 2) => template(new THREE.BoxGeometry(w, h, d).translate(0, y, 0));
const TPL = {
  cube: box(1, 1, 1),
  mound: template(new THREE.DodecahedronGeometry(1, 0).scale(1, 0.45, 1)),
  bag: template(new THREE.OctahedronGeometry(0.3, 0).scale(1, 0.75, 1)),
  tire: template(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 6)),
  pole: template(new THREE.CylinderGeometry(0.1, 0.15, 8.6, 5, 1, true).translate(0, 4.3, 0)),
  trafo: template(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 6)),
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function place(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const hex = (h) => new THREE.Color(h);
const COL = {
  wood: hex('#5d5246'), concrete: hex('#a39e94'), hedge: hex('#3d5a28'), dark: hex('#2a2a2a'), trafo: hex('#7d8286'),
  trash: hex('#4b4236'), rubble: hex('#8f8577'), brick: hex('#b0603c'), goal: hex('#dcdcd4'), tire: hex('#1c1c1c'),
};
const BAGS = ['#1c1c1c', '#2b2b2b', '#dcdcdc', '#3a5fa0', '#3f7a3a', '#c8b24a', '#8a2a2a', '#e0e0e0'].map(hex);
const WRECKS = ['#7a5a3c', '#8c8f94', '#4d5f7a', '#9a3a2a', '#c8c2b0', '#3d4a3a', '#b0a070'].map(hex);
const WALLS = ['#efe6d6', '#e9dcc4', '#f1efe8', '#e2d4bd', '#d9dfd9', '#efd9c6', '#dfe6ea', '#e8e0a8'].map(hex);
const GATES = ['#4a5a4a', '#2e2e2e', '#6b4a32', '#7a7f84', '#3c4f66', '#8a3b2a', '#e0e0e0', '#2f4f3f'].map(hex);

export function buildConurbano(data, { root, chunks, collision, tex, flatMat, graph, nearPasillo = () => false }) {
  const L = tex.facades.layer;
  // not on a street, sidewalk or path
  const offRoad = (x, z, pad = 0.4) => {
    const n = graph.nearest(x, z, 25);
    if (!n) return true;
    const r = n.seg.road;
    const side = r.kind === 'footway' || r.kind === 'pedestrian' || r.kind === 'service' ? 0.3 : SIDEWALK;
    return n.dist > r.w / 2 + side + pad;
  };
  const white = new THREE.Color(1, 1, 1);
  const grid = data.grid;

  // ------------------------------------------------------------ ground
  const dirtBuf = new GeoBuf(), dryBuf = new GeoBuf();
  const cellsOf = (rle) => {
    const out = [];
    for (let i = 0; i < rle.length; i += 2) for (let k = rle[i]; k < rle[i] + rle[i + 1]; k++) out.push(k);
    return out;
  };
  const corner = (i, j) => {
    const h = hashString(`${i},${j}`);
    const jx = ((h & 1023) / 1023 - 0.5) * 0.75, jz = (((h >>> 10) & 1023) / 1023 - 0.5) * 0.75;
    return [grid.x0 + (i + jx) * grid.cell, grid.z0 + (j + jz) * grid.cell];
  };
  const cellQuads = (buf, cells, y) => {
    for (const k of cells) {
      const i = k % grid.n, j = Math.floor(k / grid.n);
      const q = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
      buf.quad(...q.map(([x, z]) => [x, y, z]), ...q.map(([x, z]) => [x / 8, z / 8]), white, [0, 1, 0]);
    }
  };
  const cellCenter = (k) => [grid.x0 + ((k % grid.n) + 0.5) * grid.cell, grid.z0 + (Math.floor(k / grid.n) + 0.5) * grid.cell];

  for (const v of data.villas || []) cellQuads(dirtBuf, cellsOf(v.cells), 0.05);
  const wastes = (data.wastes || []).map((w) => ({ ...w, list: cellsOf(w.cells) }));
  for (const w of wastes) cellQuads(dryBuf, w.list, 0.05);

  // ------------------------------------------------------------ descampados
  for (const w of wastes) {
    const rng = mulberry32(hashString(`w${w.center[0]},${w.center[1]}`));
    const set = new Set(w.list);
    const edge = (k) => !(set.has(k + 1) && set.has(k - 1) && set.has(k + grid.n) && set.has(k - grid.n));
    for (const k of w.list) {
      const [cx, cz] = cellCenter(k);
      const at = () => [cx + (rng() - 0.5) * grid.cell, cz + (rng() - 0.5) * grid.cell];
      const ch = chunks.at(cx, cz);
      const border = edge(k);
      if (rng() < (w.big ? 0.45 : 0.7)) {
        const count = 1 + Math.floor(rng() * 3);
        for (let t = 0; t < count; t++) {
          const [x, z] = at();
          if (collision.isBlocked(x, z, 0.3) || !offRoad(x, z)) continue;
          const cort = rng() < 0.18;
          tuft(ch.alpha, x, z, cort ? 1.8 + rng() * 0.8 : 0.7 + rng() * 0.8, cort ? ATLAS.cortadera : ATLAS.pasto, rng);
        }
      }
      if (rng() < (border ? 0.1 : w.big ? 0.012 : 0.04)) {
        const [x, z] = at();
        if (offRoad(x, z, 1.5) && !collision.isBlocked(x, z, 1)) trashPile(ch.props, x, z, rng);
      }
      if (rng() < (w.big ? 0.008 : 0.025)) {
        const [x, z] = at();
        if (offRoad(x, z, 1.5) && !collision.isBlocked(x, z, 1)) rubble(ch.props, x, z, rng);
      }
      if (rng() < 0.03) {
        const [x, z] = at();
        if (offRoad(x, z)) ch.props.add(TPL.tire, place(x, 0.1, z, 1, 1, 1, 0, Math.PI / 2 * (rng() < 0.7 ? 1 : 0.2), rng()), COL.tire);
      }
    }
    // car wrecks
    let wrecks = (w.list.length >= 8 && rng() < 0.35 ? 1 : 0) + Math.min(2, Math.floor(w.list.length / 150));
    for (let t = 0; t < 12 && wrecks > 0; t++) {
      const [x, z] = cellCenter(w.list[Math.floor(rng() * w.list.length)]);
      if (collision.isBlocked(x, z, 3) || !offRoad(x, z, 2.5)) continue;
      carWreck(chunks.at(x, z).props, collision, x, z, rng() * Math.PI, rng);
      wrecks--;
    }
    if (w.potrero) potrero(dirtBuf, chunks.at(...w.potrero.c).props, collision, w.potrero, rng);
  }

  // tall grass on scrub / wetland / brownfield polygons too
  for (const a of data.areas) {
    if (!['scrub', 'waste', 'wetland'].includes(a.kind)) continue;
    const rng = mulberry32(hashString(`a${a.pts[0][0]},${a.pts[0][1]}`));
    const bb = bbox(a.pts);
    const count = Math.min(1500, Math.abs(polygonArea(a.pts)) / 60);
    for (let k = 0; k < count; k++) {
      const x = bb.minX + rng() * (bb.maxX - bb.minX), z = bb.minZ + rng() * (bb.maxZ - bb.minZ);
      if (!pointInPolygon(x, z, a.pts) || collision.isBlocked(x, z, 0.5) || !offRoad(x, z)) continue;
      const cort = rng() < (a.kind === 'wetland' ? 0.5 : 0.15);
      tuft(chunks.at(x, z).alpha, x, z, cort ? 1.8 + rng() * 0.8 : 0.8 + rng() * 0.9, cort ? ATLAS.cortadera : ATLAS.pasto, rng);
    }
  }

  // ------------------------------------------------------------ property line
  const types = data.fenceTypes || [];
  const f = data.fences || [];
  for (let i = 0; i < f.length; i += 5) {
    const a = [f[i], f[i + 1]], b = [f[i + 2], f[i + 3]];
    const type = types[f[i + 4]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.3) continue;
    const rng = mulberry32(hashString(`${a[0]},${a[1]},${f[i + 4]}`));
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const ch = chunks.at(mx, mz);
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    const nx = -uz, nz = ux;
    const th = 0.09;
    const A1 = [a[0] + nx * th, a[1] + nz * th], B1 = [b[0] + nx * th, b[1] + nz * th];
    const A2 = [a[0] - nx * th, a[1] - nz * th], B2 = [b[0] - nx * th, b[1] - nz * th];
    const wallPair = (h, layer, tint, tu, tv, v0) => {
      ch.facade.wall(B1, A1, 0, h, rng() * 6, tu, tv, tint, layer, v0);
      ch.facade.wall(A2, B2, 0, h, rng() * 6, tu, tv, tint, layer, v0);
      const P = (q) => [q[0], h, q[1]];
      ch.facade.quad(P(A1), P(B1), P(B2), P(A2), [0, 0.99], [len / 6, 0.99], [len / 6, 1], [0, 1], tint.clone().multiplyScalar(0.9), [0, 1, 0], layer);
    };
    let H = 1;
    const tint = WALLS[Math.floor(rng() * WALLS.length)];
    if (type === 'muro') {
      H = 1.9 + rng() * 0.5;
      const r = rng();
      wallPair(H, r < 0.2 ? L.muro0 : r < 0.55 ? L.muro1 : L.muro2, tint, 6, 3, 1 - H / 3);
    } else if (type === 'bajo' || type === 'reja') {
      H = 0.5 + rng() * 0.35;
      wallPair(H, L.medianera, tint, 6, 6, 0);
      if (type === 'reja') {
        railing(ch.alpha, a, b, H, 1.15 + rng() * 0.3, ATLAS.reja, 2.5);
        if (rng() < 0.35) for (const p of [a, b]) ch.props.add(TPL.cube, place(p[0], 0, p[1], 0.32, H + 1.35, 0.32, Math.atan2(-uz, ux)), tint.clone().multiplyScalar(0.85), 0.2);
        H += 1.3;
      }
    } else if (type === 'ligustro') {
      H = 1.2 + rng() * 0.6;
      const k = Math.max(1, Math.round(len / 5));
      for (let s = 0; s < k; s++) {
        const t = (s + 0.5) / k;
        const c = COL.hedge.clone().multiplyScalar(0.8 + rng() * 0.4);
        ch.props.add(TPL.cube, place(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t, len / k + 0.1, H + (rng() - 0.5) * 0.3, 0.7 + rng() * 0.2, Math.atan2(-uz, ux)), c, 0.4);
      }
    } else if (type === 'alambre') {
      H = 1.8;
      railing(ch.alpha, a, b, 0, H, ATLAS.alambre, 2.5);
      const k = Math.max(1, Math.round(len / 3.2));
      for (let s = 0; s <= k; s++) {
        const t = s / k;
        ch.props.add(TPL.cube, place(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t, 0.1, 1.95, 0.1, 0, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12), COL.concrete, 0.2);
      }
    } else if (type === 'porton') {
      H = 2.1 + rng() * 0.2;
      const g = GATES[Math.floor(rng() * GATES.length)];
      ch.facade.wall(B1, A1, 0, H, 0, 3, H, g, L.porton, 0);
      ch.facade.wall(A2, B2, 0, H, 0, 3, H, g, L.porton, 0);
    }
    collision.addPolygon([A1, B1, B2, A2].map(([x, z]) => [x + 0, z + 0]), H, 'fence');
  }

  // ------------------------------------------------------------ villa: pasillos
  for (const r of data.roads) {
    if (!r.pasillo) continue;
    const rng = mulberry32(hashString(`p${r.pts[0][0]},${r.pts[0][1]}`));
    // pole at the entrance with the "colgados"
    const [px, pz] = r.pts[0];
    const [qx, qz] = r.pts[1];
    const l0 = Math.hypot(qx - px, qz - pz) || 1;
    const ex = px + ((qx - px) / l0) * 1.2 - ((qz - pz) / l0) * (r.w / 2 + 0.7), ez = pz + ((qz - pz) / l0) * 1.2 + ((qx - px) / l0) * (r.w / 2 + 0.7);
    if (!collision.isBlocked(ex, ez, 0.2) && !nearPasillo(ex, ez, 0.6)) {
      const ch = chunks.at(ex, ez);
      ch.props.add(TPL.pole, place(ex, 0, ez, 0.8, 0.8, 0.8), COL.wood, 0.2);
      collision.addCircle(ex, ez, 0.15, 'pole');
      for (let k = 0; k < 3 + rng() * 4; k++) {
        const a = rng() * Math.PI * 2, d = 3 + rng() * 6;
        cable(ch.lines, [ex, 6.6 + rng() * 0.3, ez], [ex + Math.cos(a) * d, 2.8 + rng() * 1.4, ez + Math.sin(a) * d], 0.3 + rng() * 0.4);
      }
    }
    for (let s = 0; s < r.pts.length - 1; s++) {
      const a = r.pts[s], b = r.pts[s + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
      for (let t = rng() * 3; t < len; t += 3 + rng() * 5) {
        const x = a[0] + dx * t, z = a[1] + dz * t;
        const ch = chunks.at(x, z);
        const hw = r.w / 2 + 0.25;
        const ang = (rng() - 0.5) * 0.7;
        const cx = -dz * Math.cos(ang) + dx * Math.sin(ang), cz = dx * Math.cos(ang) + dz * Math.sin(ang);
        const L1 = [x - cx * hw, z - cz * hw], R1 = [x + cx * hw, z + cz * hw];
        if (rng() < 0.3) {
          // soga con ropa colgada
          const y = 2.4 + rng() * 0.4;
          cable(ch.lines, [L1[0], y, L1[1]], [R1[0], y, R1[1]], 0.08);
          const [u0, v0, u1, v1] = ATLAS.ropa;
          const du = (u1 - u0) * Math.min(1, (hw * 2) / 3);
          const us = u0 + rng() * (u1 - u0 - du);
          ch.alpha.quad([L1[0], y - 1.3, L1[1]], [R1[0], y - 1.3, R1[1]], [R1[0], y, R1[1]], [L1[0], y, L1[1]], [us, v0], [us + du, v0], [us + du, v1], [us, v1], white, [cz, 0, -cx]);
        }
        // cables enredados
        for (let k = 0; k < 1 + rng() * 3; k++) {
          const y0 = 2.8 + rng() * 1.6, y1 = 2.8 + rng() * 1.6;
          const o0 = (rng() - 0.5) * 4, o1 = (rng() - 0.5) * 4;
          cable(ch.lines, [L1[0] + dx * o0, y0, L1[1] + dz * o0], [R1[0] + dx * o1, y1, R1[1] + dz * o1], 0.15 + rng() * 0.3);
        }
        if (rng() < 0.25) {
          const y = 3 + rng();
          const side = rng() < 0.5 ? L1 : R1;
          cable(ch.lines, [side[0], y, side[1]], [side[0] + dx * 6, y + (rng() - 0.5), side[1] + dz * 6], 0.2);
        }
      }
    }
  }

  // ------------------------------------------------------------ postes de luz y cables
  for (const road of data.roads) {
    if (['footway', 'pedestrian', 'service'].includes(road.kind) || road.w > 20) continue;
    const rng = mulberry32(hashString(`c${road.pts[0][0]},${road.pts[0][1]}`));
    let prev = null;
    let next = 6 + rng() * 10;
    let dist = 0;
    for (let i = 0; i < road.pts.length - 1; i++) {
      const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.1) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const nx = dz, nz = -dx; // left side (the lamps are on the right)
      while (next < dist + len) {
        const t = next - dist;
        next += 30 + rng() * 10;
        const off = road.w / 2 + 0.45;
        const x = ax + dx * t + nx * off, z = az + dz * t + nz * off;
        if (collision.isBlocked(x, z, 0.5) || nearPasillo(x, z, 0.8)) continue;
        const ch = chunks.at(x, z);
        const lean = (rng() - 0.5) * 0.05;
        ch.props.add(TPL.pole, place(x, 0, z, 1, 1, 1, 0, lean, lean), COL.wood, 0.25);
        ch.props.add(TPL.cube, place(x, 7.9, z, 0.12, 0.12, 1.5, Math.atan2(nx, nz)), COL.wood);
        if (rng() < 0.12) ch.props.add(TPL.trafo, place(x + nx * 0.35, 6.4, z + nz * 0.35, 1, 1, 1), COL.trafo, 0.2);
        collision.addCircle(x, z, 0.18, 'pole');
        const pole = { x, z };
        if (prev && Math.hypot(prev.x - x, prev.z - z) < 70) {
          for (const [h, o] of [[8.05, 0.6], [8.05, -0.6], [7.2, 0]]) {
            cable(ch.lines, [prev.x, h, prev.z], [x, h, z], 0.35 + rng() * 0.25, [nx * o, nz * o]);
          }
        }
        // acometidas to the houses on both sides
        for (let k = 0; k < 2; k++) {
          if (rng() > 0.55) continue;
          const across = rng() < 0.5;
          const along = (rng() - 0.5) * 12;
          const lat = across ? -(road.w + SIDEWALK + 0.6) : SIDEWALK - 0.1;
          const tx = x + dx * along + nx * lat, tz = z + dz * along + nz * lat;
          const inx = across ? -nx : nx, inz = across ? -nz : nz;
          if (collision.heightAt(tx + inx * 0.8, tz + inz * 0.8) < 2.5) continue;
          cable(ch.lines, [x, 7.3, z], [tx, 3 + rng(), tz], 0.25 + rng() * 0.3);
        }
        prev = pole;
      }
      dist += len;
    }
  }

  const addFlat = (buf, mat, order) => {
    if (buf.empty) return;
    const mesh = new THREE.Mesh(buf.geometry(), mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = order;
    root.add(mesh);
  };
  addFlat(dryBuf, flatMat(tex.dryGrass, 0xe8e0c8), -8.6);
  addFlat(dirtBuf, flatMat(tex.dirt), -8.5);
}

// Sagging cable between two points (LineSegments positions), optional lateral offset.
function cable(lines, a, b, sag, off = [0, 0]) {
  const N = 6;
  let px = a[0] + off[0], py = a[1], pz = a[2] + off[1];
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const x = a[0] + (b[0] - a[0]) * t + off[0], z = a[2] + (b[2] - a[2]) * t + off[1];
    const y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t);
    lines.push(px, py, pz, x, y, z);
    px = x;
    py = y;
    pz = z;
  }
}

function tuft(alpha, x, z, h, rect, rng) {
  const [u0, v0, u1, v1] = rect;
  const w = h * (0.9 + rng() * 0.5);
  const a = rng() * Math.PI;
  const tint = new THREE.Color().setScalar(0.85 + rng() * 0.25);
  for (const r of [a, a + Math.PI / 2]) {
    const cx = Math.cos(r) * w / 2, cz = Math.sin(r) * w / 2;
    alpha.quad([x - cx, 0, z - cz], [x + cx, 0, z + cz], [x + cx, h, z + cz], [x - cx, h, z - cz], [u0, v0], [u1, v0], [u1, v1], [u0, v1], tint, [-cz, 0, cx]);
  }
}

function trashPile(props, x, z, rng) {
  const s = 0.6 + rng() * 1.1;
  props.add(TPL.mound, place(x, 0, z, s, s * (0.6 + rng() * 0.6), s * (0.7 + rng() * 0.5), rng() * 3), COL.trash.clone().multiplyScalar(0.6 + rng() * 0.5), 0.6);
  const n = 4 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = rng() * s * 1.1;
    const c = BAGS[Math.floor(rng() * BAGS.length)];
    if (rng() < 0.7) props.add(TPL.bag, place(x + Math.cos(a) * d, 0.15 + rng() * s * 0.25, z + Math.sin(a) * d, 0.8 + rng() * 0.6, 0.8 + rng() * 0.5, 0.8 + rng() * 0.6, rng() * 3), c, 0.3);
    else props.add(TPL.cube, place(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, 0.2 + rng() * 0.5, 0.05 + rng() * 0.3, 0.2 + rng() * 0.5, rng() * 3, rng() * 0.3), c, 0.2);
  }
}

function rubble(props, x, z, rng) {
  const s = 0.8 + rng() * 1.2;
  props.add(TPL.mound, place(x, 0, z, s * 1.3, s * 0.6, s, rng() * 3), COL.rubble, 0.5);
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2, d = rng() * s * 1.2;
    props.add(TPL.cube, place(x + Math.cos(a) * d, rng() * s * 0.3, z + Math.sin(a) * d, 0.33, 0.18, 0.12, rng() * 3, rng(), rng()), rng() < 0.6 ? COL.brick : COL.concrete, 0.3);
  }
}

function carWreck(props, collision, x, z, a, rng) {
  const c = WRECKS[Math.floor(rng() * WRECKS.length)].clone().lerp(new THREE.Color('#6a3f22'), 0.2 + rng() * 0.4);
  const roll = (rng() - 0.5) * 0.12;
  props.add(TPL.cube, place(x, 0.22, z, 4.1, 0.85, 1.7, a, 0, roll), c, 0.25);
  props.add(TPL.cube, place(x - Math.cos(a) * 0.25, 1.05, z + Math.sin(a) * 0.25, 2.1, 0.62, 1.5, a, 0, roll), c.clone().multiplyScalar(0.55), 0.2);
  const ca = Math.cos(a), sa = Math.sin(a);
  const pts = [[-2.1, -0.9], [2.1, -0.9], [2.1, 0.9], [-2.1, 0.9]].map(([u, v]) => [x + u * ca + v * sa, z - u * sa + v * ca]);
  collision.addPolygon(pts, 1.4, 'wreck');
}

// Potrero: bare dirt rectangle with two wooden goals.
function potrero(dirtBuf, props, collision, p, rng) {
  const [x, z] = p.c;
  const ux = Math.cos(p.a), uz = Math.sin(p.a), vx = -uz, vz = ux;
  const L = 14 + rng() * 2, W = 8 + rng() * 1.5;
  const P = (u, v) => [x + ux * u + vx * v, 0.052, z + uz * u + vz * v];
  const q = [P(-L - 1, -W), P(L + 1, -W), P(L + 1, W), P(-L - 1, W)];
  dirtBuf.quad(...q, ...q.map((c) => [c[0] / 8, c[2] / 8]), new THREE.Color(1.05, 1, 0.95), [0, 1, 0]);
  const ry = Math.atan2(-uz, ux);
  for (const s of [-1, 1]) {
    const gx = x + ux * L * s, gz = z + uz * L * s;
    for (const o of [-1.6, 1.6]) {
      const px = gx + vx * o, pz = gz + vz * o;
      props.add(TPL.cube, place(px, 0, pz, 0.1, 2, 0.1), COL.goal);
      collision.addCircle(px, pz, 0.08, 'pole');
    }
    props.add(TPL.cube, place(gx, 1.95, gz, 0.1, 0.1, 3.3, ry), COL.goal);
  }
}

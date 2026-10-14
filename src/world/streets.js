// What makes a street read as a street: raised curbs that round the corners, the
// asphalt of each junction cut to its real shape, lane markings by lane count and
// direction, stop lines, sendas peatonales and sumideros.
import * as THREE from 'three';
import { GeoBuf } from './geobuf.js';
import { offsetLine } from './metrobus.js';
import { hashString } from './geo.js';

const CELL = 220;
const CURB_H = 0.15, CURB_W = 0.18, CORNER_R = 3;
const UP = [0, 1, 0];
const WHITE = new THREE.Color(0.92, 0.92, 0.88), YELLOW = new THREE.Color(0.93, 0.72, 0.08);
const CONCRETE = new THREE.Color(0.74, 0.73, 0.7), CURB_YELLOW = new THREE.Color(0.9, 0.7, 0.1), GRATE = new THREE.Color(0.1, 0.1, 0.1);
const NO_UV = [0, 0];

const vehicular = (r) => r.kind !== 'footway' && r.kind !== 'pedestrian';
const curbed = (r) => vehicular(r) && !r.pasillo && !r.dirt && !r.ramp && (r.kind !== 'service' || r.w >= 5);
const marked = (r) => (r.kind === 'primary' || r.kind === 'secondary' || r.motorway) && !r.metro && !r.pasillo && !r.dirt && r.w >= 7;

// geometry split in square cells so each piece can be culled by distance
class Cells {
  constructor() {
    this.map = new Map();
  }
  at(x, z) {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    let b = this.map.get(k);
    if (!b) this.map.set(k, (b = new GeoBuf()));
    return b;
  }
}

// Arc-length parametrised polyline.
export class Line {
  constructor(pts) {
    this.pts = pts;
    this.d = [0];
    for (let i = 1; i < pts.length; i++) this.d.push(this.d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.d[this.d.length - 1];
  }
  // point and unit direction at distance s
  at(s) {
    const { pts, d } = this;
    let i = 1;
    while (i < d.length - 1 && d[i] < s) i++;
    const a = pts[i - 1], b = pts[i], l = d[i] - d[i - 1] || 1;
    const t = Math.max(0, Math.min(1, (s - d[i - 1]) / l));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l];
  }
  // the part between distances s0 and s1 (null when empty)
  sub(s0, s1) {
    if (s1 - s0 < 0.05) return null;
    const out = [this.at(s0).slice(0, 2)];
    for (let i = 1; i < this.pts.length - 1; i++) if (this.d[i] > s0 && this.d[i] < s1) out.push(this.pts[i]);
    out.push(this.at(s1).slice(0, 2));
    return out;
  }
}

export function buildStreets({ data, graph, plan, root, deckClip, addCulled, flatProps }) {
  const curbCells = new Cells(), markCells = new Cells();
  const patch = new GeoBuf();
  const junctions = new Set();
  const arms = new Map(); // node id -> Map(neighbour id -> arm)

  // ------------------------------------------------------------ junction shapes
  const corners = [];
  for (const node of graph.nodes) {
    const list = [];
    for (const [nb, road] of node.links) {
      if (!vehicular(road)) continue;
      const l = Math.hypot(nb.x - node.x, nb.z - node.z) || 1;
      const ux = (nb.x - node.x) / l, uz = (nb.z - node.z) / l;
      list.push({ nb, road, ux, uz, hw: road.w / 2, th: Math.atan2(uz, ux), left: 0, right: 0, clear: 0 });
    }
    if (list.length < 3) continue;
    if (plan.decks.some((d) => Math.hypot(node.x - d.x, node.z - d.z) < d.len + 10)) continue;
    list.sort((a, b) => a.th - b.th);
    const loop = [];
    for (let i = 0; i < list.length; i++) {
      const A = list[i], B = list[(i + 1) % list.length];
      let gap = B.th - A.th;
      if (gap <= 0) gap += Math.PI * 2;
      // A's left edge and B's right edge, both facing the corner between them
      const p1x = -A.uz * A.hw, p1z = A.ux * A.hw, p2x = B.uz * B.hw, p2z = -B.ux * B.hw;
      const det = B.ux * A.uz - A.ux * B.uz;
      if (gap > 2.8 || Math.abs(det) < 0.05) {
        // nearly straight on: the curb carries on through
        loop.push([node.x + p1x, node.z + p1z], [node.x + p2x, node.z + p2z]);
        continue;
      }
      const rx = p2x - p1x, rz = p2z - p1z;
      const a = Math.min(30, Math.max(0, (B.ux * rz - rx * B.uz) / det));
      const b = Math.min(30, Math.max(0, (A.ux * rz - A.uz * rx) / det));
      const R = gap < 1 ? CORNER_R * 0.5 : CORNER_R;
      A.left = a + R;
      B.right = b + R;
      A.clear = Math.max(A.clear, a);
      B.clear = Math.max(B.clear, b);
      const pi = [node.x + p1x + A.ux * (a + R), node.z + p1z + A.uz * (a + R)];
      const pj = [node.x + p2x + B.ux * (b + R), node.z + p2z + B.uz * (b + R)];
      const q = [node.x + p1x + A.ux * a, node.z + p1z + A.uz * a];
      const arc = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6, s = 1 - t;
        arc.push([s * s * pi[0] + 2 * s * t * q[0] + t * t * pj[0], s * s * pi[1] + 2 * s * t * q[1] + t * t * pj[1]]);
      }
      loop.push(...arc);
      if (curbed(A.road) && curbed(B.road)) corners.push({ arc, A, B, node });
    }
    // the junction's asphalt: a fan over the corner arcs
    for (let k = 0; k < loop.length; k++) {
      const p = loop[k], q = loop[(k + 1) % loop.length];
      const c = [node.x, 0.07, node.z], a = [p[0], 0.07, p[1]], b = [q[0], 0.07, q[1]];
      patch.tri(c, a, b, [c[0] / 12, c[2] / 12], [a[0] / 12, a[2] / 12], [b[0] / 12, b[2] / 12], WHITE, UP);
    }
    junctions.add(node.id);
    arms.set(node.id, new Map(list.map((A) => [A.nb.id, A])));
  }

  const nodeAt = ([x, z]) => graph.byKey.get(`${Math.round(x * 2)},${Math.round(z * 2)}`);
  const armAt = (p, next) => {
    const n = nodeAt(p), nb = nodeAt(next);
    return n && nb ? arms.get(n.id)?.get(nb.id) : undefined;
  };

  // ------------------------------------------------------------ curbs
  // a bevelled concrete kerb along a polyline: top plus both faces
  function curb(pts, color) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 0.01) continue;
      const nx = (-(bz - az) / l) * CURB_W / 2, nz = ((bx - ax) / l) * CURB_W / 2;
      const buf = curbCells.at((ax + bx) / 2, (az + bz) / 2);
      const top = (s, y) => [[ax + nx * s, y, az + nz * s], [bx + nx * s, y, bz + nz * s]];
      const [a1, b1] = top(1, CURB_H), [a0, b0] = top(-1, CURB_H), [a1d, b1d] = top(1.25, 0.04), [a0d, b0d] = top(-1.25, 0.04);
      const v = l / 2;
      buf.quad(a0, a1, b1, b0, [0, 0], [1, 0], [1, v], [0, v], color, UP);
      buf.quad(a1d, a1, b1, b1d, [0, 0], [1, 0], [1, v], [0, v], color, [nx, 0.3, nz]);
      buf.quad(a0d, a0, b0, b0d, [0, 0], [1, 0], [1, v], [0, v], color, [-nx, 0.3, -nz]);
    }
  }
  const YELLOW_LEN = 5;
  function curbRun(pts, yellowStart, yellowEnd) {
    const line = new Line(pts);
    const y0 = yellowStart ? Math.min(YELLOW_LEN, line.len / 2) : 0, y1 = yellowEnd ? Math.min(YELLOW_LEN, line.len / 2) : 0;
    if (y0) curb(line.sub(0, y0) || [], CURB_YELLOW);
    const mid = line.sub(y0, line.len - y1);
    if (mid) curb(mid, CONCRETE);
    if (y1) curb(line.sub(line.len - y1, line.len) || [], CURB_YELLOW);
  }
  for (const c of corners) curb(c.arc, c.A.road.kind === 'service' || c.B.road.kind === 'service' ? CONCRETE : CURB_YELLOW);

  // ------------------------------------------------------------ markings
  // a stripe along the centreline from s0 to s1, `off` metres to its left
  function stripe(buf, line, s0, s1, off, w, color) {
    for (let s = s0; s < s1 - 0.01; s += 4) {
      const e = Math.min(s1, s + 4);
      const [ax, az, adx, adz] = line.at(s), [bx, bz, bdx, bdz] = line.at(e);
      const q = (x, z, dx, dz, o) => [x - dz * o, 0.075, z + dx * o];
      (buf || markCells.at(ax, az)).quad(
        q(ax, az, adx, adz, off - w / 2), q(ax, az, adx, adz, off + w / 2), q(bx, bz, bdx, bdz, off + w / 2), q(bx, bz, bdx, bdz, off - w / 2),
        NO_UV, NO_UV, NO_UV, NO_UV, color, UP);
    }
  }
  function dashed(line, s0, s1, off, w, color, dash = 3, gap = 5) {
    for (let s = s0; s < s1; s += dash + gap) stripe(null, line, s, Math.min(s1, s + dash), off, w, color);
  }
  // senda peatonal: bars along the road, `at` metres from the start of the line
  function zebra(line, at, hw) {
    const [x, z, dx, dz] = line.at(at);
    const buf = markCells.at(x, z);
    for (let o = -hw + 0.5; o < hw - 0.4; o += 1) {
      const p = (s, oo) => [x + dx * s - dz * oo, 0.075, z + dz * s + dx * oo];
      buf.quad(p(-1.5, o), p(-1.5, o + 0.5), p(1.5, o + 0.5), p(1.5, o), NO_UV, NO_UV, NO_UV, NO_UV, WHITE, UP);
    }
  }
  function markRun(road, line, start, end) {
    const hw = road.w / 2, len = line.len;
    const sendas = marked(road) || road.kind === 'tertiary' || (road.kind === 'residential' && hashString(`${line.pts[0]}`) % 3 === 0);
    const c0 = start ? start.clear + 5.5 : 0, c1 = end ? end.clear + 5.5 : 0;
    if (len - c0 - c1 < 4) return;
    if (start && sendas) zebra(line, start.clear + 2, hw);
    if (end && sendas) zebra(line, len - end.clear - 2, hw);
    if (!marked(road)) return;
    const s0 = c0, s1 = len - c1;
    if (road.oneway) {
      const n = Math.max(1, Math.floor(road.w / 3.1));
      for (let k = 1; k < n; k++) dashed(line, s0, s1, -hw + (k * road.w) / n, 0.12, WHITE);
      if (end) stripe(null, line, len - end.clear - 4.7, len - end.clear - 4.3, 0, road.w - 0.4, WHITE);
    } else {
      const n = Math.max(1, Math.floor(hw / 3.1));
      if (road.w >= 14) for (const o of [-0.13, 0.13]) stripe(null, line, s0, s1, o, 0.1, YELLOW);
      else dashed(line, s0, s1, 0, 0.12, YELLOW, 4, 4);
      for (let k = 1; k < n; k++) for (const sd of [-1, 1]) dashed(line, s0, s1, (sd * k * hw) / n, 0.12, WHITE);
      // stop lines across the lanes that arrive at each end (traffic keeps right)
      if (end) stripe(null, line, len - end.clear - 4.7, len - end.clear - 4.3, -hw / 2, hw - 0.3, WHITE);
      if (start) stripe(null, line, start.clear + 4.3, start.clear + 4.7, hw / 2, hw - 0.3, WHITE);
    }
  }

  // ------------------------------------------------------------ runs between junctions
  const grates = [];
  for (const whole of data.roads) {
    if (!vehicular(whole) || whole.pasillo || whole.dirt) continue;
    for (const pts of deckClip(whole)) {
      let from = 0;
      for (let i = 1; i < pts.length; i++) {
        if (i < pts.length - 1 && !junctions.has(nodeAt(pts[i])?.id)) continue;
        const run = pts.slice(from, i + 1);
        from = i;
        const start = armAt(run[0], run[1]), end = armAt(run[run.length - 1], run[run.length - 2]);
        const hw = whole.w / 2;
        if (curbed(whole)) {
          for (const side of [1, -1]) {
            const line = new Line(offsetLine(run, side * hw));
            const t0 = start ? (side > 0 ? start.left : start.right) : 0;
            const t1 = end ? (side > 0 ? end.right : end.left) : 0;
            const part = line.sub(t0, line.len - t1);
            if (!part) continue;
            const paint = whole.kind !== 'service';
            curbRun(part, paint && !!start, paint && !!end);
            // sumidero next to the curb, just past the corner
            const h = hashString(`${run[0]}${side}`);
            if (start && h % 3 === 0 && line.len - t0 - t1 > 8) {
              const [x, z, dx, dz] = line.at(t0 + 1.5);
              grates.push([x + dz * side * 0.45, z - dx * side * 0.45, Math.atan2(dx, dz)]);
            }
          }
        }
        markRun(whole, new Line(run), start, end);
      }
    }
  }
  for (const [x, z, a] of grates) {
    const buf = markCells.at(x, z);
    const s = Math.sin(a), c = Math.cos(a);
    const p = (u, v) => [x + s * u + c * v, 0.076, z + c * u - s * v];
    buf.quad(p(-0.5, -0.22), p(-0.5, 0.22), p(0.5, 0.22), p(0.5, -0.22), NO_UV, NO_UV, NO_UV, NO_UV, GRATE, UP);
  }

  // ------------------------------------------------------------ meshes
  const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, ...flatProps.stencil });
  for (const buf of curbCells.map.values()) {
    const mesh = new THREE.Mesh(buf.geometry(), curbMat);
    mesh.receiveShadow = true;
    root.add(mesh);
    addCulled(mesh, 450);
  }
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, depthWrite: false, ...flatProps.stencil });
  for (const buf of markCells.map.values()) {
    const mesh = new THREE.Mesh(buf.geometry(), markMat);
    mesh.receiveShadow = true;
    mesh.renderOrder = -5.8;
    root.add(mesh);
    addCulled(mesh, 380);
  }
  return { patch, junctions };
}

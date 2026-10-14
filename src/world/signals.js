// Semáforos: where avenues cross each other, and where an avenue crosses a street in the
// centres of Quilmes and Bernal. Each crossing runs a two-phase cycle (green, amber,
// all-red) shared by the nodes of a dual carriageway; NPC cars and colectivos stop at
// the stop line on amber and red.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SpatialHash } from './geo.js';

const CYCLE = 48, GREEN = 19, AMBER = 3; // seconds; the rest of each half is all-red
const CELL = 220;
const MAJOR = (r) => r.kind === 'primary' || r.kind === 'secondary' || r.kind === 'trunk';
const LENS = [new THREE.Color(1, 0.12, 0.08), new THREE.Color(1, 0.62, 0.05), new THREE.Color(0.15, 1, 0.45)];
const OFF = LENS.map((c) => c.clone().multiplyScalar(0.06));

// 0 red, 1 amber, 2 green for phase group g of a crossing at time t
function lightOf(t, offset, g) {
  let tt = (t + offset + g * (CYCLE / 2)) % CYCLE;
  if (tt < GREEN) return 2;
  if (tt < GREEN + AMBER) return 1;
  return 0;
}

export function buildSignals({ graph, arms, centres, root, collision, addCulled, keepOut }) {
  // ------------------------------------------------------------ which junctions
  const chosen = [];
  for (const node of graph.nodes) {
    const list = arms.get(node.id);
    if (!list) continue;
    const roads = new Set([...list.values()].map((A) => A.road));
    const majors = [...roads].filter(MAJOR);
    const names = new Set(majors.map((r) => r.name || r));
    const central = centres.some(([x, z]) => Math.hypot(node.x - x, node.z - z) < 700);
    if (names.size >= 2 || (majors.length && roads.size > majors.length && central)) chosen.push(node);
  }
  // nodes of the same crossing (dual carriageways, offset streets) share one controller
  const crossings = [];
  const near = new SpatialHash(40);
  for (const node of chosen) {
    let cr = null;
    for (const o of near.query(node.x - 30, node.z - 30, node.x + 30, node.z + 30)) if (Math.hypot(o.x - node.x, o.z - node.z) < 30) cr = o.cr;
    if (!cr) {
      // phase axis: along the widest arm
      let best = null;
      for (const A of arms.get(node.id).values()) if (!best || A.road.w > best.road.w) best = A;
      cr = { ax: best.ux, az: best.uz, offset: ((node.id * 2654435761) >>> 0) % CYCLE };
      crossings.push(cr);
    }
    node.signal = cr;
    near.insert({ x: node.x, z: node.z, cr }, { minX: node.x, minZ: node.z, maxX: node.x, maxZ: node.z });
  }

  // ------------------------------------------------------------ approaches
  // one per arm that traffic drives in on: stop line, phase group, the heads to light
  const approaches = [];
  const index = new SpatialHash(40);
  for (const node of chosen) {
    for (const A of arms.get(node.id).values()) {
      if (A.road.kind === 'service') continue;
      const inbound = A.nb.out.some((e) => e.b === node);
      if (!inbound) continue;
      const g = Math.abs(A.ux * node.signal.ax + A.uz * node.signal.az) >= 0.707 ? 0 : 1;
      const stop = A.clear + 4.8;
      const ap = { node, A, g, cr: node.signal, x: node.x + A.ux * stop, z: node.z + A.uz * stop };
      approaches.push(ap);
      index.insert(ap, { minX: ap.x - A.hw, minZ: ap.z - A.hw, maxX: ap.x + A.hw, maxZ: ap.z + A.hw });
    }
  }

  // ------------------------------------------------------------ poles and heads
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const poleMat = mat(0x2b2f31, { metalness: 0.5 }), housingMat = mat(0x151515), plateMat = mat(0xd9b21c);
  const cells = new Map(); // key -> { parts: Map(material -> [geometries]), lenses: [] }
  const cellAt = (x, z) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!cells.has(k)) cells.set(k, { parts: new Map(), lenses: [] });
    return cells.get(k);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const place = (cell, geo, material, x, y, z, a) => {
    const g = geo.clone().applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, a), one));
    if (!cell.parts.has(material)) cell.parts.set(material, []);
    cell.parts.get(material).push(g);
  };
  const strip = (g) => {
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    return g.index ? g.toNonIndexed() : g;
  };
  const poleG = strip(new THREE.CylinderGeometry(0.07, 0.09, 1, 8).translate(0, 0.5, 0));
  const housingG = strip(new THREE.BoxGeometry(0.34, 1.0, 0.24));
  const plateG = strip(new THREE.BoxGeometry(0.56, 1.22, 0.03));
  const visorG = strip(new THREE.BoxGeometry(0.28, 0.03, 0.18));
  const armG = strip(new THREE.CylinderGeometry(0.05, 0.05, 1, 6).rotateZ(Math.PI / 2));
  // a head facing +z (towards the approaching drivers) at (x, y, z), lenses top to bottom
  function head(cell, ap, x, y, z, a) {
    place(cell, plateG, plateMat, x - Math.sin(a) * 0.14, y, z - Math.cos(a) * 0.14, a);
    place(cell, housingG, housingMat, x, y, z, a);
    for (let k = 0; k < 3; k++) {
      const ly = y + 0.3 - k * 0.3;
      place(cell, visorG, housingMat, x + Math.sin(a) * 0.2, ly + 0.13, z + Math.cos(a) * 0.2, a);
      cell.lenses.push({ ap, color: k === 0 ? 0 : k === 1 ? 1 : 2, x: x + Math.sin(a) * 0.125, y: ly, z: z + Math.cos(a) * 0.125, a });
    }
  }
  for (const ap of approaches) {
    const { node, A } = ap;
    const rx = -A.uz, rz = A.ux; // the approaching driver's right
    const s = A.clear + 1.5, o = A.hw + 0.8;
    const px = node.x + A.ux * s + rx * o, pz = node.z + A.uz * s + rz * o;
    if (collision.isBlocked(px, pz, 0.3)) continue;
    const cell = cellAt(px, pz);
    const a = Math.atan2(A.ux, A.uz);
    const tall = A.road.w >= 12;
    const ph = tall ? 6 : 3.9;
    place(cell, poleG.clone().scale(1, ph, 1), poleMat, px, 0, pz, 0);
    head(cell, ap, px + Math.sin(a) * 0.15, 3.0, pz + Math.cos(a) * 0.15, a);
    if (tall) {
      // pescante: an arm over the lanes with a second head hanging from it
      const len = Math.min(A.hw + 0.4, 6);
      const mx = px - rx * len / 2, mz = pz - rz * len / 2;
      const arm = armG.clone().scale(len, 1, 1);
      place(cell, arm, poleMat, mx, ph - 0.25, mz, Math.atan2(-rz, rx) + 0 * a);
      head(cell, ap, px - rx * len, ph - 1.0, pz - rz * len, a);
    }
    ap.pole = [px, pz];
    collision.addCircle(px, pz, 0.15, 'prop');
    keepOut.push([px, pz, 1.2]);
  }

  // ------------------------------------------------------------ meshes
  const lensG = new THREE.CircleGeometry(0.105, 12);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lensMeshes = [];
  for (const cell of cells.values()) {
    for (const [material, geos] of cell.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      addCulled(mesh, 450);
    }
    const lm = new THREE.InstancedMesh(lensG, lensMat, cell.lenses.length);
    cell.lenses.forEach((l, i) => {
      lm.setMatrixAt(i, m4.compose(new THREE.Vector3(l.x, l.y, l.z), q.setFromAxisAngle(Y, l.a), one));
      lm.setColorAt(i, OFF[l.color]);
    });
    lm.computeBoundingSphere();
    lm.userData.lenses = cell.lenses;
    lm.userData.dynamic = true; // its colours change: keep the CPU copy
    root.add(lm);
    addCulled(lm, 450);
    lensMeshes.push(lm);
  }

  let t = 0, refresh = 0;
  const hits = new Set();
  return {
    count: crossings.length,
    approaches,
    // advance the clock; relight the visible heads a few times a second
    update(dt) {
      t += dt;
      if ((refresh -= dt) > 0) return;
      refresh = 0.25;
      for (const lm of lensMeshes) {
        if (!lm.visible) continue;
        lm.userData.lenses.forEach((l, i) => {
          const on = lightOf(t, l.ap.cr.offset, l.ap.g) === l.color;
          lm.setColorAt(i, on ? LENS[l.color] : OFF[l.color]);
        });
        lm.instanceColor.needsUpdate = true;
      }
    },
    // Distance from (x, z), heading (fx, fz), to the stop line of a light that says stop
    // (Infinity if none within range). Amber only stops a car that still can at `speed`.
    stopAhead(x, z, fx, fz, range, speed = 0) {
      let best = Infinity;
      hits.clear(); // reused: called for every car every frame
      for (const ap of index.query(x - range, z - range, x + range, z + range, hits)) {
        // heading into the crossing along this arm
        if (fx * -ap.A.ux + fz * -ap.A.uz < 0.75) continue;
        const rx = ap.x - x, rz = ap.z - z;
        const along = rx * fx + rz * fz;
        if (along < -1 || along > range) continue;
        if (Math.abs(rx * fz - rz * fx) > ap.A.hw + 1) continue;
        const light = lightOf(t, ap.cr.offset, ap.g);
        if (light === 2) continue;
        if (light === 1 && along < speed * speed / 8 + 2) continue; // too close to stop: go
        best = Math.min(best, along);
      }
      return best;
    },
  };
}

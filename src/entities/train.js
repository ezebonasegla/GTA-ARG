// Línea Roca: electric trains running along the real tracks, stopping at stations.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CAR_LEN = 20, GAP = 0.8, CARS = 6, WIDTH = 2.9;
const CRUISE = 17, DWELL = 18;

function carMesh(front) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.4, metalness: 0.3 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d4fa0, roughness: 0.4 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x2ea8e0, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18222b, roughness: 0.1, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 });
  const parts = new Map();
  const add = (mat, w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(g);
  };
  add(white, WIDTH, 2.9, CAR_LEN, 0, 2.55, 0);
  add(glass, WIDTH + 0.04, 0.9, CAR_LEN - 3, 0, 2.9, 0);
  add(blue, WIDTH + 0.05, 0.28, CAR_LEN, 0, 2.2, 0);
  add(cyan, WIDTH + 0.05, 0.12, CAR_LEN, 0, 1.95, 0);
  add(dark, WIDTH - 0.3, 0.5, CAR_LEN - 1, 0, 0.85, 0);
  for (const z of [-CAR_LEN / 2 + 3, CAR_LEN / 2 - 3]) for (const side of [-1, 1]) add(dark, 0.08, 2.1, 1.3, side * (WIDTH / 2 + 0.02), 2.25, z);
  add(dark, 0.3, 0.4, 0.3, 0, 4.2, 0); // pantograph base
  if (front) {
    add(glass, WIDTH - 0.3, 1.2, 0.1, 0, 3.1, CAR_LEN / 2 + 0.02);
    add(blue, WIDTH, 0.6, 0.12, 0, 1.9, CAR_LEN / 2 + 0.03);
    add(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1 }), 0.4, 0.2, 0.08, -0.9, 1.6, CAR_LEN / 2 + 0.06);
    add(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1 }), 0.4, 0.2, 0.08, 0.9, 1.6, CAR_LEN / 2 + 0.06);
  }
  const g = new THREE.Group();
  for (const [mat, geos] of parts) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

class Track {
  constructor(pts) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(s) {
    s = Math.max(0, Math.min(this.length, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = this.pts[lo], b = this.pts[hi];
    const seg = this.cum[hi] - this.cum[lo] || 1;
    const t = (s - this.cum[lo]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg };
  }
  project(x, z) {
    let best = Infinity, bs = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const [ax, az] = this.pts[i], [bx, bz] = this.pts[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
      if (d < best) {
        best = d;
        bs = this.cum[i] + Math.sqrt(l2) * t;
      }
    }
    return { s: bs, d: Math.sqrt(best) };
  }
}

export class Trains {
  constructor(scene, data) {
    this.trains = [];
    const rails = (data.rails || []).map((r) => new Track(r.pts)).filter((t) => t.length > 800).sort((a, b) => b.length - a.length).slice(0, 2);
    const stations = (data.specials || []).filter((s) => s.type === 'station');
    rails.forEach((track, i) => {
      const stops = stations.map((st) => track.project(st.cx, st.cz)).filter((p) => p.d < 25).map((p) => p.s).sort((a, b) => a - b);
      const cars = [];
      for (let c = 0; c < CARS; c++) {
        const m = carMesh(c === 0 || c === CARS - 1);
        if (c === CARS - 1) m.rotation.y = Math.PI; // rear cab faces backwards
        const holder = new THREE.Group();
        holder.add(m);
        scene.add(holder);
        cars.push(holder);
      }
      const dir = i % 2 ? -1 : 1;
      this.trains.push({ track, stops, cars, dir, s: i % 2 ? track.length * 0.7 : track.length * 0.2, v: CRUISE, wait: 0 });
    });
  }

  // Returns the list of car boxes for collisions: { x, z, dx, dz, hl, hw, vx, vz }.
  update(dt) {
    const boxes = [];
    for (const tr of this.trains) {
      const total = CARS * (CAR_LEN + GAP);
      if (tr.wait > 0) {
        tr.wait -= dt;
        tr.v = 0;
      } else {
        // next stop ahead in the running direction
        const ahead = tr.stops.map((s) => (s - tr.s) * tr.dir).filter((d) => d > 1).sort((a, b) => a - b)[0];
        const toEnd = tr.dir > 0 ? tr.track.length - tr.s : tr.s - total;
        const brakeDist = Math.min(ahead ?? Infinity, toEnd);
        const target = brakeDist < 120 ? Math.max(1.5, Math.sqrt(2 * 1.1 * Math.max(0, brakeDist))) : CRUISE;
        tr.v += Math.sign(target - tr.v) * Math.min(Math.abs(target - tr.v), 1.1 * dt);
        tr.s += tr.dir * tr.v * dt;
        if (ahead !== undefined && ahead < 1.5) {
          tr.wait = DWELL;
          tr.s = tr.stops.find((s) => Math.abs(s - tr.s) < 2) ?? tr.s;
        }
        if (toEnd < 1) {
          // end of the modelled line: reverse
          tr.dir = -tr.dir;
          tr.s = tr.dir > 0 ? tr.s - total : tr.s + total;
          tr.wait = DWELL;
        }
      }
      tr.cars.forEach((car, c) => {
        const s = tr.s - tr.dir * (c * (CAR_LEN + GAP) + CAR_LEN / 2);
        const p = tr.track.at(s);
        const dx = p.dx * tr.dir, dz = p.dz * tr.dir;
        car.position.set(p.x, 0, p.z);
        car.rotation.y = Math.atan2(dx, dz);
        boxes.push({ x: p.x, z: p.z, dx, dz, hl: CAR_LEN / 2, hw: WIDTH / 2, vx: dx * tr.v, vz: dz * tr.v });
      });
    }
    return boxes;
  }
}

// Is a circle overlapping a train car box? Returns the push-out normal or null.
export function trainHit(box, x, z, r) {
  const rx = x - box.x, rz = z - box.z;
  const along = rx * box.dx + rz * box.dz;
  const side = rx * -box.dz + rz * box.dx;
  if (Math.abs(along) > box.hl + r || Math.abs(side) > box.hw + r) return null;
  const s = Math.sign(side) || 1;
  return { nx: -box.dz * s, nz: box.dx * s, push: box.hw + r - Math.abs(side) };
}

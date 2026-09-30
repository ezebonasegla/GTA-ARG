// Real colectivo lines (official AMBA GTFS, see scripts/fetch_buses.py): buses
// drive their real routes, stop at their real stops, and every parada has a pole.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Vehicle } from './vehicle.js';

const MAX_BUSES = 9;
const SPAWN_MIN = 120, SPAWN_MAX = 320, DESPAWN = 420;
const DWELL = 7;
const LANE = 2.3; // meters to the right of the route line
const CHUNK = 250;

// Livery per company (the GTFS has no colors; these are representative).
const LIVERIES = [0xd1302f, 0x1d4fa0, 0xf2b705, 0x2f8f4e, 0xe36b1e, 0x7a2d8c, 0x0e8c8c, 0xc2185b, 0x5d6d7e, 0x8e5a2b];
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

class Path {
  constructor(pts) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(s, lane = 0) {
    s = Math.max(0, Math.min(this.length - 0.01, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = this.pts[lo], b = this.pts[hi];
    const seg = this.cum[hi] - this.cum[lo] || 1;
    const t = (s - this.cum[lo]) / seg;
    const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
    // right-hand side of the direction of travel is (-dz, dx)
    return { x: a[0] + (b[0] - a[0]) * t - dz * lane, z: a[1] + (b[1] - a[1]) * t + dx * lane, dx, dz };
  }
  // distance along the path of the point closest to (x, z), searching near s0
  project(x, z, s0 = null, window = 80) {
    let best = Infinity, bs = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      if (s0 !== null && (this.cum[i + 1] < s0 - window || this.cum[i] > s0 + window)) continue;
      const [ax, az] = this.pts[i], [bx, bz] = this.pts[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = (ax + dx * u - x) ** 2 + (az + dz * u - z) ** 2;
      if (d < best) {
        best = d;
        bs = this.cum[i] + Math.sqrt(l2) * u;
      }
    }
    return { s: bs, d: Math.sqrt(best) };
  }
}

function ledSign(text, w = 512, h = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffb000';
  ctx.font = 'bold 40px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, h / 2 + 2, w - 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 });
}

export class Buses {
  constructor(scene, busData, { collision, traffic, graph }) {
    this.scene = scene;
    this.graph = graph;
    this.traffic = traffic;
    this.collision = collision;
    this.routes = busData.routes.map((r) => ({ ...r, pathObj: new Path(r.path) }));
    this.stops = busData.stops;
    this.list = [];
    this.spawnTimer = 0;
    this.buildStops();
  }

  // Parada poles: a green pole with the blue "PARADA" plate, merged per chunk.
  buildStops() {
    const plate = (() => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 160;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1d4fa0';
      ctx.fillRect(0, 0, 128, 160);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PARADA', 64, 34);
      // bus pictogram
      ctx.fillRect(28, 56, 72, 48);
      ctx.fillStyle = '#1d4fa0';
      ctx.fillRect(34, 62, 60, 18);
      ctx.beginPath();
      ctx.arc(44, 108, 8, 0, Math.PI * 2);
      ctx.arc(84, 108, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText('COLECTIVOS', 64, 146);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.6, metalness: 0.4 });
    const plateMat = new THREE.MeshStandardMaterial({ map: plate, roughness: 0.6, side: THREE.DoubleSide });
    const groups = new Map();
    for (const st of this.stops) {
      const key = `${Math.floor(st.x / CHUNK)},${Math.floor(st.z / CHUNK)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(st);
    }
    for (const list of groups.values()) {
      const poles = [], plates = [];
      for (const st of list) {
        // stand the pole at the curb, facing the street it serves
        const r = this.routes.find((r) => r.stops.some((s) => s.id === st.id));
        const p = r ? r.pathObj.at(r.stops.find((s) => s.id === st.id).s, LANE + 3.2) : { x: st.x, z: st.z, dx: 1, dz: 0 };
        st.px = p.x;
        st.pz = p.z;
        const yaw = Math.atan2(p.dx, p.dz);
        const pole = new THREE.CylinderGeometry(0.05, 0.06, 2.7, 6);
        pole.translate(0, 1.35, 0);
        pole.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, 0, p.z));
        poles.push(pole);
        const pl = new THREE.PlaneGeometry(0.5, 0.62);
        pl.translate(0.28, 2.35, 0);
        pl.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, 0, p.z));
        plates.push(pl);
        this.collision.addCircle(p.x, p.z, 0.12, 'pole');
      }
      const pm = new THREE.Mesh(mergeGeometries(poles), poleMat);
      pm.castShadow = true;
      const lm = new THREE.Mesh(mergeGeometries(plates), plateMat);
      this.scene.add(pm, lm);
    }
  }

  nearestStop(x, z, maxD = 10) {
    let best = null, bd = maxD;
    for (const st of this.stops) {
      const d = Math.hypot((st.px ?? st.x) - x, (st.pz ?? st.z) - z);
      if (d < bd) {
        bd = d;
        best = st;
      }
    }
    return best;
  }

  spawn(px, pz, rng) {
    for (let tries = 0; tries < 12; tries++) {
      const r = this.routes[Math.floor(rng() * this.routes.length)];
      const pth = r.pathObj;
      const near = pth.project(px, pz);
      if (near.d > SPAWN_MAX) continue;
      // start somewhere behind or ahead of the player along the route, off screen
      const s = near.s + (rng() < 0.5 ? -1 : 1) * (SPAWN_MIN + rng() * (SPAWN_MAX - SPAWN_MIN - near.d));
      if (s < 5 || s > pth.length - 30) continue;
      const p = pth.at(s, LANE);
      if (Math.hypot(p.x - px, p.z - pz) < SPAWN_MIN * 0.8) continue;
      if (this.traffic.vehicles.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < 15)) continue;
      const color = LIVERIES[hash(r.agency || r.line) % LIVERIES.length];
      const v = new Vehicle('bus', p.x, p.z, Math.atan2(p.dx, p.dz), color);
      v.driver = 'bus';
      v.managed = true;
      v.vx = p.dx * 6;
      v.vz = p.dz * 6;
      this.decorate(v, r);
      this.traffic.add(v);
      const nextStop = r.stops.findIndex((st) => st.s > s + 5);
      this.list.push({ v, r, s, nextStop, wait: 0, stuck: 0 });
      return;
    }
  }

  // Front route sign with line number and destination, side sign and rear number.
  decorate(v, r) {
    const { length: L, width: W, height: H } = v.spec;
    // "Ramal Rojo - VUELTA" -> "Ramal Rojo"; "A - a Retiro" -> "a Retiro"
    let dest = r.headsign.trim();
    const ramal = dest.match(/^(.*?)\s*-\s*(ida|vuelta)$/i);
    if (ramal) dest = ramal[1];
    else dest = dest.replace(/^[A-Z0-9]{1,3}\s*-\s*/, '');
    if (!dest || /^(ida|vuelta)$/i.test(dest)) dest = r.name;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, 0.42), ledSign(`${r.line}  ${dest.toUpperCase()}`));
    front.position.set(0, H - 0.3, L / 2 + 0.07);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.34), ledSign(`${r.line} ${dest.toUpperCase()}`, 384, 64));
    side.position.set(-W / 2 - 0.03, H - 0.75, L / 2 - 2.2);
    side.rotation.y = -Math.PI / 2;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), ledSign(r.line, 128, 64));
    back.position.set(0, H - 0.35, -L / 2 - 0.07);
    back.rotation.y = Math.PI;
    v.mesh.add(front, side, back);
    v.busLine = r.line;
    v.busHeadsign = dest;
  }

  release(b) {
    b.v.managed = false;
    this.list.splice(this.list.indexOf(b), 1);
  }

  update(dt, ctx, rng) {
    const { px, pz } = ctx;
    for (const b of [...this.list]) {
      const v = b.v;
      if (!this.traffic.vehicles.includes(v)) {
        this.list.splice(this.list.indexOf(b), 1);
        continue;
      }
      if (v.driver !== 'bus') {
        this.release(b); // stolen by the player
        continue;
      }
      if (Math.hypot(v.x - px, v.z - pz) > DESPAWN || b.s > b.r.pathObj.length - 8) {
        this.traffic.remove(v);
        this.list.splice(this.list.indexOf(b), 1);
        continue;
      }
      this.drive(b, dt, ctx);
    }
    this.spawnTimer -= dt;
    if (this.list.length < MAX_BUSES && this.spawnTimer <= 0) {
      this.spawn(px, pz, rng);
      this.spawnTimer = 1.5;
    }
  }

  drive(b, dt, ctx) {
    const v = b.v, pth = b.r.pathObj;
    const pr = pth.project(v.x, v.z, b.s, 60);
    b.s = Math.max(b.s, pr.s);
    if (pr.d > 30 || v.health <= 0) {
      // knocked off its route: it becomes an abandoned bus
      v.driver = null;
      this.release(b);
      return;
    }
    const speed = Math.max(0, v.speed);
    const look = 7 + speed * 0.6;
    // lane: right-hand lane of the street under the bus (narrow one-way streets
    // have parked cars along the curb), or the center while overtaking a blockage
    const road = this.graph?.nearest(v.x, v.z, 20)?.seg.road;
    let lane = road ? (road.oneway ? road.w * 0.12 : Math.min(LANE, road.w * 0.25)) : LANE;
    if (b.overtake > 0) {
      b.overtake -= dt;
      lane = 0;
    }
    const t = pth.at(b.s + look, lane);
    let diff = Math.atan2(t.x - v.x, t.z - v.z) - v.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // slow down for bends
    const ahead = pth.at(b.s + 25), here = pth.at(b.s);
    const bend = Math.acos(Math.max(-1, Math.min(1, ahead.dx * here.dx + ahead.dz * here.dz)));
    let target = bend > 0.5 ? 5 : 11;
    // next stop
    const stop = b.r.stops[b.nextStop];
    if (b.wait > 0) {
      b.wait -= dt;
      target = 0;
      if (b.wait <= 0) b.nextStop++;
    } else if (stop) {
      const toStop = stop.s - b.s;
      if (toStop < -3) b.nextStop++;
      else if (toStop < 2.5) {
        b.wait = DWELL;
        target = 0;
      } else if (toStop < 45) target = Math.min(target, Math.max(1.5, toStop * 0.35));
    }
    const obst = this.traffic.obstacleAhead(v, ctx, 8 + speed * 1.5 + v.spec.length / 2);
    if (obst < Infinity) target = Math.min(target, Math.max(0, (obst - v.spec.length / 2 - 3) * 0.6));
    // stuck behind something (not at a stop): honk-wait, then go around it
    if (b.wait <= 0 && speed < 0.5 && target < 1) b.stuck += dt;
    else b.stuck = Math.max(0, b.stuck - dt);
    if (b.stuck > 6) {
      b.stuck = 0;
      b.overtake = 8;
    }
    if (b.overtake > 0 && obst < Infinity) target = Math.max(target, 3);
    const err = target - speed;
    v.update(dt, {
      throttle: err > 0.3 ? Math.min(1, err * 0.3) : 0,
      brake: err < -0.4 && speed > 0.6 ? Math.min(1, -err * 0.3) : 0,
      handbrake: target === 0 && speed < 1.5, // hold still without rolling backwards
      steer: Math.max(-1, Math.min(1, diff * 2.2)),
    }, this.collision);
  }
}

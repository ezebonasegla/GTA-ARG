// Real colectivo lines (official AMBA GTFS, see scripts/fetch_buses.py): buses
// drive their real routes, stop at their real stops, and every parada has a pole.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Vehicle } from './vehicle.js';
import { closestOnSegment } from '../world/geo.js';
import { BUS_W, PLAT_W, stationAt, signTexture } from '../world/metrobus.js';
import { createPersonMesh, animatePerson, disposePerson } from './person.js';

const MAX_BUSES = 9;
const SPAWN_MIN = 120, SPAWN_MAX = 320, DESPAWN = 420;
const DWELL = 7;
const LANE = 2.3; // meters to the right of the route line
const CHUNK = 250;

// Real liveries [upper, lower, trim] from busarg.com.ar/colores.htm; MOQSA (159, 219,
// 300, 372) switched its green trim to yellow in 1998. Other lines aren't documented
// there, so they get a representative color per company.
const CREMA = 0xefe6c8, BLANCO = 0xf4f4f4, NEGRO = 0x1c1c1c;
const LINE_COLORS = {
  22: [CREMA, 0x8cc98a, 0x8a8f94],
  85: [CREMA, 0x1f7a3a, NEGRO],
  98: [CREMA, 0x1d4d2b, 0xc62828],
  129: [BLANCO, 0xc62828, 0x1d4fa0],
  148: [0xf2c200, 0x2e7d32, NEGRO],
  159: [BLANCO, BLANCO, 0xf2c200],
  219: [BLANCO, BLANCO, 0xf2c200],
  300: [BLANCO, BLANCO, 0xf2c200],
  372: [BLANCO, BLANCO, 0xf2c200],
  178: [BLANCO, 0xc62828, NEGRO],
};
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
    this.stopById = new Map(this.stops.map((st) => [st.id, st]));
    this.list = [];
    this.spawnTimer = 0;
    this.stations = [];
    this.buildStops();
    this.buildStations();
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
    const shelterMat = new THREE.MeshStandardMaterial({ color: 0x5b6670, roughness: 0.5, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
    // refugio de chapa y vidrio, local x = along the street, z = away from it
    const part = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
    const frameParts = [part(3.4, 0.08, 1.4, 0, 2.4, 0), part(2.4, 0.06, 0.4, 0, 0.45, 0.35),
      ...[-1.6, 1.6].flatMap((x) => [part(0.07, 2.4, 0.07, x, 0, 0.6), part(0.07, 2.4, 0.07, x, 0, -0.6)])];
    const glassPart = part(3.2, 2.0, 0.03, 0, 0.3, 0.62);
    const up = new THREE.Vector3(0, 1, 0);
    const groups = new Map();
    for (const st of this.stops) {
      const key = `${Math.floor(st.x / CHUNK)},${Math.floor(st.z / CHUNK)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(st);
    }
    for (const list of groups.values()) {
      const poles = [], plates = [], frames = [], glass = [];
      for (const st of list) {
        // stand the pole on the real curb of the street it serves (the GTFS shape is not
        // the road centerline), on the right-hand side of the direction of travel
        const r = this.routes.find((r) => r.stops.some((s) => s.id === st.id));
        const sOn = r?.stops.find((s) => s.id === st.id).s;
        const p = r ? this.curb(r.pathObj.at(sOn), 0.6) : { x: st.x, z: st.z, dx: 1, dz: 0 };
        if (r && this.stationFor(st, r, sOn)) continue;
        const at = r ? r.pathObj.at(sOn, LANE) : p;
        st.px = p?.x ?? at.x;
        st.pz = p?.z ?? at.z;
        if (!p) continue;
        const yaw = Math.atan2(p.dx, p.dz) + Math.PI; // plate faces the oncoming bus
        const pole = new THREE.CylinderGeometry(0.05, 0.06, 2.7, 6);
        pole.translate(0, 1.35, 0);
        pole.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, 0, p.z));
        poles.push(pole);
        const pl = new THREE.PlaneGeometry(0.5, 0.62);
        pl.translate(0.28, 2.35, 0);
        pl.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, 0, p.z));
        plates.push(pl);
        this.collision.addCircle(p.x, p.z, 0.12, 'pole');
        if (r && st.lines?.length >= 3) {
          const c = this.curb(r.pathObj.at(sOn + 3), 1.9);
          if (!c) continue;
          const out = new THREE.Vector3(c.ox, 0, c.oz);
          const posts = [-1.6, 1.6].flatMap((k) => [[c.x + out.z * k + out.x * 0.6, c.z - out.x * k + out.z * 0.6], [c.x + out.z * k - out.x * 0.6, c.z - out.x * k - out.z * 0.6]]);
          if (posts.some(([x, z]) => this.onRoad(x, z))) continue;
          const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, out), up, out).setPosition(c.x, 0, c.z);
          for (const g of frameParts) frames.push(g.clone().applyMatrix4(m));
          glass.push(glassPart.clone().applyMatrix4(m));
          for (const k of [-1.6, 1.6]) this.collision.addCircle(c.x + out.z * k + out.x * 0.6, c.z - out.x * k + out.z * 0.6, 0.1, 'pole');
        }
      }
      if (!poles.length) continue;
      const pm = new THREE.Mesh(mergeGeometries(poles), poleMat);
      pm.castShadow = true;
      const lm = new THREE.Mesh(mergeGeometries(plates), plateMat);
      this.scene.add(pm, lm);
      if (frames.length) {
        const fm = new THREE.Mesh(mergeGeometries(frames), shelterMat);
        fm.castShadow = true;
        this.scene.add(fm, new THREE.Mesh(mergeGeometries(glass), glassMat));
      }
    }
  }

  // Metro road segment under path point p running along it (same way on one-way
  // carriageways). Returns the corridor median point and the travel direction.
  metroAt(p) {
    if (!this.graph) return null;
    let best = null;
    for (const seg of this.graph.segIndex.query(p.x - 20, p.z - 20, p.x + 20, p.z + 20)) {
      const road = seg.road;
      if (!road.metro) continue;
      const l = Math.hypot(seg.b.x - seg.a.x, seg.b.z - seg.a.z) || 1;
      const ux = (seg.b.x - seg.a.x) / l, uz = (seg.b.z - seg.a.z) / l;
      const dot = ux * p.dx + uz * p.dz;
      if (road.oneway ? dot < 0.8 : Math.abs(dot) < 0.8) continue;
      const [x, z, , d2] = closestOnSegment(p.x, p.z, seg.a.x, seg.a.z, seg.b.x, seg.b.z);
      if (d2 > (road.w / 2 + 2) ** 2 || (best && d2 >= best.d2)) continue;
      const dx = dot < 0 ? -ux : ux, dz = dot < 0 ? -uz : uz;
      const m = road.oneway ? road.metro.median : 0;
      best = { road, d2, x: x - dz * m, z: z + dx * m, dx, dz };
    }
    return best;
  }

  // Stops on the Calchaquí metrobus get a central station instead of a curb pole; the
  // station slides along the avenue off the cross streets and stops of several lines
  // share it. The routes' stop distances move with it so buses halt alongside.
  stationFor(st, r, sOn) {
    const p = r.pathObj.at(sOn);
    const met = this.metroAt(p);
    if (!met) return null;
    let stn = this.stations.find((o) => Math.hypot(o.x - met.x, o.z - met.z) < 40 && o.dx * met.dx + o.dz * met.dz > 0.5);
    if (!stn) {
      const off = BUS_W + PLAT_W / 2;
      for (const along of [0, 7, -7, 13, -13, 19, -19]) {
        const cx = met.x + met.dx * along, cz = met.z + met.dz * along;
        let ok = true;
        for (let t = -19; t <= 19 && ok; t += 2.5) {
          const x = cx + met.dx * t - met.dz * off, z = cz + met.dz * t + met.dx * off;
          const m = this.graph.nearest(x, z, 20);
          if (m && !m.seg.road.metro && m.seg.road.kind !== 'footway' && m.seg.road.kind !== 'pedestrian' && m.dist < m.seg.road.w / 2 + 1.5) ok = false;
          if (this.collision.isBlocked(x, z, 0.2)) ok = false;
        }
        if (!ok) continue;
        stn = { x: cx, z: cz, dx: met.dx, dz: met.dz, road: met.road, people: [], cool: 0, ...stationAt(met.road, cx, cz, met.dx, met.dz) };
        this.collision.addPolygon(stn.corners, stn.height, 'platform');
        this.stations.push(stn);
        break;
      }
      if (!stn) return null;
    }
    st.station = stn;
    st.px = stn.wait.x;
    st.pz = stn.wait.z;
    for (const rr of this.routes) {
      for (const s of rr.stops) if (s.id === st.id) s.s = rr.pathObj.project(stn.x, stn.z, s.s, 60).s;
    }
    return stn;
  }

  buildStations() {
    if (!this.stations.length) return;
    const mats = {
      deck: new THREE.MeshStandardMaterial({ color: 0xa3a19b, roughness: 0.9 }),
      edge: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.8 }),
      frame: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.4, metalness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }),
      sign: new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.5 }),
    };
    for (const k of Object.keys(mats)) {
      const m = new THREE.Mesh(mergeGeometries(this.stations.flatMap((s) => s.geos[k])), mats[k]);
      m.castShadow = k !== 'glass';
      m.receiveShadow = k === 'deck';
      this.scene.add(m);
    }
    for (const s of this.stations) delete s.geos;
  }

  // People waiting on the stations near the player walk into a bus when it stops.
  updateStations(dt, px, pz, rng) {
    for (const stn of this.stations) {
      const d = Math.hypot(stn.x - px, stn.z - pz);
      if (d > 170) {
        for (const p of stn.people) this.scene.remove(p.mesh), disposePerson(p.mesh);
        stn.people.length = 0;
        continue;
      }
      const bus = this.list.find((b) => b.wait > 0 && this.stopById.get(b.r.stops[b.nextStop]?.id)?.station === stn);
      stn.cool -= dt;
      if (!bus && stn.people.length < 4 && stn.cool <= 0 && d > 35) {
        stn.cool = 6 + rng() * 10;
        const w = stn.wait, t = (rng() - 0.5) * w.len, side = rng() * 0.9;
        const mesh = createPersonMesh({ rng });
        const p = { mesh, x: w.x + w.dx * t + w.nx * side, z: w.z + w.dz * t + w.nz * side };
        mesh.rotation.y = Math.atan2(-w.nx, -w.nz) + (rng() - 0.5) * 1.2;
        this.scene.add(mesh);
        stn.people.push(p);
      }
      for (const p of [...stn.people]) {
        let speed = 0;
        if (bus) {
          const dx = bus.v.x - p.x, dz = bus.v.z - p.z, l = Math.hypot(dx, dz);
          if (l < 2.6) {
            this.scene.remove(p.mesh);
            disposePerson(p.mesh);
            stn.people.splice(stn.people.indexOf(p), 1);
            continue;
          }
          speed = 1.3;
          p.x += (dx / l) * speed * dt;
          p.z += (dz / l) * speed * dt;
          p.mesh.rotation.y = Math.atan2(dx, dz);
        }
        p.mesh.position.set(p.x, stn.height, p.z);
        animatePerson(p.mesh, dt, { speed });
      }
    }
  }

  // Bus the player is standing next to (for boarding), or null.
  near(x, z, maxD = 4.5) {
    return this.list.find((b) => b.v.driver === 'bus' && Math.min(...b.v.circles().map(([cx, cz]) => Math.hypot(cx - x, cz - z))) < maxD) || null;
  }

  nextStopName(b) {
    const st = b.r.stops[b.nextStop];
    return st ? this.stopById.get(st.id)?.name || 'parada' : 'terminal';
  }

  // Point `extra` m past the curb of the road under path point p, on the right of travel.
  // Returns { x, z, dx, dz, ox, oz } with (ox, oz) pointing away from the street.
  curb(p, extra) {
    const n = this.parallelRoad(p) || this.graph?.nearest(p.x, p.z, 25);
    if (!n) return { ...p, x: p.x - p.dz * (LANE + 2 + extra), z: p.z + p.dx * (LANE + 2 + extra), ox: -p.dz, oz: p.dx };
    const { a, b, road } = n.seg;
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    let ox = -(b.z - a.z) / l, oz = (b.x - a.x) / l;
    if (ox * -p.dz + oz * p.dx < 0) { ox = -ox; oz = -oz; }
    // off every carriageway: dual carriageways overlap (step outwards) and corners fall inside
    // the cross street (slide along the block, like real stops set back from the corner)
    const ux = (b.x - a.x) / l, uz = (b.z - a.z) / l;
    for (const along of [0, -5, 5, -10, 10, -15, 15]) {
      for (let off = road.w / 2 + extra; off < road.w / 2 + extra + 8; off += 1) {
        const x = n.x + ox * off + ux * along, z = n.z + oz * off + uz * along;
        const m = this.graph.nearest(x, z, 20);
        if (!m || m.seg.road.kind === 'footway' || m.seg.road.kind === 'pedestrian' || m.dist > m.seg.road.w / 2 + 0.5) return { x, z, dx: p.dx, dz: p.dz, ox, oz };
      }
    }
    return null; // nothing but carriageway around (big junctions): no pole
  }

  // Closest road segment near p that runs along the direction of travel (at corners the
  // cross street can be nearer than the one the bus is on).
  parallelRoad(p) {
    if (!this.graph) return null;
    let best = null;
    for (const seg of this.graph.segIndex.query(p.x - 25, p.z - 25, p.x + 25, p.z + 25)) {
      if (seg.road.kind === 'footway' || seg.road.kind === 'pedestrian') continue;
      const dx = seg.b.x - seg.a.x, dz = seg.b.z - seg.a.z, l = Math.hypot(dx, dz) || 1;
      if (Math.abs((dx * p.dx + dz * p.dz) / l) < 0.8) continue;
      const [x, z, , d2] = closestOnSegment(p.x, p.z, seg.a.x, seg.a.z, seg.b.x, seg.b.z);
      if (d2 < 625 && (!best || d2 < best.d2)) best = { seg, x, z, d2, dist: Math.sqrt(d2) };
    }
    return best;
  }

  onRoad(x, z) {
    const m = this.graph?.nearest(x, z, 20);
    return !!m && m.seg.road.kind !== 'footway' && m.seg.road.kind !== 'pedestrian' && m.dist < m.seg.road.w / 2 + 0.3;
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
      const color = LINE_COLORS[r.line] || [BLANCO, LIVERIES[hash(r.agency || r.line) % LIVERIES.length], NEGRO];
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
      if (b === ctx.riding && b.s > b.r.pathObj.length - 8) {
        b.ended = true; // end of the line: the passenger gets off, then the bus goes
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
    this.updateStations(dt, px, pz, rng);
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
    // clear of the parked cars along the curb (they sit 1 m in from the road edge)
    let lane = road ? Math.min(road.oneway ? road.w * 0.12 : Math.min(LANE, road.w * 0.25), Math.max(road.oneway ? 0 : 0.3, road.w / 2 - 3.4)) : LANE;
    if (b.overtake > 0) {
      b.overtake -= dt;
      lane = 0;
    }
    let t = pth.at(b.s + look, lane);
    // metrobus: keep to the central bus lane
    const met = this.metroAt(pth.at(b.s + look));
    if (met) t = { x: met.x - met.dz * BUS_W / 2, z: met.z + met.dx * BUS_W / 2 };
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
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const input = {
      throttle: err > 0.3 ? Math.min(1, err * 0.3) : 0,
      brake: err < -0.4 && speed > 0.6 ? Math.min(1, -err * 0.3) : 0,
      handbrake: target === 0 && speed < 1.5, // hold still without rolling backwards
      steer,
    };
    // wedged against a wall (wants to go, nothing ahead): reverse with opposite lock,
    // and after a few tries put it back on its route a bit further on
    if (b.reverse > 0) {
      b.reverse -= dt;
      Object.assign(input, { throttle: 0, brake: 1, handbrake: false, steer: -steer });
    } else if (b.wait <= 0 && target >= 1 && speed < 0.4 && obst === Infinity) {
      b.wall = (b.wall || 0) + dt;
      if (b.wall > 3) {
        b.wall = 0;
        b.reverse = 2;
        b.fails = (b.fails || 0) + 1;
        if (b.fails >= 3) {
          b.fails = 0;
          b.reverse = 0;
          for (const ahead of [8, 16, 24, 32]) {
            const p = pth.at(b.s + ahead, lane);
            if (this.collision.isBlocked(p.x, p.z, v.radius)) continue;
            b.s += ahead;
            v.x = p.x;
            v.z = p.z;
            v.heading = Math.atan2(p.dx, p.dz);
            v.vx = v.vz = 0;
            break;
          }
        }
      }
    } else {
      b.wall = Math.max(0, (b.wall || 0) - dt);
      if (speed > 3) b.fails = 0;
    }
    v.update(dt, input, this.collision);
  }
}

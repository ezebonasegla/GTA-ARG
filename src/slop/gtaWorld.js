// GTA Quilmes's hand-made places inside Slop Quilmes (public/slop-quilmes/): the same code as the game
// (landmarks.js: cathedral and churches, civic buildings, hospitals, stations, stadiums, the brewery, plazas,
// pitches; zones.js: peatonal Rivadavia, station forecourts, plaza fairs), built in the game's frame on the
// game's map data, then turned into the slop engine's street-grid frame.
// Bundled by vite.slop.config.js into public/slop-quilmes/js/gta-world.js ('three' is the page's three/webgpu).
import * as THREE from 'three';
import { buildLandmarks } from '../world/landmarks.js';
import { markZones, buildZones } from '../world/zones.js';
import { RoadGraph } from '../world/roadGraph.js';
import { planCorridors } from '../world/corridors.js';
import { Trains } from '../entities/train.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuf } from '../world/geobuf.js';
import { makeTextures } from '../world/textures.js';
import { SpatialHash, bbox, closestOnSegment, pointInPolygon } from '../world/geo.js';

// Footprints and round props, as the game's collision world, kept to hand them to the slop engine
class Collision {
  constructor() {
    this.hash = new SpatialHash(24);
    this.solids = [];
  }
  addPolygon(pts, height = 10, tag = 'building') {
    const s = { type: 'poly', pts, height, tag, bb: bbox(pts) };
    this.solids.push(s);
    this.hash.insert(s, s.bb);
    return s;
  }
  addCircle(x, z, r, tag = 'prop') {
    const s = { type: 'circle', x, z, r, tag, bb: { minX: x - r, minZ: z - r, maxX: x + r, maxZ: z + r } };
    this.solids.push(s);
    this.hash.insert(s, s.bb);
    return s;
  }
  isBlocked(x, z, r = 0) {
    for (const s of this.hash.query(x - r, z - r, x + r, z + r)) {
      if (s.type === 'circle') {
        if (Math.hypot(x - s.x, z - s.z) < s.r + r) return true;
      } else if (pointInPolygon(x, z, s.pts)) {
        return true;
      } else if (r > 0) {
        const p = s.pts;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          if (closestOnSegment(x, z, p[j][0], p[j][1], p[i][0], p[i][1])[3] < r * r) return true;
        }
      }
    }
    return false;
  }
}

const WHITE = new THREE.Color(1, 1, 1);
// A flat strip along a polyline (the game's builder.js ribbon)
function ribbon(buf, pts, w, y, vScale) {
  const n = pts.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)];
    let d1x = p[0] - prev[0], d1z = p[1] - prev[1];
    let d2x = next[0] - p[0], d2z = next[1] - p[1];
    const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
    d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
    if (i === 0) { d1x = d2x; d1z = d2z; }
    if (i === n - 1) { d2x = d1x; d2z = d1z; }
    let tx = d1x + d2x, tz = d1z + d2z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    const miter = Math.min(2, 1 / Math.max(0.3, nx * -d1z + nz * d1x));
    const o = (w / 2) * miter;
    left.push([p[0] + nx * o, y, p[1] + nz * o]);
    right.push([p[0] - nx * o, y, p[1] - nz * o]);
  }
  let dist = 0;
  for (let i = 0; i < n - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    const v0 = dist * vScale, v1 = (dist + seg) * vScale;
    buf.quad(left[i], right[i], right[i + 1], left[i + 1], [0, v0], [1, v0], [1, v1], [0, v1], WHITE, [0, 1, 0]);
    dist += seg;
  }
}

/**
 * Builds the places into `scene`. `frame` turns game metres into the slop grid frame:
 * grid = R(theta) * game + offset (theta about +y, as Object3D.rotation.y). Returns the slop-style colliders
 * ({ minX, maxX, minZ, maxZ, minY, maxY, polygon: { outer: [{x, z}], holes } }) and a night setter.
 */
export async function buildGtaWorld(scene, { dataUrl, frame, lift = 0.2 }) {
  const data = await (await fetch(dataUrl)).json();
  const fakeRenderer = { capabilities: { getMaxAnisotropy: () => 8 } };
  const tex = makeTextures(fakeRenderer);
  const collision = new Collision();
  markZones(data);
  const plan = planCorridors(data); // level crossings of the Línea Roca
  const graph = new RoadGraph(data.roads);
  const root = new THREE.Group();
  root.name = 'GtaQuilmesPlaces';
  root.rotation.y = frame.theta;
  // sidewalks and lots of the slop city are 0.2 m up; the game's are at ground level
  root.position.set(frame.x, lift, frame.z);
  const flatMat = (map, color = 0xffffff, extra = {}) =>
    new THREE.MeshStandardMaterial({ map, color, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...extra });

  const landmarks = buildLandmarks(data, { root, collision, graph, tex });
  const zones = buildZones(data, { root, graph, collision, ribbon, flatMat, keepOut: landmarks.keepOut, GeoBuf });
  const rail = buildRails(data, plan, { root, tex, flatMat, collision });
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.castShadow || !o.material?.transparent;
      o.receiveShadow = true;
    }
  });
  scene.add(root);
  root.updateMatrixWorld(true);

  // footprints into the slop frame
  const c = Math.cos(frame.theta), s = Math.sin(frame.theta);
  const toGrid = (x, z) => ({ x: x * c + z * s + frame.x, z: -x * s + z * c + frame.z });
  const colliders = [];
  for (const sd of collision.solids) {
    const outer = sd.type === 'poly'
      ? sd.pts.map(([x, z]) => toGrid(x, z))
      : Array.from({ length: 8 }, (_, i) => toGrid(sd.x + Math.cos(i * Math.PI / 4) * sd.r, sd.z + Math.sin(i * Math.PI / 4) * sd.r));
    const xs = outer.map((p) => p.x), zs = outer.map((p) => p.z);
    colliders.push({
      minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs),
      minY: 0, maxY: sd.type === 'poly' ? sd.height : 3, polygon: { outer, holes: [] }, gta: sd.tag
    });
  }
  return {
    root,
    colliders,
    keepOut: landmarks.keepOut.map(([x, z, r]) => { const p = toGrid(x, z); return [p.x, p.z, r]; }),
    setNight(n) {
      landmarks.setNight(n);
      zones.setNight(n);
    },
    dynamic: rail.dynamic || null, // moving trains: their matrices are updated every frame
    update(dt) {
      rail.update(Math.min(dt, 0.1));
    }
  };
}

// The Línea Roca as in the game: ballast, rails and sleepers (builder.js), barreras with cruces de San Andrés at the
// level crossings (corridors.js) and the trains running between the stations (entities/train.js)
function buildRails(data, plan, { root, tex, flatMat, collision }) {
  const none = { update() {} };
  if (!data.rails?.length) return none;
  const ballast = new GeoBuf(), railBuf = new GeoBuf();
  for (const r of data.rails) ribbon(ballast, r.pts, 3.6, 0.05, 1 / 4);
  const bm = new THREE.Mesh(ballast.geometry(), flatMat(tex.gravel));
  bm.receiveShadow = true;
  root.add(bm);
  const steel = new THREE.Color(0.55, 0.55, 0.58);
  const sleepers = [];
  for (const r of data.rails) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len, nx = -dz, nz = dx;
      for (const off of [-0.72, 0.72]) {
        const y = 0.18, hw = 0.05;
        const a0 = [ax + nx * (off - hw), y, az + nz * (off - hw)], a1 = [ax + nx * (off + hw), y, az + nz * (off + hw)];
        const b0 = [bx + nx * (off - hw), y, bz + nz * (off - hw)], b1 = [bx + nx * (off + hw), y, bz + nz * (off + hw)];
        railBuf.quad(a0, a1, b1, b0, [0, 0], [1, 0], [1, 1], [0, 1], steel, [0, 1, 0]);
      }
      for (let t = 0; t < len; t += 0.7) sleepers.push([ax + dx * t, az + dz * t, Math.atan2(dx, dz)]);
    }
  }
  root.add(new THREE.Mesh(railBuf.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.35 })));
  {
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }), sleepers.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    sleepers.forEach(([x, z, h], i) => sl.setMatrixAt(i, m.compose(p.set(x, 0.08, z), q.setFromAxisAngle(Y, h), one)));
    sl.receiveShadow = true;
    sl.computeBoundingSphere();
    root.add(sl);
  }

  // barreras
  const levels = plan.levels || [];
  const gates = [];
  for (const l of levels) {
    if (l.ped) continue;
    for (const sg of [-1, 1]) {
      const s = sg * (l.half + 2.2), t = -sg * (l.w / 2 + 0.6);
      const x = l.x + l.ux * s - l.uz * t, z = l.z + l.uz * s + l.ux * t;
      const Dx = -sg * l.uz, Dz = sg * l.ux;
      gates.push({ x, z, ry: Math.atan2(-Dz, Dx), Dx, Dz, len: l.w / 2 + 0.2, l, a: Math.PI / 2 });
      collision.addCircle(x, z, 0.2, 'pole');
    }
  }
  let gateMesh = null;
  const _gm = new THREE.Matrix4(), _e = new THREE.Euler(), gateQ = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const drawGates = () => {
    gates.forEach((g, i) => {
      _e.set(0, g.ry, g.a, 'YXZ');
      gateQ.setFromEuler(_e);
      gateMesh.setMatrixAt(i, _gm.compose(_p.set(g.x, 1.05, g.z), gateQ, _s.set(g.len, 1, 1)));
    });
    gateMesh.instanceMatrix.needsUpdate = true;
  };
  if (gates.length) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 4;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f4f4f4' : '#d11f1f';
      ctx.fillRect(i * 8, 0, 8, 4);
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    gateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.12).translate(0.5, 0, 0), new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), gates.length);
    gateMesh.castShadow = true;
    gateMesh.frustumCulled = false;
    root.add(gateMesh);
    const postG = [], crossG = [];
    for (const g of gates) {
      postG.push(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 6).translate(g.x, 0.6, g.z), new THREE.BoxGeometry(0.35, 0.5, 0.35).translate(g.x, 1.0, g.z));
      const pole = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5).translate(0, 1.6, 0);
      const bar = (r) => new THREE.BoxGeometry(1.4, 0.22, 0.04).rotateZ(r).translate(0, 2.9, 0.06);
      for (const piece of [pole, bar(0.6), bar(-0.6)]) crossG.push(piece.applyMatrix4(new THREE.Matrix4().makeRotationY(g.ry + Math.PI / 2).setPosition(g.x - g.Dx * 0.7, 0, g.z - g.Dz * 0.7)));
    }
    const merge = (list, mat) => {
      const m = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
      m.castShadow = true;
      root.add(m);
    };
    merge(postG, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }));
    merge(crossG, new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 }));
    drawGates();
  }

  const trainsRoot = new THREE.Group();
  trainsRoot.name = 'GtaQuilmesTrains';
  root.add(trainsRoot);
  const trains = new Trains(trainsRoot, data);
  let trackPos = null;
  return {
    trains,
    dynamic: trainsRoot,
    update(dt) {
      trains.update(dt);
      if (!gateMesh || !trains.trains.length) return;
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
    }
  };
}

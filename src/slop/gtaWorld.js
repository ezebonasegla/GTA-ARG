// GTA Quilmes's hand-made places inside Slop Quilmes (public/slop-quilmes/): the same code as the game
// (landmarks.js: cathedral and churches, civic buildings, hospitals, stations, stadiums, the brewery, plazas,
// pitches; zones.js: peatonal Rivadavia, station forecourts, plaza fairs), built in the game's frame on the
// game's map data, then turned into the slop engine's street-grid frame.
// Bundled by vite.slop.config.js into public/slop-quilmes/js/gta-world.js ('three' is the page's three/webgpu).
import * as THREE from 'three';
import { buildLandmarks } from '../world/landmarks.js';
import { buildShops } from '../world/shops.js';
import { markZones, buildZones } from '../world/zones.js';
import { RoadGraph } from '../world/roadGraph.js';
import { planCorridors } from '../world/corridors.js';
import { Trains } from '../entities/train.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuf, ChunkSet } from '../world/geobuf.js';
import { buildBuildings } from '../world/buildings.js';
import { buildConurbano } from '../world/conurbano.js';
import { buildStreetSigns } from '../world/streetSigns.js';
import { Buses } from '../entities/buses.js';
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
  heightAt(x, z) {
    let h = 0;
    for (const s of this.hash.query(x, z, x, z)) {
      if (s.type === 'poly' && s.height > h && pointInPolygon(x, z, s.pts)) h = s.height;
    }
    return h;
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

// game metres -> slop grid metres: the quadratic fit of build-places.mjs (mm), or the rigid turn
function gridMapper(F) {
  if (F.u && F.v) {
    const U = F.u, V = F.v;
    return (x, z) => {
      const a = x / 1000, b = z / 1000, aa = a * a, ab = a * b, bb = b * b;
      return [U[0] + U[1] * a + U[2] * b + U[3] * aa + U[4] * ab + U[5] * bb, V[0] + V[1] * a + V[2] * b + V[3] * aa + V[4] * ab + V[5] * bb];
    };
  }
  const c = Math.cos(F.theta), s = Math.sin(F.theta);
  return (x, z) => [x * c + z * s + F.x, -x * s + z * c + F.z];
}

// Bakes every mesh under root into the slop frame: vertices through the mapping, normals turned by theta, instances
// moved and turned; root ends with identity transforms throughout
function warp(root, toGrid, theta, lift) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const turnQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), theta);
  const nm = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(theta));
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (const m of meshes) {
    if (m.isInstancedMesh) {
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, m4);
        m4.premultiply(m.matrixWorld).decompose(p, q, sc);
        const [u, v] = toGrid(p.x, p.z);
        m.setMatrixAt(i, m4.compose(p.set(u, p.y + lift, v), q.premultiply(turnQ), sc));
      }
      m.instanceMatrix.needsUpdate = true;
      // later writes (persianas at night...) are given in the game's frame too
      const base = m.matrixWorld.clone(), set = m.setMatrixAt.bind(m), w4 = new THREE.Matrix4();
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
      m.setMatrixAt = (i, mat) => {
        w4.copy(mat).premultiply(base).decompose(wp, wq, ws);
        const [u, v] = toGrid(wp.x, wp.z);
        set(i, w4.compose(wp.set(u, wp.y + lift, v), wq.premultiply(turnQ), ws));
      };
    } else {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const [u, v] = toGrid(pos.getX(i), pos.getZ(i));
        pos.setXYZ(i, u, pos.getY(i) + lift, v);
      }
      if (g.attributes.normal) g.attributes.normal.applyMatrix3(nm);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      m.geometry = g;
    }
    m.position.set(0, 0, 0);
    m.quaternion.identity();
    m.scale.set(1, 1, 1);
    if (m.parent !== root) root.add(m);
    if (m.isInstancedMesh) m.computeBoundingSphere();
  }
  for (const c of [...root.children]) if (!c.isMesh) root.remove(c);
  root.position.set(0, 0, 0);
  root.quaternion.identity();
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
  // built in the game's frame, then every vertex is carried into the slop frame (warp below)
  const toGrid = gridMapper(frame);
  const flatMat = (map, color = 0xffffff, extra = {}) =>
    new THREE.MeshStandardMaterial({ map, color, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...extra });

  const landmarks = buildLandmarks(data, { root, collision, graph, tex });
  // the businesses: shopfronts with persiana, cajón and lit sign, kits per rubro, supermarkets (shops.js)
  const nightMaterials = [];
  const shops = buildShops(data, { root, graph, collision, nightMaterials });
  // paradas de colectivo and metrobus stations of the real lines (buses.js; the buses themselves are the engine's)
  if (data.buses) {
    try {
      new Buses(root, data.buses, { collision, traffic: { vehicles: [], add() {} }, graph });
    } catch (err) {
      console.warn('[gta-world] paradas', err);
    }
  }
  const zones = buildZones(data, { root, graph, collision, ribbon, flatMat, keepOut: landmarks.keepOut, GeoBuf });
  // trains and barreras move: they live outside the warped group, placed through the mapping every frame
  const live = new THREE.Group();
  live.name = 'GtaQuilmesTrains';
  live.position.y = lift;
  const rail = buildRails(data, plan, { root, live, tex, flatMat, collision, toGrid, theta: frame.theta });
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.castShadow || !o.material?.transparent;
      o.receiveShadow = true;
    }
  });
  warp(root, toGrid, frame.theta, lift);
  scene.add(root);
  scene.add(live);
  root.updateMatrixWorld(true);
  live.updateMatrixWorld(true);

  // footprints into the slop frame
  const colliders = [];
  for (const sd of collision.solids) {
    const outer = (sd.type === 'poly'
      ? sd.pts.map(([x, z]) => toGrid(x, z))
      : Array.from({ length: 8 }, (_, i) => toGrid(sd.x + Math.cos(i * Math.PI / 4) * sd.r, sd.z + Math.sin(i * Math.PI / 4) * sd.r)))
      .map(([x, z]) => ({ x, z }));
    const xs = outer.map((p) => p.x), zs = outer.map((p) => p.z);
    colliders.push({
      minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs),
      minY: 0, maxY: sd.type === 'poly' ? sd.height : 3, polygon: { outer, holes: [] }, gta: sd.tag
    });
  }
  return {
    root,
    colliders,
    keepOut: landmarks.keepOut.map(([x, z, r]) => [...toGrid(x, z), r]),
    shops: shops.count,
    setNight(n) {
      landmarks.setNight(n);
      zones.setNight(n);
      shops.setNight(n);
    },
    dynamic: live, // moving trains: their matrices are updated every frame
    update(dt) {
      rail.update(Math.min(dt, 0.1));
    }
  };
}

// The Línea Roca as in the game: ballast, rails and sleepers (builder.js), barreras with cruces de San Andrés at the
// level crossings (corridors.js) and the trains running between the stations (entities/train.js)
function buildRails(data, plan, { root, live, tex, flatMat, collision, toGrid, theta }) {
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
      const [gx, gz] = toGrid(x, z);
      gates.push({ x, z, gx, gz, ry: Math.atan2(-Dz, Dx), Dx, Dz, len: l.w / 2 + 0.2, l, a: Math.PI / 2 });
      collision.addCircle(x, z, 0.2, 'pole');
    }
  }
  let gateMesh = null;
  const _gm = new THREE.Matrix4(), _e = new THREE.Euler(), gateQ = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const drawGates = () => {
    gates.forEach((g, i) => {
      _e.set(0, g.ry, g.a, 'YXZ');
      gateQ.setFromEuler(_e);
      _e.set(0, g.ry + theta, g.a, 'YXZ');
      gateQ.setFromEuler(_e);
      gateMesh.setMatrixAt(i, _gm.compose(_p.set(g.gx, 1.05, g.gz), gateQ, _s.set(g.len, 1, 1)));
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
    live.add(gateMesh);
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

  const trains = new Trains(live, data);
  let trackPos = null;
  return {
    trains,
    update(dt) {
      trains.update(dt);
      for (const tr of trains.trains) {
        for (const car of tr.cars) {
          const [u, v] = toGrid(car.position.x, car.position.z);
          car.position.x = u;
          car.position.z = v;
          car.rotation.y += theta;
        }
      }
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

// ---------------------------------------------------------------------------------------------------------------------
// The conurbano's houses as the game draws them (buildings.js + houseFronts.js): revoque in many colours, windows with
// rejas, portones, doors, medianeras, chalets, unfinished upper floors, villas, water tanks. Their footprints come
// already in the slop frame (gta-houses.json), so the generator and its streaming run there directly.
// The facades read a texture array per vertex `layer`: the game does it with onBeforeCompile (WebGL only), here a
// TSL node material.
export async function buildHouses(scene, { dataUrl, frame, lift = 0.2 }) {
  const [json, TSL] = await Promise.all([fetch(dataUrl).then((r) => r.json()), import('three/tsl')]);
  const { styles, houses, roads, streetSigns: signPosts } = json;
  const buildings = houses.map((r) => {
    const pts = [[r[7] / 10, r[8] / 10]];
    for (let i = 9; i + 1 < r.length; i += 2) pts.push([pts[pts.length - 1][0] + r[i] / 10, pts[pts.length - 1][1] + r[i + 1] / 10]);
    const b = { pts, h: r[0] / 10, levels: r[1], style: styles[r[2]] };
    if (r[3] >= 0) b.front = r[3];
    if (r[4]) b.shop = true;
    if (r[5]) b.villa = true;
    if (r[6]) b.roof = 'gable';
    return b;
  });
  const tex = makeTextures({ capabilities: { getMaxAnisotropy: () => 8 } });
  const graph = new RoadGraph(roads);
  const collision = new Collision();
  const chunks = new ChunkSet(220);
  const data = { buildings, roads, specials: [] };
  const { tanks, detail } = buildBuildings(data, { chunks, collision, tex, graph });
  const root = new THREE.Group();
  root.name = 'GtaQuilmesHouses';
  root.position.y = lift;
  scene.add(root);
  const flatMat = (map, color = 0xffffff, extra = {}) =>
    new THREE.MeshStandardMaterial({ map, color, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...extra });
  // pasillos of the villas, as the game paints them
  const pasillos = roads.filter((r) => r.pasillo);
  {
    const buf = new GeoBuf();
    for (const r of pasillos) ribbon(buf, r.pts, r.w, 0.055, 1 / 3);
    if (!buf.empty) {
      const m = new THREE.Mesh(buf.geometry(), flatMat(tex.pasillo));
      m.receiveShadow = true;
      root.add(m);
    }
  }
  // rejas, muros, portones, ligustros and alambrados on the property line, wooden poles with their cables along the
  // streets, the villas' dirt, laundry lines and colgados, descampados (conurbano.js)
  if (json.conurbano) {
    const pasHash = new SpatialHash(12);
    for (const r of pasillos) for (let i = 0; i < r.pts.length - 1; i++) pasHash.insert({ a: r.pts[i], b: r.pts[i + 1], w: r.w }, bbox([r.pts[i], r.pts[i + 1]]));
    const nearPasillo = (x, z, rr) => {
      for (const sg of pasHash.query(x - rr - 2, z - rr - 2, x + rr + 2, z + rr + 2)) {
        if (closestOnSegment(x, z, sg.a[0], sg.a[1], sg.b[0], sg.b[1])[3] < (sg.w / 2 + rr) ** 2) return true;
      }
      return false;
    };
    const mapXZ = gridMapper(frame);
    try {
      buildConurbano({ ...json.conurbano, roads }, { root, chunks, collision, tex, flatMat, graph, nearPasillo, mapXZ });
    } catch (err) {
      console.warn('[gta-houses] conurbano', err);
    }
  }

  const { texture, attribute, uv, vertexColor, uniformArray, uniform, int, vec3 } = TSL;
  const F = tex.facades;
  const layer = attribute('layer', 'float');
  const night = uniform(0);
  const facade = new THREE.MeshStandardNodeMaterial();
  facade.colorNode = texture(F.map, uv()).depth(layer).rgb.mul(vertexColor());
  facade.roughnessNode = uniformArray(F.rough, 'float').element(int(layer.add(0.5)));
  facade.metalnessNode = uniformArray(F.metal, 'float').element(int(layer.add(0.5)));
  facade.emissiveNode = texture(F.emissive, uv()).depth(layer).rgb.mul(vec3(1, 0.85, 0.6)).mul(night);
  const mats = {
    facade,
    props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    alpha: new THREE.MeshStandardMaterial({ map: tex.atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    cables: new THREE.LineBasicMaterial({ color: 0x1a1a1a }),
  };
  chunks.build(root, mats);
  detail.build(root, mats);
  // tanques de agua: [x, z, roofY, scale]
  const tankG = new THREE.CylinderGeometry(0.6, 0.6, 1.1, 8).translate(0, 1.15, 0);
  const legG = new THREE.BoxGeometry(1, 0.6, 1).translate(0, 0.3, 0);
  for (const [g, color] of [[tankG, 0x2d3033], [legG, 0x9a968f]]) {
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), tanks.length);
    const m = new THREE.Matrix4();
    tanks.forEach(([x, z, y, s], i) => mesh.setMatrixAt(i, m.makeScale(s, s, s).setPosition(x, y, z)));
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  // Buenos Aires street corner signs: green post, blue plates with name and altura (streetSigns.js, built near the camera)
  const signs = buildStreetSigns({ streetSigns: signPosts || [], roads }, { root, collision });
  root.updateMatrixWorld(true);

  const colliders = collision.solids.filter((sd) => sd.type === 'poly').map((sd) => {
    const outer = sd.pts.map(([x, z]) => ({ x, z }));
    return { minX: sd.bb.minX, maxX: sd.bb.maxX, minZ: sd.bb.minZ, maxZ: sd.bb.maxZ, minY: 0, maxY: sd.height, polygon: { outer, holes: [] }, gta: 'house' };
  });
  let last = null, first = true;
  const p = { x: 0, z: 0 };
  return {
    root,
    colliders,
    count: buildings.length,
    setNight(n) {
      night.value = n * 0.85;
      signs.setNight(n);
    },
    // streaming around the camera, as in the game (geobuf.js ChunkSet, houseFronts.js HouseDetail)
    update(x, z) {
      p.x = x;
      p.z = z;
      const full = first || !last || (x - last.x) ** 2 + (z - last.z) ** 2 > 9;
      if (full) last = { x, z };
      chunks.updateDetail(p, false, first, full);
      detail.update(p, first, full);
      signs.update(x, z);
      if (full) root.updateMatrixWorld(true);
      first = false;
    },
  };
}

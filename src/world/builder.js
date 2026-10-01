// Turns city data (OSM export or procedural) into Three.js meshes + collision.
import { markMetro, drawMetroLanes, offsetLine } from './metrobus.js';
import { planCorridors, buildCorridors } from './corridors.js';
import * as THREE from 'three';
import { makeTextures } from './textures.js';
import { facadeMaterial } from './conurbanoTextures.js';
import { buildLandmarks } from './landmarks.js';
import { buildStreetSigns } from './streetSigns.js';
import { buildBuildings } from './buildings.js';
import { buildConurbano } from './conurbano.js';
import { buildShops } from './shops.js';
import { CollisionWorld } from './collision.js';
import { RoadGraph } from './roadGraph.js';
import { GeoBuf, ChunkSet } from './geobuf.js';

export { GeoBuf };
import { mulberry32, hashString, polygonArea, pointInPolygon, bbox, SpatialHash, closestOnSegment } from './geo.js';

const CHUNK = 220;
const SIDEWALK = 3;

export function buildWorld(data, renderer, scene) {
  const tex = makeTextures(renderer);
  const collision = new CollisionWorld();
  markMetro(data.roads);
  const plan = planCorridors(data); // cuts the streets that can't cross the autopista / tracks
  const graph = new RoadGraph(data.roads);
  // pasos bajo nivel: the ground and every flat layer skip the trenches (stencil set
  // by corridors.js)
  const noTrench = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc };
  const root = new THREE.Group();
  root.name = 'city';
  scene.add(root);
  const nightMaterials = [];

  // ---------------------------------------------------------------- ground
  {
    const size = 12000;
    // subdivided: huge triangles lose depth precision under the flat layers
    const g = new THREE.PlaneGeometry(size, size, 96, 96);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 8, uv.getY(i) * size / 8);
    const m = new THREE.MeshStandardMaterial({ map: tex.grass, color: 0xa8a890, roughness: 1, ...noTrench });
    const cx = (data.bounds.minX + data.bounds.maxX) / 2, cz = (data.bounds.minZ + data.bounds.maxZ) / 2;
    const ground = new THREE.Mesh(g, m);
    ground.position.set(cx, 0, cz);
    ground.receiveShadow = true;
    ground.renderOrder = -10;
    root.add(ground);
  }

  // ---------------------------------------------------------------- flat layers
  const flatMat = (map, color = 0xffffff, extra = {}) =>
    new THREE.MeshStandardMaterial({ map, color, roughness: 0.95, depthWrite: false, ...noTrench, ...extra });
  const areaMats = {
    park: flatMat(tex.grass, 0xc8d8a8),
    grass: flatMat(tex.grass, 0xc8d8a8),
    plaza: flatMat(tex.plaza),
    sand: flatMat(tex.sand),
    railway: flatMat(tex.gravel),
    pitch: flatMat(tex.pitch),
    parking: flatMat(tex.asphalt, 0xbbbbbb),
    wood: flatMat(tex.dryGrass, 0xa8b088),
    scrub: flatMat(tex.dryGrass),
    waste: flatMat(tex.dryGrass, 0xd8d0b8),
    wetland: flatMat(tex.wetland),
    // Río de la Plata: muddy "color león" water with small waves reflecting the sky
    water: new THREE.MeshStandardMaterial({ ...noTrench, color: 0x8a7d62, roughness: 0.12, metalness: 0.35, normalMap: waveNormalMap(), normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false }),
  };
  const areaBufs = new Map();
  for (const area of data.areas) {
    const mat = areaMats[area.kind] || areaMats.grass;
    if (!areaBufs.has(mat)) areaBufs.set(mat, new GeoBuf());
    const buf = areaBufs.get(mat);
    const y = area.kind === 'water' ? 0.02 : 0.045;
    const white = new THREE.Color(1, 1, 1);
    const contour = area.pts.map(([x, z]) => new THREE.Vector2(x, z));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const scale = area.kind === 'pitch' ? 1 / 60 : area.kind === 'water' ? 1 / 30 : 1 / 8;
    for (const [i, j, k] of faces) {
      const p = [area.pts[i], area.pts[j], area.pts[k]];
      buf.tri(...p.map(([x, z]) => [x, y, z]), ...p.map(([x, z]) => [x * scale, z * scale]), white, [0, 1, 0]);
    }
    if (area.kind === 'water' && !area.noCollide) collision.addPolygon(area.pts, 0, 'water');
  }
  for (const barrier of data.barriers || []) collision.addPolygon(barrier.pts, 0, 'water');
  for (const [mat, buf] of areaBufs) {
    const mesh = new THREE.Mesh(buf.geometry(), mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = -9;
    root.add(mesh);
  }
  areaBufs.clear();

  // Road and sidewalk ribbons (with miter joints), then intersection patches.
  const sidewalkBuf = new GeoBuf();
  const roadBufs = { road1: new GeoBuf(), road2: new GeoBuf(), ped: new GeoBuf(), pasillo: new GeoBuf(), dirt: new GeoBuf(), concrete: new GeoBuf() };
  const white = new THREE.Color(1, 1, 1);
  const vergeBuf = new GeoBuf();
  const bumps = [];
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
      buf.quad(left[i], right[i], right[i + 1], left[i + 1], [0, v0], [1, v0], [1, v1], [0, v1], white, [0, 1, 0]);
      dist += seg;
    }
  }
  function disc(buf, x, z, r, y, uvScale) {
    const segs = 20;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const p0 = [x, y, z], p1 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p2 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
      buf.tri(p0, p1, p2, [p0[0] * uvScale, p0[2] * uvScale], [p1[0] * uvScale, p1[2] * uvScale], [p2[0] * uvScale, p2[2] * uvScale], white, [0, 1, 0]);
    }
  }
  // the stretch of a street on a bridge or in a trench is drawn by corridors.js
  const deckClip = (road) => {
    const near = plan.decks.filter((d) => road.pts.some(([x, z]) => Math.abs(x - d.x) < d.len + 60 && Math.abs(z - d.z) < d.len + 60));
    if (!near.length) return [road.pts];
    const inside = (x, z, ux, uz) => near.some((d) => {
      const rx = x - d.x, rz = z - d.z;
      return Math.abs(ux * d.ux + uz * d.uz) > 0.5 && Math.abs(rx * d.ux + rz * d.uz) < d.len && Math.abs(rx * -d.uz + rz * d.ux) < d.half;
    });
    const out = [];
    let run = [];
    for (let i = 0; i < road.pts.length - 1; i++) {
      const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1], len = Math.hypot(bx - ax, bz - az) || 1;
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      for (let t = 0; t < len; t += 2) {
        const p = [ax + ux * t, az + uz * t];
        if (inside(p[0], p[1], ux, uz)) {
          if (run.length > 1) out.push(run);
          run = [];
        } else run.push(p);
      }
    }
    const last = road.pts[road.pts.length - 1];
    if (!inside(last[0], last[1], 1, 0) || run.length) run.push(last);
    if (run.length > 1) out.push(run);
    return out;
  };
  for (const whole of data.roads) for (const pts of deckClip(whole)) {
    const road = pts === whole.pts ? whole : { ...whole, pts };
    if (road.pasillo) {
      ribbon(roadBufs.pasillo, road.pts, road.w, 0.055, 1 / 3);
      continue;
    }
    if (road.dirt) {
      ribbon(roadBufs.dirt, road.pts, road.w + 1, 0.05, 1 / 8);
      continue;
    }
    if (road.kind === 'pedestrian' || road.kind === 'footway') {
      ribbon(roadBufs.ped, road.pts, road.w, 0.05, 1 / 4);
      continue;
    }
    if (road.kind !== 'service') ribbon(sidewalkBuf, road.pts, road.w + SIDEWALK * 2, 0.04, 1 / 6);
    // many residential streets of the conurbano are concrete slabs
    const concrete = road.kind === 'residential' && (hashString(`${road.pts[0][0]},${road.pts[0][1]}`) % 100) < 45;
    ribbon(concrete ? roadBufs.concrete : road.oneway || road.w < 8 ? roadBufs.road1 : roadBufs.road2, road.pts, road.w, 0.06, 1 / 12);
    // barrio streets: grass verge between the curb and the sidewalk, and lomos de burro
    const [x0, z0] = road.pts[0];
    if (road.kind === 'residential' && x0 * x0 + z0 * z0 > 900 * 900) {
      const h = hashString(`v${x0},${z0}`);
      if (h % 100 < 55) for (const o of [-1, 1]) ribbon(vergeBuf, offsetLine(road.pts, o * (road.w / 2 + 1.0)), 1.1, 0.042, 1 / 6);
      for (let i = 0; i < road.pts.length - 1; i++) {
        const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len > 70 && (h >>> (8 + i % 16)) % 4 === 0) bumps.push([(ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), road.w]);
      }
    }
  }
  const patchBuf = new GeoBuf();
  const walkPatchBuf = new GeoBuf();
  for (const node of graph.nodes) {
    if (node.degree < 2) continue;
    if (node.degree === 2 && node.roads.size === 1) continue;
    if (plan.decks.some((d) => Math.hypot(node.x - d.x, node.z - d.z) < d.len)) continue;
    let maxW = 0;
    let vehicular = false;
    for (const r of node.roads) {
      maxW = Math.max(maxW, r.w);
      if (r.kind !== 'pedestrian' && r.kind !== 'footway') vehicular = true;
    }
    if (vehicular) {
      disc(walkPatchBuf, node.x, node.z, maxW / 2 + SIDEWALK, 0.045, 1 / 6);
      disc(patchBuf, node.x, node.z, maxW / 2 * 1.08, 0.07, 1 / 12);
    }
  }
  const sidewalkMat = flatMat(tex.sidewalk);
  const addFlat = (buf, mat, order) => {
    if (!buf.pos.length) return;
    const mesh = new THREE.Mesh(buf.geometry(), mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = order;
    root.add(mesh);
  };
  addFlat(sidewalkBuf, sidewalkMat, -8);
  addFlat(vergeBuf, flatMat(tex.grass, 0xb4c494), -7.8);
  addFlat(walkPatchBuf, sidewalkMat, -7.5);
  {
    // lomo de burro: low hump across the street, painted yellow and black
    const g = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI); // upper half once laid down
    g.rotateZ(Math.PI / 2);
    const map = stripeTexture('#1c1c1c');
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.center.set(0.5, 0.5);
    map.rotation = Math.PI / 2; // bands across the hump
    map.repeat.set(1, 2);
    const mat = new THREE.MeshStandardMaterial({ map, color: 0xf2c200, roughness: 0.8 });
    const _q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
    instancedChunks(root, g, mat, bumps, (m, [x, z, a, w]) => {
      _q.setFromAxisAngle(yAxis, a);
      m.compose(new THREE.Vector3(x, 0.06, z), _q, new THREE.Vector3(w, 0.11, 0.9));
    }, { receive: true, range: 300 });
  }
  addFlat(roadBufs.road2, flatMat(tex.road2), -7);
  addFlat(roadBufs.road1, flatMat(tex.road1), -7);
  addFlat(roadBufs.concrete, flatMat(tex.concrete), -7);
  addFlat(roadBufs.ped, flatMat(tex.sidewalk, 0xe8d8c8), -7);
  addFlat(roadBufs.pasillo, flatMat(tex.pasillo), -7);
  addFlat(roadBufs.dirt, flatMat(tex.dirt, 0xd0c0a8), -7);
  const metroBufs = { lane: new GeoBuf(), yellow: new GeoBuf(), white: new GeoBuf() };
  drawMetroLanes(data.roads, ribbon, metroBufs);
  addFlat(metroBufs.lane, flatMat(tex.concrete, 0xd6d2ca), -6.6);
  addFlat(metroBufs.yellow, flatMat(null, 0xf2c200), -6.5);
  addFlat(metroBufs.white, flatMat(null, 0xf4f4f4), -6.5);
  addFlat(patchBuf, flatMat(tex.asphalt), -6);

  // ---------------------------------------------------------------- rails
  if (data.rails?.length) {
    const railBuf = new GeoBuf();
    const ballast = new GeoBuf();
    for (const rail of data.rails) ribbon(ballast, rail.pts, 3.6, 0.05, 1 / 4);
    addFlat(ballast, flatMat(tex.gravel), -6.5);
    const steel = new THREE.Color(0.55, 0.55, 0.58);
    const sleeperCount = [];
    for (const rail of data.rails) {
      for (let i = 0; i < rail.pts.length - 1; i++) {
        const [ax, az] = rail.pts[i], [bx, bz] = rail.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const dx = (bx - ax) / len, dz = (bz - az) / len;
        const nx = -dz, nz = dx;
        for (const off of [-0.72, 0.72]) {
          const y = 0.18, hw = 0.05;
          const a0 = [ax + nx * (off - hw), y, az + nz * (off - hw)], a1 = [ax + nx * (off + hw), y, az + nz * (off + hw)];
          const b0 = [bx + nx * (off - hw), y, bz + nz * (off - hw)], b1 = [bx + nx * (off + hw), y, bz + nz * (off + hw)];
          railBuf.quad(a0, a1, b1, b0, [0, 0], [1, 0], [1, 1], [0, 1], steel, [0, 1, 0]);
        }
        for (let t = 0; t < len; t += 0.7) sleeperCount.push([ax + dx * t, az + dz * t, Math.atan2(dx, dz)]);
      }
    }
    const railMesh = new THREE.Mesh(railBuf.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.35 }));
    root.add(railMesh);
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    instancedChunks(root, new THREE.BoxGeometry(2.4, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }), sleeperCount, (m, [x, z, h]) => {
      q.setFromAxisAngle(yAxis, h);
      m.compose(new THREE.Vector3(x, 0.08, z), q, one);
    }, { receive: true, range: 350 });
  }

  // ---------------------------------------------------------------- buildings
  // Walls and roofs of a chunk share one texture-array material; props (vertex
  // colours), cut-outs (rejas, ropa, pastizal) and cables get one mesh each.
  const chunks = new ChunkSet(CHUNK);
  const facadeMat = facadeMaterial(tex.facades);
  nightMaterials.push(facadeMat);
  const chunkMats = {
    facade: facadeMat,
    props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    alpha: new THREE.MeshStandardMaterial({ map: tex.atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    cables: new THREE.LineBasicMaterial({ color: 0x1a1a1a }),
  };
  const { tanks } = buildBuildings(data, { chunks, collision, tex });

  {
    // tanques de agua (items are [x, z, roofY, scale])
    const g = new THREE.CylinderGeometry(0.6, 0.6, 1.1, 8);
    g.translate(0, 1.15, 0);
    const legs = new THREE.BoxGeometry(1, 0.6, 1);
    legs.translate(0, 0.3, 0);
    const tankMatrix = (m, [x, z, y, s]) => m.makeScale(s, s, s).setPosition(x, y, z);
    instancedChunks(root, g, new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: 0.6 }), tanks, tankMatrix, { cast: true, range: 650 });
    instancedChunks(root, legs, new THREE.MeshStandardMaterial({ color: 0x9a968f }), tanks, tankMatrix, { cast: true, range: 450 });
  }

  // ---------------------------------------------------------------- real businesses
  const shops = buildShops(data, { root, graph, collision, nightMaterials });

  // ---------------------------------------------------------------- landmarks
  const landmarks = buildLandmarks(data, { root, collision, graph, tex });
  const outside = (x, z) => !landmarks.keepOut.some(([kx, kz, r]) => (x - kx) ** 2 + (z - kz) ** 2 < r * r);

  // ---------------------------------------------------------------- conurbano
  // keep the pasillos of the villas walkable: no poles or trees on them
  const pasHash = new SpatialHash(12);
  for (const r of data.roads) {
    if (!r.pasillo) continue;
    for (let i = 0; i < r.pts.length - 1; i++) pasHash.insert({ a: r.pts[i], b: r.pts[i + 1], w: r.w }, bbox([r.pts[i], r.pts[i + 1]]));
  }
  const nearPasillo = (x, z, r) => {
    for (const s of pasHash.query(x - r - 2, z - r - 2, x + r + 2, z + r + 2)) {
      if (closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3] < (s.w / 2 + r) ** 2) return true;
    }
    return false;
  };
  // autopista and railway: fences, barriers, bridges, trenches, barreras
  const corridors = buildCorridors(data, plan, { root, chunks, collision, tex, flatMat, graph });
  // villas, descampados, rejas and walls on the property line, poles and cables
  buildConurbano(data, { root, chunks, collision, tex, flatMat, graph, nearPasillo });
  chunks.build(root, chunkMats);

  // ---------------------------------------------------------------- street corner signs
  const streetSigns = buildStreetSigns(data, { root, collision });

  // ---------------------------------------------------------------- trees & lights
  const rng = mulberry32(99);
  // true when (x, z) is on a carriageway (any road but footways and pedestrian streets)
  const onRoad = (x, z, pad) => {
    const n = graph.nearest(x, z, 20);
    return !!n && n.seg.road.kind !== 'footway' && n.seg.road.kind !== 'pedestrian' && n.dist < n.seg.road.w / 2 + pad;
  };
  // 0 fresno / plátano (round), 1 paraíso / tipa (umbrella), 2 álamo / ciprés (tall), 3 jacarandá
  const streetSpecies = (r) => (r < 0.55 ? 0 : r < 0.8 ? 1 : r < 0.9 ? 2 : 3);
  const trees = [];
  const lights = [];
  for (const road of data.roads) {
    if (road.kind === 'footway' || road.motorway || road.ramp) continue;
    const ped = road.kind === 'pedestrian';
    const spacing = ped ? 14 : 11;
    for (let i = 0; i < road.pts.length - 1; i++) {
      const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 12) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const nx = -dz, nz = dx;
      for (const side of [-1, 1]) {
        const off = ped ? road.w / 2 - 1.2 : road.w / 2 + 1.0;
        for (let t = 8 + rng() * 4; t < len - 8; t += spacing + rng() * 4) {
          if (rng() > (road.kind === 'primary' ? 0.55 : 0.8)) continue;
          const x = ax + dx * t + nx * off * side, z = az + dz * t + nz * off * side;
          if (collision.isBlocked(x, z, 1.2) || !outside(x, z) || nearPasillo(x, z, 1.2) || onRoad(x, z, 0.8) || corridors.inDeck(x, z, 2)) continue;
          trees.push([x, z, 0.8 + rng() * 0.6, rng(), streetSpecies(rng()), x * x + z * z > 900 * 900 && rng() < 0.55]);
        }
        if (side === 1 && !ped) {
          for (let t = 15; t < len - 5; t += 34) {
            const x = ax + dx * t + nx * (road.w / 2 + 0.4), z = az + dz * t + nz * (road.w / 2 + 0.4);
            if (collision.isBlocked(x, z, 0.3) || nearPasillo(x, z, 0.8) || onRoad(x, z, 0.3) || corridors.inDeck(x, z, 1)) continue;
            lights.push([x, z, Math.atan2(-nx, -nz)]);
          }
        }
      }
    }
  }
  for (const area of data.areas) {
    if (area.kind !== 'park' && area.kind !== 'plaza' && area.kind !== 'wood') continue;
    const bb = bbox(area.pts);
    const count = Math.min(area.kind === 'wood' ? 1500 : 400, Math.abs(polygonArea(area.pts)) / (area.kind === 'plaza' ? 120 : area.kind === 'wood' ? 70 : 220));
    for (let k = 0; k < count; k++) {
      const x = bb.minX + rng() * (bb.maxX - bb.minX), z = bb.minZ + rng() * (bb.maxZ - bb.minZ);
      if (!pointInPolygon(x, z, area.pts) || collision.isBlocked(x, z, 2) || !outside(x, z) || onRoad(x, z, 1.5)) continue;
      trees.push([x, z, 0.9 + rng() * 0.9, rng(), area.kind === 'wood' ? (rng() < 0.3 ? 2 : 0) : streetSpecies(rng()), false]);
    }
  }
  lights.push(...corridors.lamps);
  for (const [x, z] of trees) collision.addCircle(x, z, 0.35, 'tree');
  for (const [x, z] of lights) collision.addCircle(x, z, 0.2, 'pole');

  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 5);
  trunkG.translate(0, 1.6, 0);
  const crowns = [
    new THREE.IcosahedronGeometry(2.4, 0).scale(1, 0.85, 1).translate(0, 4.6, 0),
    new THREE.IcosahedronGeometry(2.5, 0).scale(1.35, 0.55, 1.35).translate(0, 4.7, 0),
    new THREE.IcosahedronGeometry(1.5, 0).scale(0.75, 2.6, 0.75).translate(0, 6, 0),
    new THREE.IcosahedronGeometry(2.5, 0).scale(1.3, 0.6, 1.3).translate(0, 4.6, 0),
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const c = new THREE.Color();
  const treeMatrix = (m, [x, z, s, r]) => {
    q.setFromAxisAngle(up, r * 6.28);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.9 + r * 0.3), s));
  };
  const leaf = [
    (r) => c.setHSL(0.2 + r * 0.1, 0.35 + r * 0.2, 0.22 + r * 0.1),
    (r) => c.setHSL(0.24 + r * 0.06, 0.4, 0.2 + r * 0.08),
    (r) => c.setHSL(0.27 + r * 0.05, 0.35, 0.17 + r * 0.06),
    (r) => c.setHSL(0.74 + r * 0.04, 0.45, 0.5 + r * 0.1), // lilac blossom
  ];
  instancedChunks(root, trunkG, trunkMat, trees, treeMatrix, { cast: true, range: 600 });
  crowns.forEach((g, k) => {
    const list = trees.filter((t) => t[4] === k);
    if (list.length) instancedChunks(root, g, crownMat, list, treeMatrix, { cast: true, range: 950, receive: true, color: ([, , , r]) => leaf[k](r) });
  });
  // street trees painted with cal at the base
  const calG = new THREE.CylinderGeometry(0.3, 0.33, 1.1, 6).translate(0, 0.55, 0);
  instancedChunks(root, calG, new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 1 }), trees.filter((t) => t[5]), (m, [x, z, s]) => m.makeScale(s * 1.05, 1, s * 1.05).setPosition(x, 0, z), { range: 260 });

  const pole = new THREE.CylinderGeometry(0.1, 0.17, 7, 6);
  pole.translate(0, 3.5, 0);
  const arm = new THREE.BoxGeometry(0.1, 0.1, 2.2);
  arm.translate(0, 7, 1.1);
  const head = new THREE.BoxGeometry(0.5, 0.18, 0.9);
  head.translate(0, 6.9, 2.1);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffc070, emissiveIntensity: 0 });
  const lampMatrix = (m, [x, z, h]) => {
    q.setFromAxisAngle(up, h);
    m.compose(new THREE.Vector3(x, 0, z), q, one);
  };
  instancedChunks(root, mergeSimple([pole, arm]), new THREE.MeshStandardMaterial({ color: 0x9e9b94, roughness: 0.95 }), lights, lampMatrix, { cast: true, range: 600 });

  // cestos de basura enrejados sobre un caño, en la vereda de enfrente a los postes
  {
    const prng = mulberry32(5);
    const cestos = [];
    for (const road of data.roads) {
      if (road.kind !== 'residential' || road.pasillo || road.dirt) continue;
      for (let i = 0; i < road.pts.length - 1; i++) {
        const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const dx = (bx - ax) / len, dz = (bz - az) / len;
        const off = road.w / 2 + 0.6;
        for (let t = 10; t < len - 10; t += 26) {
          if (prng() > 0.3) continue;
          const x = ax + dx * t + dz * off, z = az + dz * t - dx * off;
          if (collision.isBlocked(x, z, 0.6) || !outside(x, z) || onRoad(x, z, 0.3)) continue;
          collision.addCircle(x, z, 0.2, 'pole');
          cestos.push([x, z]);
        }
      }
    }
    const cano = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5);
    cano.translate(0, 0.55, 0);
    const cesto = new THREE.CylinderGeometry(0.24, 0.19, 0.42, 10, 1, true);
    cesto.translate(0, 1.3, 0);
    const grid = gridTexture();
    grid.repeat.set(6, 2);
    const at = (m, [x, z]) => m.makeTranslation(x, 0, z);
    instancedChunks(root, cano, new THREE.MeshStandardMaterial({ color: 0x2a2d2e, metalness: 0.5, roughness: 0.6 }), cestos, at, { range: 220 });
    instancedChunks(root, cesto, new THREE.MeshStandardMaterial({ color: 0x2a2d2e, map: grid, alphaTest: 0.5, side: THREE.DoubleSide }), cestos, at, { range: 220 });
  }

  // cordones pintados de amarillo en las esquinas
  {
    const curbs = [];
    for (const node of graph.nodes) {
      if (node.degree < 3) continue;
      let maxW = 0;
      for (const r of node.roads) maxW = Math.max(maxW, r.w);
      const s0 = maxW / 2 + SIDEWALK + 2.5;
      for (const [nb, road] of node.links) {
        if (road.kind === 'footway' || road.kind === 'pedestrian' || road.kind === 'service' || road.pasillo || road.dirt) continue;
        const len = Math.hypot(nb.x - node.x, nb.z - node.z);
        if (len < s0 + 6) continue;
        const ux = (nb.x - node.x) / len, uz = (nb.z - node.z) / len;
        for (const side of [-1, 1]) {
          const o = side * (road.w / 2 + 0.12);
          curbs.push([node.x + ux * s0 - uz * o, node.z + uz * s0 + ux * o, Math.atan2(ux, uz)]);
        }
      }
    }
    const strip = new THREE.PlaneGeometry(0.3, 5);
    strip.rotateX(-Math.PI / 2);
    strip.translate(0, 0.085, 0);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xe6bf1e, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const m of instancedChunks(root, strip, curbMat, curbs, lampMatrix, { receive: true, range: 260 })) m.renderOrder = -5;
  }
  instancedChunks(root, head, lampMat, lights, lampMatrix, { range: 700 });
  // Fake light pools on the pavement (cheaper than hundreds of real lights).
  const poolG = new THREE.PlaneGeometry(14, 14);
  poolG.rotateX(-Math.PI / 2);
  poolG.translate(0, 0.09, 2.1);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0xffb860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const pools = instancedChunks(root, poolG, poolMat, lights, lampMatrix, { range: 450 });
  for (const p of pools) p.renderOrder = -5;

  return {
    root,
    collision,
    graph,
    corridors,
    chunks, // for the memory probes
    tex,
    waterMaterial: areaMats.water,
    updateDetail: (p, fast) => {
      chunks.updateDetail(p, fast);
      updateCulling(p);
    },
    setNight(n) {
      for (const m of nightMaterials) m.emissiveIntensity = n * 0.85;
      lampMat.emissiveIntensity = n * 3;
      poolMat.opacity = n * 0.55;
      poolMat.visible = n > 0.05;
      landmarks.setNight(n);
      streetSigns.setNight(n);
      shops.setNight(n);
    },
    streetSigns,
    shops: shops.count,
    shopList: shops.placed,
    // Per-frame work that depends on where the player is.
    update(x, z, fast) {
      streetSigns.update(x, z, fast);
    },
  };
}

// One InstancedMesh per spatial chunk so that frustum culling (and the shadow pass)
// only processes nearby instances.
// Instanced props are hidden beyond their range (opts.range, meters from the camera):
// each kind of prop per 220 m chunk is a draw call, and most of them were being drawn
// out to the fog.
const culled = [];
export function updateCulling(p) {
  for (const c of culled) c.mesh.visible = (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < c.r2;
}

export function instancedChunks(root, geometry, material, items, setMatrix, opts = {}) {
  const groups = new Map();
  for (const it of items) {
    const key = `${Math.floor(it[0] / CHUNK)},${Math.floor(it[1] / CHUNK)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const m = new THREE.Matrix4();
  const meshes = [];
  for (const list of groups.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((it, i) => {
      setMatrix(m, it);
      mesh.setMatrixAt(i, m);
      if (opts.color) mesh.setColorAt(i, opts.color(it));
    });
    mesh.castShadow = !!opts.cast;
    mesh.receiveShadow = !!opts.receive;
    mesh.computeBoundingSphere();
    root.add(mesh);
    meshes.push(mesh);
    const r = (opts.range ?? 450) + mesh.boundingSphere.radius;
    culled.push({ mesh, x: mesh.boundingSphere.center.x, z: mesh.boundingSphere.center.z, r2: r * r });
  }
  return meshes;
}

// Tileable wave normal map (sum of sines), animated by offsetting its UVs.
function waveNormalMap() {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const hgt = (x, y) => {
    const t = (Math.PI * 2) / N;
    return Math.sin(x * t * 3 + Math.sin(y * t * 2) * 1.5) * 0.5 + Math.sin(y * t * 5 + x * t * 2) * 0.3 + Math.sin((x + y) * t * 7) * 0.2;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const nx = -dx * 2, ny = -dy * 2, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function mergeSimple(geoms) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const g of geoms) {
    const gi = g.index ? g : g.toNonIndexed();
    const p = gi.attributes.position.array, n = gi.attributes.normal.array;
    pos.push(...p);
    nor.push(...n);
    if (gi.index) for (const i of gi.index.array) idx.push(i + base);
    base += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (idx.length) out.setIndex(idx);
  return out;
}

// Street a footprint edge p0->p1 (counter-clockwise ring) looks onto, or null for back
// and party walls: a road must run parallel to the edge, on its outer side, within a
// sidewalk plus a front garden. `room` is the free depth between facade and curb.
export function frontRoad(graph, p0, p1) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1], len = Math.hypot(dx, dz);
  if (len < 2.5) return null;
  const ox = dz / len, oz = -dx / len;
  const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
  const hit = graph.nearest(mx + ox * (SIDEWALK + 2), mz + oz * (SIDEWALK + 2), 14);
  if (!hit || hit.seg.road.kind === 'footway') return null;
  const { a, b, road } = hit.seg;
  const sx = b.x - a.x, sz = b.z - a.z;
  if (Math.abs(dx * sx + dz * sz) < 0.8 * len * Math.hypot(sx, sz)) return null;
  const d = (hit.x - mx) * ox + (hit.z - mz) * oz;
  if (d <= 0 || d > road.w / 2 + SIDEWALK + 6) return null;
  return { road, room: d - road.w / 2 };
}

export function stripeTexture(color) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#f4efe4' : color;
    ctx.fillRect(i * 8, 0, 8, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 16, 3);
  ctx.fillRect(0, 0, 3, 16);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

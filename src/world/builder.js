// Turns city data (OSM export or procedural) into Three.js meshes + collision.
import * as THREE from 'three';
import { makeTextures } from './textures.js';
import { buildLandmarks } from './landmarks.js';
import { buildStreetSigns } from './streetSigns.js';
import { CollisionWorld } from './collision.js';
import { RoadGraph } from './roadGraph.js';
import { mulberry32, hashString, polygonArea, pointInPolygon, bbox } from './geo.js';

const CHUNK = 220;
const SIDEWALK = 3;

// Tint palettes (sRGB hex) per facade style.
const PALETTES = {
  house: ['#f3eee2', '#efe1c4', '#f2d6c0', '#e9c9a8', '#dfe4dc', '#d9e2ea', '#f4e7a8', '#e7b89a', '#cfd8c0', '#ffffff', '#e9dccb', '#d8c7b0', '#c9d6de', '#f0c9b4'],
  brick: ['#ffffff', '#f2eeea', '#e6dcd6', '#ffece0'],
  apartments: ['#ffffff', '#efece6', '#e6e1d6', '#d9d6d0', '#f3eadb', '#dfe3e6'],
  office: ['#ffffff', '#dfe8ee', '#e8efe8', '#d6dde6'],
  church: ['#ffffff', '#f4ead6'],
  shop: ['#ffffff'],
};

const STYLE_MAP = {
  house: 'house', ph: 'house', apartments: 'apartments', brick: 'brick', office: 'office',
  church: 'church', civic: 'church', station: 'brick', mall: 'office', monument: 'church',
  industrial: 'brick', school: 'brick', hospital: 'apartments', brewery: 'brick',
};

class GeoBuf {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
  }
  tri(a, b, c, ua, ub, uc, color, want) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    if (want && nx * want[0] + ny * want[1] + nz * want[2] < 0) {
      [b, c] = [c, b];
      [ub, uc] = [uc, ub];
      nx = -nx; ny = -ny; nz = -nz;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(u[0], u[1]);
      this.col.push(color.r, color.g, color.b);
    }
  }
  quad(a, b, c, d, ua, ub, uc, ud, color, want) {
    this.tri(a, b, c, ua, ub, uc, color, want);
    this.tri(a, c, d, ua, uc, ud, color, want);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export function buildWorld(data, renderer, scene, opts = {}) {
  const qualityMode = opts.qualityMode === 'max' ? 'max' : 'balanced';
  const lodNear = qualityMode === 'max' ? 950 : 700;
  const lodFar = qualityMode === 'max' ? 2200 : 1550;
  const tex = makeTextures(renderer);
  const collision = new CollisionWorld();
  const graph = new RoadGraph(data.roads);
  const root = new THREE.Group();
  root.name = 'city';
  scene.add(root);
  const nightMaterials = [];

  // ---------------------------------------------------------------- ground
  {
    const size = 12000;
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 8, uv.getY(i) * size / 8);
    const m = new THREE.MeshStandardMaterial({ map: tex.grass, color: 0xa8a890, roughness: 1 });
    const cx = (data.bounds.minX + data.bounds.maxX) / 2, cz = (data.bounds.minZ + data.bounds.maxZ) / 2;
    const ground = new THREE.Mesh(g, m);
    ground.position.set(cx, 0, cz);
    ground.receiveShadow = true;
    ground.renderOrder = -10;
    root.add(ground);
  }

  // ---------------------------------------------------------------- flat layers
  const flatMat = (map, color = 0xffffff, extra = {}) =>
    new THREE.MeshStandardMaterial({ map, color, roughness: 0.95, depthWrite: false, ...extra });
  const areaMats = {
    park: flatMat(tex.grass, 0xc8d8a8),
    grass: flatMat(tex.grass, 0xc8d8a8),
    plaza: flatMat(tex.plaza),
    sand: flatMat(tex.sand),
    railway: flatMat(tex.gravel),
    pitch: flatMat(tex.pitch),
    parking: flatMat(tex.asphalt, 0xbbbbbb),
    // Río de la Plata: muddy "color león" water with small waves reflecting the sky
    water: new THREE.MeshStandardMaterial({ color: 0x8a7d62, roughness: 0.12, metalness: 0.35, normalMap: waveNormalMap(), normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false }),
  };
  const areaBufs = new Map();
  for (const area of data.areas) {
    const mat = areaMats[area.kind] || areaMats.grass;
    if (!areaBufs.has(mat)) areaBufs.set(mat, new GeoBuf());
    const buf = areaBufs.get(mat);
    const y = area.kind === 'water' ? 0.02 : 0.03;
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
  const roadBufs = { road1: new GeoBuf(), road2: new GeoBuf(), ped: new GeoBuf() };
  const white = new THREE.Color(1, 1, 1);
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
  for (const road of data.roads) {
    if (road.kind === 'pedestrian' || road.kind === 'footway') {
      ribbon(roadBufs.ped, road.pts, road.w, 0.05, 1 / 4);
      continue;
    }
    if (road.kind !== 'service') ribbon(sidewalkBuf, road.pts, road.w + SIDEWALK * 2, 0.04, 1 / 6);
    ribbon(road.oneway || road.w < 8 ? roadBufs.road1 : roadBufs.road2, road.pts, road.w, 0.06, 1 / 12);
  }
  const patchBuf = new GeoBuf();
  const walkPatchBuf = new GeoBuf();
  for (const node of graph.nodes) {
    if (node.degree < 2) continue;
    if (node.degree === 2 && node.roads.size === 1) continue;
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
  addFlat(walkPatchBuf, sidewalkMat, -7.5);
  addFlat(roadBufs.road2, flatMat(tex.road2), -7);
  addFlat(roadBufs.road1, flatMat(tex.road1), -7);
  addFlat(roadBufs.ped, flatMat(tex.sidewalk, 0xe8d8c8), -7);
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
    }, { receive: true });
  }

  // ---------------------------------------------------------------- buildings
  const wallMats = {};
  for (const style of ['house', 'brick', 'apartments', 'office', 'church', 'shop']) {
    const m = new THREE.MeshStandardMaterial({
      map: tex[style].map,
      emissiveMap: tex[style].emissive,
      emissive: new THREE.Color(1, 0.85, 0.6),
      emissiveIntensity: 0,
      vertexColors: true,
      roughness: style === 'office' ? 0.35 : 0.9,
      metalness: style === 'office' ? 0.3 : 0,
    });
    wallMats[style] = m;
    nightMaterials.push(m);
  }
  const roofFlatMat = new THREE.MeshStandardMaterial({ map: tex.roofFlat, vertexColors: true, roughness: 1 });
  const roofTileMat = new THREE.MeshStandardMaterial({ map: tex.roofTile, vertexColors: true, roughness: 0.8 });

  const chunks = new Map(); // key -> Map(material -> GeoBuf)
  const bufFor = (x, z, mat) => {
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let c = chunks.get(key);
    if (!c) chunks.set(key, (c = new Map()));
    let b = c.get(mat);
    if (!b) c.set(mat, (b = new GeoBuf()));
    return b;
  };

  const tanks = [];
  data.buildings.forEach((bld, idx) => {
    let pts = bld.pts;
    if (pts.length < 3) return;
    // cathedral and churches are modelled entirely in landmarks.js
    if (bld.special && (bld.special.type === 'cathedral' || bld.special.type === 'church')) return;
    if (polygonArea(pts) < 0) pts = pts.slice().reverse();
    const rng = mulberry32(hashString(`${idx}:${pts[0][0].toFixed(1)}`));
    const style = STYLE_MAP[bld.style] || 'house';
    const h = Math.max(2.5, bld.h || 6);
    const palette = PALETTES[style];
    const tint = new THREE.Color(bld.color || palette[Math.floor(rng() * palette.length)]);
    const shopH = bld.shop ? Math.min(4, h) : 0;
    const bb = bbox(pts);
    const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
    const wallMat = wallMats[style];
    const walls = bufFor(cx, cz, wallMat);
    const shopBuf = shopH ? bufFor(cx, cz, wallMats.shop) : null;
    const shopTint = new THREE.Color(1, 1, 1);
    const uOffset = Math.floor(rng() * 4) * 0.25;

    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
      const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const out = [dz / len, 0, -dx / len];
      if (shopH) {
        const u0 = -dist / 4 + uOffset * 4, u1 = -(dist + len) / 4 + uOffset * 4;
        shopBuf.quad([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], shopH, p1[1]], [p0[0], shopH, p0[1]],
          [u0 / 4, 0], [u1 / 4, 0], [u1 / 4, 1], [u0 / 4, 1], shopTint, out);
      }
      const y0 = shopH;
      if (h - y0 > 0.1) {
        const u0 = -dist / 6 + uOffset, u1 = -(dist + len) / 6 + uOffset;
        walls.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], h, p1[1]], [p0[0], h, p0[1]],
          [u0, 0], [u1, 0], [u1, (h - y0) / 6], [u0, (h - y0) / 6], tint, out);
      }
      dist += len;
    }

    // Roofs
    const roofShade = 0.85 + rng() * 0.3;
    const roofTint = new THREE.Color(roofShade, roofShade, roofShade);
    if (bld.roof === 'gable' && pts.length === 4) {
      addGable(pts, h, bufFor(cx, cz, roofTileMat), walls, tint, roofTint);
    } else if (bld.roof === 'spire' && pts.length >= 3) {
      const apex = [cx, h + Math.max(8, h * 0.35), cz];
      const rb = bufFor(cx, cz, roofTileMat);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        rb.tri([a[0], h, a[1]], [b[0], h, b[1]], apex, [0, 0], [1, 0], [0.5, 1], new THREE.Color(0.55, 0.6, 0.62), [(a[0] + b[0]) / 2 - cx, 0.5, (a[1] + b[1]) / 2 - cz]);
      }
    } else {
      const rb = bufFor(cx, cz, roofFlatMat);
      const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
      const faces = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const [i, j, k] of faces) {
        const p = [pts[i], pts[j], pts[k]];
        rb.tri(...p.map(([x, z]) => [x, h, z]), ...p.map(([x, z]) => [x / 8, z / 8]), roofTint, [0, 1, 0]);
      }
      // tanque de agua on many flat roofs
      const area = Math.abs(polygonArea(pts));
      if (style !== 'office' && style !== 'church' && area > 40 && rng() < 0.7 && pointInPolygon(cx, cz, pts)) {
        tanks.push([cx + (rng() - 0.5) * 2, cz + (rng() - 0.5) * 2, h, h > 12 ? 1.6 : 1]);
      }
    }
    collision.addPolygon(pts, h, 'building');
  });

  const chunkGroup = new THREE.Group();
  const buildingChunks = [];
  for (const [key, mats] of chunks) {
    const [ix, iz] = key.split(',').map(Number);
    const group = new THREE.Group();
    for (const [mat, buf] of mats) {
      const mesh = new THREE.Mesh(buf.geometry(), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    chunkGroup.add(group);
    buildingChunks.push({ group, cx: (ix + 0.5) * CHUNK, cz: (iz + 0.5) * CHUNK, state: -1 });
  }
  root.add(chunkGroup);
  chunks.clear(); // the JS arrays are no longer needed once uploaded to typed arrays

  {
    // tanques de agua (items are [x, z, roofY, scale])
    const g = new THREE.CylinderGeometry(0.6, 0.6, 1.1, 8);
    g.translate(0, 1.15, 0);
    const legs = new THREE.BoxGeometry(1, 0.6, 1);
    legs.translate(0, 0.3, 0);
    const tankMatrix = (m, [x, z, y, s]) => m.makeScale(s, s, s).setPosition(x, y, z);
    instancedChunks(root, g, new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: 0.6 }), tanks, tankMatrix, { cast: true });
    instancedChunks(root, legs, new THREE.MeshStandardMaterial({ color: 0x9a968f }), tanks, tankMatrix, { cast: true });
  }

  // ---------------------------------------------------------------- landmarks
  const landmarks = buildLandmarks(data, { root, collision, graph, tex });
  const outside = (x, z) => !landmarks.keepOut.some(([kx, kz, r]) => (x - kx) ** 2 + (z - kz) ** 2 < r * r);

  // ---------------------------------------------------------------- street corner signs
  const streetSigns = buildStreetSigns(data, { root, collision });

  // ---------------------------------------------------------------- trees & lights
  const rng = mulberry32(99);
  const trees = [];
  const lights = [];
  for (const road of data.roads) {
    if (road.kind === 'footway') continue;
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
          if (collision.isBlocked(x, z, 1.2) || !outside(x, z)) continue;
          trees.push([x, z, 0.8 + rng() * 0.6, rng()]);
        }
        if (side === 1 && !ped) {
          for (let t = 15; t < len - 5; t += 34) {
            const x = ax + dx * t + nx * (road.w / 2 + 0.4), z = az + dz * t + nz * (road.w / 2 + 0.4);
            if (collision.isBlocked(x, z, 0.3)) continue;
            lights.push([x, z, Math.atan2(-nx, -nz)]);
          }
        }
      }
    }
  }
  for (const area of data.areas) {
    if (area.kind !== 'park' && area.kind !== 'plaza') continue;
    const bb = bbox(area.pts);
    const count = Math.min(400, Math.abs(polygonArea(area.pts)) / (area.kind === 'plaza' ? 120 : 220));
    for (let k = 0; k < count; k++) {
      const x = bb.minX + rng() * (bb.maxX - bb.minX), z = bb.minZ + rng() * (bb.maxZ - bb.minZ);
      if (!pointInPolygon(x, z, area.pts) || collision.isBlocked(x, z, 2) || !outside(x, z)) continue;
      trees.push([x, z, 0.9 + rng() * 0.9, rng()]);
    }
  }
  for (const [x, z] of trees) collision.addCircle(x, z, 0.35, 'tree');
  for (const [x, z] of lights) collision.addCircle(x, z, 0.2, 'pole');

  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 5);
  trunkG.translate(0, 1.6, 0);
  const crownG = new THREE.IcosahedronGeometry(2.4, 0);
  crownG.scale(1, 0.85, 1);
  crownG.translate(0, 4.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const c = new THREE.Color();
  const treeMatrix = (m, [x, z, s, r]) => {
    q.setFromAxisAngle(up, r * 6.28);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.9 + r * 0.3), s));
  };
  instancedChunks(root, trunkG, trunkMat, trees, treeMatrix, { cast: true });
  instancedChunks(root, crownG, crownMat, trees, treeMatrix, {
    cast: true,
    receive: true,
    color: ([, , , r]) => c.setHSL(0.2 + r * 0.1, 0.35 + r * 0.2, 0.22 + r * 0.1),
  });

  const pole = new THREE.CylinderGeometry(0.08, 0.12, 7, 5);
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
  instancedChunks(root, mergeSimple([pole, arm]), new THREE.MeshStandardMaterial({ color: 0x4a4f52, metalness: 0.6, roughness: 0.5 }), lights, lampMatrix, { cast: true });
  instancedChunks(root, head, lampMat, lights, lampMatrix);
  // Fake light pools on the pavement (cheaper than hundreds of real lights).
  const poolG = new THREE.PlaneGeometry(14, 14);
  poolG.rotateX(-Math.PI / 2);
  poolG.translate(0, 0.09, 2.1);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0xffb860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const pools = instancedChunks(root, poolG, poolMat, lights, lampMatrix);
  for (const p of pools) p.renderOrder = -5;

  return {
    root,
    collision,
    graph,
    tex,
    waterMaterial: areaMats.water,
    setNight(n) {
      for (const m of nightMaterials) m.emissiveIntensity = n * 0.85;
      lampMat.emissiveIntensity = n * 3;
      poolMat.opacity = n * 0.55;
      poolMat.visible = n > 0.05;
      landmarks.setNight(n);
      streetSigns.setNight(n);
    },
    streetSigns,
    updateBuildingLod(x, z) {
      const near2 = lodNear * lodNear;
      const far2 = lodFar * lodFar;
      for (const c of buildingChunks) {
        const d2 = (c.cx - x) ** 2 + (c.cz - z) ** 2;
        const state = d2 > far2 ? 0 : d2 > near2 ? 1 : 2; // hidden / mid / near
        if (state === c.state) continue;
        c.state = state;
        c.group.visible = state > 0;
        const cast = state === 2;
        for (const mesh of c.group.children) mesh.castShadow = cast;
      }
    },
    // Per-frame work that depends on where the player is.
    update(x, z) {
      this.updateBuildingLod(x, z);
      streetSigns.update(x, z);
    },
  };
}

// One InstancedMesh per spatial chunk so that frustum culling (and the shadow pass)
// only processes nearby instances.
function instancedChunks(root, geometry, material, items, setMatrix, opts = {}) {
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

function addGable(pts, h, roofBuf, wallBuf, wallTint, roofTint) {
  const d01 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const d12 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  // rotate so that edge 0-1 is a long edge
  const p = d01 >= d12 ? pts : [pts[1], pts[2], pts[3], pts[0]];
  const shortLen = Math.min(d01, d12);
  const longLen = Math.max(d01, d12);
  const rise = shortLen * 0.32;
  const mid = (a, b) => [(a[0] + b[0]) / 2, h + rise, (a[1] + b[1]) / 2];
  const r0 = mid(p[3], p[0]);
  const r1 = mid(p[1], p[2]);
  const P = (q) => [q[0], h, q[1]];
  const cx = (p[0][0] + p[2][0]) / 2, cz = (p[0][1] + p[2][1]) / 2;
  const up = (a, b) => [(a[0] + b[0]) / 2 - cx, shortLen, (a[1] + b[1]) / 2 - cz];
  const uL = longLen / 4, uS = shortLen / 4;
  roofBuf.quad(P(p[0]), P(p[1]), r1, r0, [0, 0], [uL, 0], [uL, uS], [0, uS], roofTint, up(p[0], p[1]));
  roofBuf.quad(P(p[2]), P(p[3]), r0, r1, [0, 0], [uL, 0], [uL, uS], [0, uS], roofTint, up(p[2], p[3]));
  const out = (a, b) => [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
  wallBuf.tri(P(p[1]), P(p[2]), r1, [0, h / 6], [shortLen / 6, h / 6], [shortLen / 12, (h + rise) / 6], wallTint, out(p[1], p[2]));
  wallBuf.tri(P(p[3]), P(p[0]), r0, [0, h / 6], [shortLen / 6, h / 6], [shortLen / 12, (h + rise) / 6], wallTint, out(p[3], p[0]));
}

function mergeSimple(geoms) {
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

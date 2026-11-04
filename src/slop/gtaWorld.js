// GTA Quilmes's hand-made places inside Slop Quilmes (public/slop-quilmes/): the same code as the game
// (landmarks.js: cathedral and churches, civic buildings, hospitals, stations, stadiums, the brewery, plazas,
// pitches; zones.js: peatonal Rivadavia, station forecourts, plaza fairs), built in the game's frame on the
// game's map data, then turned into the slop engine's street-grid frame.
// Bundled by vite.slop.config.js into public/slop-quilmes/js/gta-world.js ('three' is the page's three/webgpu).
import * as THREE from 'three';
import { buildLandmarks } from '../world/landmarks.js';
import { markZones, buildZones } from '../world/zones.js';
import { RoadGraph } from '../world/roadGraph.js';
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
    }
  };
}

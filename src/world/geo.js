// Pure geometry helpers shared by the game and the OSM import script.
// World space: x = east (m), z = south (m), origin at the configured lat/lon.

export const QUILMES_CENTER = { lat: -34.7206, lon: -58.2546 };

// Exact local tangent plane (ENU) on the WGS84 ellipsoid, the same frame the
// Google 3D Tiles ReorientationPlugin uses, so both maps line up everywhere.
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
function ecef(lat, lon) {
  const p = (lat * Math.PI) / 180, l = (lon * Math.PI) / 180;
  const n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  return [n * Math.cos(p) * Math.cos(l), n * Math.cos(p) * Math.sin(l), n * (1 - E2) * Math.sin(p)];
}

export function makeProjection(origin) {
  const p = (origin.lat * Math.PI) / 180, l = (origin.lon * Math.PI) / 180;
  const sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  const [x0, y0, z0] = ecef(origin.lat, origin.lon);
  return {
    toWorld(lat, lon) {
      const [x, y, z] = ecef(lat, lon);
      const dx = x - x0, dy = y - y0, dz = z - z0;
      const east = -sl * dx + cl * dy;
      const north = -sp * cl * dx - sp * sl * dy + cp * dz;
      return [east, -north];
    },
  };
}

// Deterministic PRNG so the city looks the same on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function polygonArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  return a / 2; // > 0 when counter-clockwise in (x, z) with z pointing down on screen
}

export function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1];
    const xj = pts[j][0], zj = pts[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Closest point on segment ab to p. Returns [x, z, t, distSq].
export function closestOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t;
  const ex = px - cx, ez = pz - cz;
  return [cx, cz, t, ex * ex + ez * ez];
}

export function bbox(pts) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

// Uniform-grid spatial index over axis-aligned boxes.
export class SpatialHash {
  constructor(cell = 32) {
    this.cell = cell;
    this.map = new Map();
  }
  key(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }
  insert(item, b) {
    const c = this.cell;
    for (let ix = Math.floor(b.minX / c); ix <= Math.floor(b.maxX / c); ix++) {
      for (let iz = Math.floor(b.minZ / c); iz <= Math.floor(b.maxZ / c); iz++) {
        const k = this.key(ix, iz);
        let list = this.map.get(k);
        if (!list) this.map.set(k, (list = []));
        list.push(item);
      }
    }
  }
  query(minX, minZ, maxX, maxZ, out = new Set()) {
    const c = this.cell;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++) {
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const list = this.map.get(this.key(ix, iz));
        if (list) for (const it of list) out.add(it);
      }
    }
    return out;
  }
}

// Building containing (x, z), else the one with the closest wall within maxD.
// `index` is a SpatialHash of buildings keyed by their bbox.
export function nearestBuilding(index, x, z, maxD = 12) {
  let best = null, bestD = maxD;
  for (const b of index.query(x - maxD, z - maxD, x + maxD, z + maxD)) {
    if (pointInPolygon(x, z, b.pts)) return b;
    const p = b.pts;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const d = Math.sqrt(closestOnSegment(x, z, p[j][0], p[j][1], p[i][0], p[i][1])[3]);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
  }
  return best;
}

// Minimum-area oriented bounding box. u is the long axis.
// Returns { cx, cz, ux, uz, vx, vz, hu, hv }.
export function orientedBox(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    const vx = -uz, vz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) {
      const u = p[0] * ux + p[1] * uz, v = p[0] * vx + p[1] * vz;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, vx, vz, u0, u1, v0, v1 };
  }
  let { ux, uz, vx, vz, u0, u1, v0, v1 } = best;
  if (v1 - v0 > u1 - u0) {
    [ux, uz, vx, vz] = [vx, vz, -ux, -uz];
    [u0, u1, v0, v1] = [v0, v1, -u1, -u0];
  }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return { cx: cu * ux + cv * vx, cz: cu * uz + cv * vz, ux, uz, vx, vz, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2 };
}

// Corners of an oriented box expanded by (du, dv), counter-clockwise order.
export function boxCorners(o, du = 0, dv = 0) {
  const hu = o.hu + du, hv = o.hv + dv;
  return [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]].map(([a, b]) => [o.cx + o.ux * a + o.vx * b, o.cz + o.uz * a + o.vz * b]);
}

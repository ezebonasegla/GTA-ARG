// Metrobus de Av. Calchaquí: two central bus-only lanes, cars in the outer lanes, and
// raised stations between the bus lane and the car lanes (buses open on the right).
// Offsets are measured to the right of a road's drawn direction, i.e. along (-dz, dx).
import * as THREE from 'three';
import { closestOnSegment } from './geo.js';

export const BUS_W = 3.6; // width of each bus lane
export const PLAT_W = 2.6;
const PLAT_L = 34, PLAT_H = 0.32;

const isMetro = (r) => r.kind === 'primary' && /calchaq/i.test(r.name || '');

// road.metro = { median }: offset of the corridor's center line from this carriageway's
// centerline. Two-way stretches are centered (0); a one-way carriageway of the dual
// avenue has its median halfway to the opposite carriageway, on its left.
export function markMetro(roads) {
  const list = roads.filter(isMetro);
  for (const r of list) {
    if (!r.oneway) {
      r.metro = { median: 0 };
      continue;
    }
    let sum = 0, n = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const l = Math.hypot(bx - ax, bz - az) || 1, dx = (bx - ax) / l, dz = (bz - az) / l;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let best = Infinity, side = 0;
      for (const o of list) {
        if (o === r || !o.oneway) continue;
        for (let j = 0; j < o.pts.length - 1; j++) {
          const [cx, cz] = o.pts[j], [ex, ez] = o.pts[j + 1];
          if ((ex - cx) * dx + (ez - cz) * dz > -0.7 * Math.hypot(ex - cx, ez - cz)) continue; // opposite direction only
          const [px, pz, , d2] = closestOnSegment(mx, mz, cx, cz, ex, ez);
          if (d2 < best) {
            best = d2;
            side = (px - mx) * -dz + (pz - mz) * dx;
          }
        }
      }
      const d = Math.sqrt(best);
      if (d > 6 && d < 24 && side < 0) {
        sum += d;
        n++;
      }
    }
    // no partner nearby: the bus lane takes the left edge of this carriageway
    r.metro = { median: n ? -sum / n / 2 : -(r.w / 2 - 0.3) };
  }
}

// Offset (right of the travel direction) of the bus lane / the car lane on a metro road.
// (dx, dz) is the travel direction; on two-way stretches it doesn't matter.
export const busLaneOffset = (road) => road.metro.median + BUS_W / 2;
export const carLaneOffset = (road) => Math.min(road.metro.median + BUS_W + PLAT_W + 1.6, road.w / 2 - 1.4);

export function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / l) * off, p[1] + ((b[0] - a[0]) / l) * off];
  });
}

// Concrete bus lanes and yellow separators, drawn with the builder's ribbon helper.
export function drawMetroLanes(roads, ribbon, bufs) {
  for (const r of roads) {
    if (!r.metro) continue;
    const m = r.metro.median;
    if (!r.oneway) {
      ribbon(bufs.lane, r.pts, BUS_W * 2, 0.065, 1 / 12);
      for (const o of [-BUS_W, BUS_W]) ribbon(bufs.yellow, offsetLine(r.pts, o), 0.35, 0.07, 1);
      ribbon(bufs.white, r.pts, 0.14, 0.07, 1);
    } else {
      ribbon(bufs.lane, offsetLine(r.pts, m + BUS_W / 2), BUS_W, 0.065, 1 / 12);
      ribbon(bufs.yellow, offsetLine(r.pts, m + BUS_W), 0.35, 0.07, 1);
      ribbon(bufs.white, offsetLine(r.pts, m), 0.14, 0.07, 1);
    }
  }
}

// Station at point (x, z) of a metro road, for buses travelling along (dx, dz): a raised
// platform on the right of the bus lane, with a canopy, glass back and the blue sign.
// Returns the geometries to merge and the spot where passengers wait.
const parts = (() => {
  const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
  const deck = [box(PLAT_W, PLAT_H, PLAT_L, 0, 0, 0)];
  const edge = [box(0.3, 0.01, PLAT_L, -PLAT_W / 2 + 0.15, PLAT_H, 0)]; // tactile yellow strip
  const frame = [box(PLAT_W + 0.4, 0.12, PLAT_L * 0.7, 0.1, 3.0, 0)];
  for (let z = -PLAT_L * 0.33; z <= PLAT_L * 0.34; z += PLAT_L * 0.165) frame.push(box(0.12, 2.7, 0.12, PLAT_W / 2 - 0.25, PLAT_H, z));
  frame.push(box(0.1, 1.0, PLAT_L, PLAT_W / 2 - 0.05, PLAT_H, 0)); // railing on the car side
  const glass = [box(0.03, 1.6, PLAT_L * 0.66, PLAT_W / 2 - 0.12, PLAT_H + 1.0, 0)];
  const sign = [box(0.08, 0.7, 3.2, 0.1, 3.12, PLAT_L * 0.35 - 1.6)];
  return { deck, edge, frame, glass, sign };
})();

export function stationAt(road, x, z, dx, dz) {
  // right-hand normal of travel; the platform's center sits past the bus lane
  const nx = -dz, nz = dx;
  const off = BUS_W + PLAT_W / 2 + 0.15;
  const cx = x + nx * off, cz = z + nz * off;
  // local frame: x across (towards the cars), z along travel
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(nx, 0, nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz)).setPosition(cx, 0, cz);
  const out = {};
  for (const [k, list] of Object.entries(parts)) out[k] = list.map((g) => g.clone().applyMatrix4(m));
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + nx * a * PLAT_W / 2 + dx * b * PLAT_L / 2, cz + nz * a * PLAT_W / 2 + dz * b * PLAT_L / 2]);
  return { geos: out, corners, height: PLAT_H, wait: { x: cx - nx * 0.3, z: cz - nz * 0.3, nx, nz, dx, dz, len: PLAT_L * 0.7 } };
}

export function signTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e4002b';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('METROBUS', 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

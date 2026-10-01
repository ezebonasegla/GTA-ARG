// 2D collision against building footprints (polygons) and round props (trees, poles).
import { SpatialHash, bbox, closestOnSegment, pointInPolygon } from './geo.js';
import { deckHeight } from './corridors.js';

export class CollisionWorld {
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

  // Height of the tallest building footprint containing the point (0 if none).
  heightAt(x, z) {
    let h = 0;
    for (const s of this.hash.query(x, z, x, z)) {
      if (s.type === 'poly' && s.height > h && pointInPolygon(x, z, s.pts)) h = s.height;
    }
    return h;
  }

  // Height of the bridge or trench deck under (x, z) for something heading (dx, dz)
  // (null: any heading) and currently at height fromY; null off every deck.
  levelAt(x, z, dx = null, dz = null, fromY = null) {
    if (!this.decksAt) return null;
    for (const d of this.decksAt(x, z)) {
      const h = deckHeight(d, x, z, dx, dz, fromY);
      if (h !== null) return h;
    }
    return null;
  }

  // Height of walkable raised surfaces (station platforms, decks) under a point.
  floorAt(x, z, fromY = null) {
    const deck = this.levelAt(x, z, null, null, fromY);
    if (deck !== null) return deck;
    let h = 0;
    for (const s of this.hash.query(x, z, x, z)) {
      if (s.tag === 'platform' && s.height > h && pointInPolygon(x, z, s.pts)) h = s.height;
    }
    return h;
  }

  // Push a circle out of every solid it overlaps. Returns the corrected position
  // and the accumulated contact normal (zero when no contact). Solids tagged
  // `ignoreTag` are skipped (the player walks onto platforms).
  resolve(x, z, r, ignoreTag) {
    let nx = 0, nz = 0, hit = false;
    const cands = this.hash.query(x - r - 1, z - r - 1, x + r + 1, z + r + 1);
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const s of cands) {
        if (ignoreTag && (ignoreTag.has ? ignoreTag.has(s.tag) : s.tag === ignoreTag)) continue;
        if (s.type === 'circle') {
          const dx = x - s.x, dz = z - s.z;
          const d = Math.hypot(dx, dz);
          const min = s.r + r;
          if (d < min && d > 1e-6) {
            const k = (min - d) / d;
            x += dx * k;
            z += dz * k;
            nx += dx / d;
            nz += dz / d;
            hit = moved = true;
          }
          continue;
        }
        const p = s.pts;
        const inside = pointInPolygon(x, z, p);
        let best = Infinity, bx = 0, bz = 0;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const c = closestOnSegment(x, z, p[j][0], p[j][1], p[i][0], p[i][1]);
          if (c[3] < best) {
            best = c[3];
            bx = c[0];
            bz = c[1];
          }
        }
        const d = Math.sqrt(best);
        if (!inside && d >= r) continue;
        let dx = x - bx, dz = z - bz;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        if (inside) {
          dx = -dx;
          dz = -dz;
        }
        const push = inside ? d + r : r - d;
        x += dx * push;
        z += dz * push;
        nx += dx;
        nz += dz;
        hit = moved = true;
      }
      if (!moved) break;
    }
    const nl = Math.hypot(nx, nz) || 1;
    return { x, z, hit, nx: nx / nl, nz: nz / nl };
  }
}

// Directed road graph used by traffic, pedestrians and the HUD street label.
import { SpatialHash, closestOnSegment } from './geo.js';

export class RoadGraph {
  constructor(roads) {
    this.nodes = [];
    this.edges = [];
    this.byKey = new Map();
    this.segIndex = new SpatialHash(40);
    for (const road of roads) {
      const drivable = road.kind !== 'footway';
      for (let i = 0; i < road.pts.length - 1; i++) {
        const a = this.node(road.pts[i]);
        const b = this.node(road.pts[i + 1]);
        if (a === b) continue;
        a.roads.add(road);
        b.roads.add(road);
        a.neighbors.add(b);
        b.neighbors.add(a);
        a.links.set(b, road);
        b.links.set(a, road);
        const seg = { a, b, road };
        this.segIndex.insert(seg, {
          minX: Math.min(a.x, b.x) - road.w, maxX: Math.max(a.x, b.x) + road.w,
          minZ: Math.min(a.z, b.z) - road.w, maxZ: Math.max(a.z, b.z) + road.w,
        });
        if (!drivable) continue;
        this.edge(a, b, road);
        if (!road.oneway) this.edge(b, a, road);
      }
    }
    for (const n of this.nodes) n.degree = n.neighbors.size;
  }

  node([x, z]) {
    const key = `${Math.round(x * 2)},${Math.round(z * 2)}`;
    let n = this.byKey.get(key);
    if (!n) {
      n = { id: this.nodes.length, x, z, out: [], roads: new Set(), neighbors: new Set(), links: new Map() };
      this.byKey.set(key, n);
      this.nodes.push(n);
    }
    return n;
  }

  edge(a, b, road) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const e = { id: this.edges.length, a, b, road, len, dx: dx / len, dz: dz / len };
    this.edges.push(e);
    a.out.push(e);
    return e;
  }

  // Nearest road segment to a point, or null if farther than maxDist.
  nearest(x, z, maxDist = 30) {
    const cands = this.segIndex.query(x - maxDist, z - maxDist, x + maxDist, z + maxDist);
    let best = null, bestD = maxDist * maxDist;
    for (const s of cands) {
      const [cx, cz, t, d] = closestOnSegment(x, z, s.a.x, s.a.z, s.b.x, s.b.z);
      if (d < bestD) {
        bestD = d;
        best = { seg: s, x: cx, z: cz, t, dist: Math.sqrt(d) };
      }
    }
    return best;
  }

  nearestEdge(x, z, maxDist = 60) {
    const n = this.nearest(x, z, maxDist);
    if (!n) return null;
    const { a, b } = n.seg;
    return a.out.find((e) => e.b === b) || b.out.find((e) => e.b === a) || null;
  }

  nearestNode(x, z, maxDist = 150) {
    const n = this.nearest(x, z, maxDist);
    if (!n) return null;
    const { a, b } = n.seg;
    return Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b;
  }

  // A* shortest path, returns the node list or null. Undirected by default (police and
  // pedestrians ignore one-way streets); `directed` follows the traffic direction.
  path(from, to, maxNodes = 4000, directed = false) {
    if (!from || !to) return null;
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const done = new Set();
    const heap = [[Math.hypot(from.x - to.x, from.z - to.z), from]];
    const push = (item) => {
      heap.push(item);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top[1];
    };
    while (heap.length && done.size < maxNodes) {
      const n = pop();
      if (done.has(n)) continue;
      if (n === to) break;
      done.add(n);
      const next = directed ? n.out.map((e) => e.b) : n.neighbors;
      for (const m of next) {
        if (!directed && n.links.get(m)?.kind === 'footway') continue;
        const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z);
        if (d < (dist.get(m) ?? Infinity)) {
          dist.set(m, d);
          prev.set(m, n);
          push([d + Math.hypot(m.x - to.x, m.z - to.z), m]);
        }
      }
    }
    if (!prev.has(to) && from !== to) return null;
    const out = [to];
    while (out[0] !== from) out.unshift(prev.get(out[0]));
    return out;
  }

  // Random directed edge among the streets within maxD of (x, z).
  randomEdgeNear(x, z, maxD, rng, filter) {
    const segs = [...this.segIndex.query(x - maxD, z - maxD, x + maxD, z + maxD)];
    for (let k = 0; k < 40 && segs.length; k++) {
      const s = segs[Math.floor(rng() * segs.length)];
      const opts = s.a.out.filter((e) => e.b === s.b).concat(s.b.out.filter((e) => e.b === s.a));
      const e = opts[Math.floor(rng() * opts.length)];
      if (e && e.len > 20 && (!filter || filter(e))) return e;
    }
    return null;
  }

  randomEdge(rng, filter) {
    for (let k = 0; k < 200; k++) {
      const e = this.edges[Math.floor(rng() * this.edges.length)];
      if (e && e.len > 20 && (!filter || filter(e))) return e;
    }
    return this.edges[0];
  }
}

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

  // Undirected shortest path (police ignore one-way streets). Returns node list.
  path(from, to, maxNodes = 4000) {
    if (!from || !to) return null;
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const open = [from];
    let visited = 0;
    while (open.length && visited++ < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i]) + h(open[i]) < dist.get(open[bi]) + h(open[bi])) bi = i;
      const n = open.splice(bi, 1)[0];
      if (n === to) break;
      for (const m of n.neighbors) {
        const road = n.links.get(m);
        if (road && road.kind === 'footway') continue;
        const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z);
        if (d < (dist.get(m) ?? Infinity)) {
          if (!dist.has(m)) open.push(m);
          dist.set(m, d);
          prev.set(m, n);
        }
      }
    }
    if (!prev.has(to) && from !== to) return null;
    const out = [to];
    while (out[0] !== from) out.unshift(prev.get(out[0]));
    return out;
    function h(n) {
      return Math.hypot(n.x - to.x, n.z - to.z);
    }
  }

  randomEdge(rng, filter) {
    for (let k = 0; k < 200; k++) {
      const e = this.edges[Math.floor(rng() * this.edges.length)];
      if (e && e.len > 20 && (!filter || filter(e))) return e;
    }
    return this.edges[0];
  }
}

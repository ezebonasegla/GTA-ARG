// Street corner signs: where the posts go, and the street name and house-number
// range ("altura") each plate shows. Pure JS, shared by the map import script
// (with real addresses) and the game (procedural map / old data files).
//
// Argentine convention: numbers grow by 100 per block along a street, with even
// numbers on one side and odd on the other. Blocks with known addresses take their
// hundreds from them; the rest are interpolated / propagated along the street.
import { RoadGraph } from './roadGraph.js';
import { SpatialHash, closestOnSegment } from './geo.js';

const SIGN_KINDS = new Set(['primary', 'secondary', 'residential', 'pedestrian']);
const ABBR = {
  av: 'avenida', avda: 'avenida', avd: 'avenida', c: 'calle', cl: 'calle', pje: 'pasaje', psje: 'pasaje', pasj: 'pasaje',
  gral: 'general', gdor: 'gobernador', pres: 'presidente', pte: 'presidente', dr: 'doctor', dra: 'doctora', ing: 'ingeniero',
  almte: 'almirante', alte: 'almirante', cnel: 'coronel', tte: 'teniente', cap: 'capitan', cmte: 'comandante', sgto: 'sargento',
  sta: 'santa', sto: 'santo', prof: 'profesor', mons: 'monsenor', gob: 'gobernador', diag: 'diagonal',
};
const PREFIX = new Set(['avenida', 'calle', 'pasaje', 'peatonal']);
// Words ignored by the loose comparison ("M. T. de Alvear" ~ "Marcelo Torcuato de Alvear").
const WEAK = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'general', 'presidente', 'doctor', 'doctora', 'ingeniero', 'almirante',
  'coronel', 'teniente', 'capitan', 'comandante', 'sargento', 'gobernador', 'profesor', 'monsenor', 'bis',
]);

function tokens(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((t) => ABBR[t] || t);
}

// Grouping key: "Av. Hipólito Yrigoyen" and "AVENIDA HIPOLITO YRIGOYEN" -> "hipolito yrigoyen".
export function streetKey(name) {
  const t = tokens(name || '');
  while (t.length > 1 && PREFIX.has(t[0])) t.shift();
  return t.join(' ');
}

function looseSet(name) {
  return new Set(tokens(name).filter((t) => !PREFIX.has(t) && !WEAK.has(t) && (t.length > 2 || /\d/.test(t))));
}

// Same street, spelled differently?
export function namesMatch(a, b) {
  if (streetKey(a) === streetKey(b)) return true;
  const A = looseSet(a), B = looseSet(b);
  if (!A.size || !B.size) return false;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

// Text for the plate: "Avenida Mitre" -> "Av. Mitre".
export function signName(name) {
  return name.replace(/^avenida\s+/i, 'Av. ').replace(/^calle\s+(?=\D)/i, '').trim();
}

const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// roads: city roads; addresses: [{ x, z, number, street }]; opts.blocked(x, z) -> bool.
// Returns { posts: [{ x, z, signs: [{ name, from, to, dir }] }], stats }.
export function computeStreetSigns(roads, addresses = [], opts = {}) {
  const blocked = opts.blocked || (() => false);
  const eligible = roads.filter((r) => r.name && SIGN_KINDS.has(r.kind) && streetKey(r.name));
  const graph = new RoadGraph(eligible);
  const keyOf = new Map(eligible.map((r) => [r, streetKey(r.name)]));

  // Display name per street: the most common spelling.
  const spellings = new Map();
  for (const r of eligible) {
    const k = keyOf.get(r);
    if (!spellings.has(k)) spellings.set(k, new Map());
    const m = spellings.get(k);
    m.set(r.name, (m.get(r.name) || 0) + 1);
  }
  const displayName = new Map([...spellings].map(([k, m]) => [k, signName([...m].sort((a, b) => b[1] - a[1])[0][0])]));

  // Streets (by key) meeting at each node.
  const keysAt = (n) => {
    const s = new Set();
    for (const r of n.links.values()) s.add(keyOf.get(r));
    return s;
  };

  // ------------------------------------------------ street components and blocks
  // Edge id for the undirected pair of nodes.
  const eid = (a, b) => (a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`);
  const edgeBlock = new Map(); // eid -> block
  const blocks = [];
  const comps = []; // { key, nodes, blocks, s: Map(node -> arc length) }
  const seen = new Set(); // `${key}|${node.id}`
  const streetNbrs = (n, key) => [...n.links].filter(([, r]) => keyOf.get(r) === key).map(([m]) => m);
  for (const start of graph.nodes) {
    for (const key of keysAt(start)) {
      if (seen.has(`${key}|${start.id}`)) continue;
      // flood the connected part of this street
      const nodes = [];
      const stack = [start];
      seen.add(`${key}|${start.id}`);
      while (stack.length) {
        const n = stack.pop();
        nodes.push(n);
        for (const m of streetNbrs(n, key)) {
          if (seen.has(`${key}|${m.id}`)) continue;
          seen.add(`${key}|${m.id}`);
          stack.push(m);
        }
      }
      const comp = { key, nodes, blocks: [] };
      // arc length from one extreme end (two Dijkstra passes)
      const far = dijkstra(nodes[0], key);
      let end = nodes[0];
      for (const [n, d] of far) if (d > far.get(end)) end = n;
      comp.s = dijkstra(end, key);
      // cut the street into blocks at crossings, ends and forks
      const isCut = (n) => keysAt(n).size > 1 || streetNbrs(n, key).length !== 2;
      for (const n of nodes) {
        if (!isCut(n)) continue;
        for (const m0 of streetNbrs(n, key)) {
          if (edgeBlock.has(eid(n, m0))) continue;
          const block = { comp, segs: [], a: n, b: null };
          let prev = n, cur = m0;
          for (;;) {
            block.segs.push([prev, cur]);
            edgeBlock.set(eid(prev, cur), block);
            if (isCut(cur)) break;
            const next = streetNbrs(cur, key).find((m) => m !== prev);
            if (!next || edgeBlock.has(eid(cur, next))) break;
            prev = cur;
            cur = next;
          }
          block.b = cur;
          const sa = comp.s.get(block.a) ?? 0, sb = comp.s.get(block.b) ?? 0;
          block.s0 = Math.min(sa, sb);
          block.s1 = Math.max(sa, sb);
          block.mid = (sa + sb) / 2;
          block.nums = [];
          comp.blocks.push(block);
          blocks.push(block);
        }
      }
      comps.push(comp);
    }
  }
  function dijkstra(src, key) {
    const dist = new Map([[src, 0]]);
    const open = [src];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
      const n = open.splice(bi, 1)[0];
      for (const m of streetNbrs(n, key)) {
        const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z);
        if (d < (dist.get(m) ?? Infinity)) {
          if (!dist.has(m)) open.push(m);
          dist.set(m, d);
        }
      }
    }
    return dist;
  }

  // ------------------------------------------------ addresses -> blocks
  const segIndex = new SpatialHash(50);
  for (const b of blocks) {
    for (const [p, q] of b.segs) {
      segIndex.insert({ p, q, block: b }, { minX: Math.min(p.x, q.x), minZ: Math.min(p.z, q.z), maxX: Math.max(p.x, q.x), maxZ: Math.max(p.z, q.z) });
    }
  }
  let matched = 0;
  const R = 45;
  const nameCache = new Map();
  for (const ad of addresses) {
    let best = null, bestD = R * R;
    for (const sg of segIndex.query(ad.x - R, ad.z - R, ad.x + R, ad.z + R)) {
      const ck = `${ad.street}|${sg.block.comp.key}`;
      if (!nameCache.has(ck)) nameCache.set(ck, namesMatch(ad.street, displayName.get(sg.block.comp.key)));
      if (!nameCache.get(ck)) continue;
      const c = closestOnSegment(ad.x, ad.z, sg.p.x, sg.p.z, sg.q.x, sg.q.z);
      if (c[3] < bestD) {
        bestD = c[3];
        best = { sg, t: c[2] };
      }
    }
    if (!best) continue;
    const { p, q, block } = best.sg;
    const s = block.comp.s;
    const sp = s.get(p), sq = s.get(q);
    const along = sp + (sq - sp) * best.t;
    // side of the street, relative to the direction of increasing arc length
    const dirx = (q.x - p.x) * Math.sign(sq - sp || 1), dirz = (q.z - p.z) * Math.sign(sq - sp || 1);
    const side = Math.sign(dirx * (ad.z - p.z) - dirz * (ad.x - p.x)) || 1;
    block.nums.push({ n: ad.number, s: along, side });
    matched++;
  }

  // ------------------------------------------------ hundreds per block
  let estimated = 0, known = 0;
  const parityVotes = []; // [comp, sum of side * parity]
  let convention = 0; // +1: even numbers on the side where side = +1 when walking towards higher numbers
  const compDir = new Map();
  for (const comp of comps) {
    const pts = comp.blocks.flatMap((b) => b.nums);
    if (!pts.length) continue;
    // robust fit number ~ s (Theil–Sen slope) to drop misplaced addresses
    let slope = 0;
    if (pts.length >= 2) {
      const sl = [];
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length && sl.length < 4000; j++) {
          const ds = pts[j].s - pts[i].s;
          if (Math.abs(ds) > 20) sl.push((pts[j].n - pts[i].n) / ds);
        }
      }
      if (sl.length) slope = median(sl);
    }
    const icpt = median(pts.map((p) => p.n - slope * p.s));
    const ok = (p) => pts.length < 4 || Math.abs(p.n - (icpt + slope * p.s)) < 450;
    let anchors = [];
    for (const b of comp.blocks) {
      const good = b.nums.filter(ok);
      if (good.length) {
        b.hundred = Math.floor(median(good.map((p) => p.n)) / 100) * 100;
        b.weight = good.length;
        anchors.push(b);
      }
    }
    anchors.sort((a, b) => a.mid - b.mid);
    let dir = 0;
    if (anchors.length >= 2) dir = Math.sign(anchors[anchors.length - 1].hundred - anchors[0].hundred) || Math.sign(slope);
    else if (Math.abs(slope) > 0.2 && pts.length >= 3) dir = Math.sign(slope);
    if (dir && anchors.length >= 3) {
      // numbers must grow along the street: keep the heaviest monotonic subsequence
      const best = anchors.map((a) => a.weight), prev = anchors.map(() => -1);
      for (let i = 0; i < anchors.length; i++) {
        for (let j = 0; j < i; j++) {
          if ((anchors[i].hundred - anchors[j].hundred) * dir >= 0 && best[j] + anchors[i].weight > best[i]) {
            best[i] = best[j] + anchors[i].weight;
            prev[i] = j;
          }
        }
      }
      let i = best.indexOf(Math.max(...best));
      const keep = new Set();
      for (; i >= 0; i = prev[i]) keep.add(anchors[i]);
      for (const a of anchors) if (!keep.has(a)) delete a.hundred;
      anchors = anchors.filter((a) => keep.has(a));
    }
    known += anchors.length;
    if (dir) compDir.set(comp, dir);
    let v = 0;
    for (const p of pts.filter(ok)) v += p.side * (p.n % 2 === 0 ? 1 : -1);
    if (dir && v) convention += Math.sign(v) * dir;
    parityVotes.push([comp, v]);
  }
  convention = Math.sign(convention);
  for (const [comp, v] of parityVotes) {
    if (!compDir.has(comp) && convention && Math.abs(v) >= 2) compDir.set(comp, Math.sign(v) * convention);
  }
  for (const comp of comps) {
    const anchors = comp.blocks.filter((b) => b.hundred !== undefined).sort((a, b) => a.mid - b.mid);
    if (!anchors.length) continue;
    const dir = compDir.get(comp) || 0;
    const ordered = comp.blocks.slice().sort((a, b) => a.mid - b.mid);
    const idx = new Map(ordered.map((b, i) => [b, i]));
    for (const b of ordered) {
      if (b.hundred !== undefined) continue;
      const i = anchors.findIndex((a) => a.mid > b.mid);
      const a0 = anchors[i > 0 ? i - 1 : anchors.length - 1], a1 = anchors[i];
      // numbers per meter between the two known blocks (~1 on a regular grid)
      const rate = i > 0 ? Math.abs(a1.hundred - a0.hundred) / Math.max(1, a1.mid - a0.mid) : 0;
      let h;
      if (i > 0 && rate < 2.5 && (rate > 0.4 || idx.get(a1) - idx.get(a0) < 3)) {
        // between two known blocks that agree: interpolate along the street
        const t = (b.mid - a0.mid) / (a1.mid - a0.mid || 1);
        h = Math.round((a0.hundred + (a1.hundred - a0.hundred) * t) / 100) * 100;
      } else if (dir || i > 0) {
        // beyond the known part (or across a numbering break): 100 per block from the nearest known one
        const near = i === 0 ? a1 : i < 0 ? a0 : idx.get(b) - idx.get(a0) <= idx.get(a1) - idx.get(b) ? a0 : a1;
        const d = i > 0 ? Math.sign(a1.hundred - a0.hundred) || dir : dir;
        h = near.hundred + d * 100 * (idx.get(b) - idx.get(near));
      } else continue;
      if (h >= 0) {
        b.hundred = h;
        b.estimated = true;
        estimated++;
      }
    }
    comp.dir = dir || (anchors.length >= 2 ? Math.sign(anchors[anchors.length - 1].hundred - anchors[0].hundred) : 0);
  }

  // ------------------------------------------------ one post per intersection
  const posts = [];
  const nearRoads = new SpatialHash(40);
  for (const r of roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      nearRoads.insert({ a, b, w: r.w }, { minX: Math.min(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxX: Math.max(a[0], b[0]), maxZ: Math.max(a[1], b[1]) });
    }
  }
  const onRoad = (x, z) => {
    for (const s of nearRoads.query(x - 15, z - 15, x + 15, z + 15)) {
      if (closestOnSegment(x, z, s.a[0], s.a[1], s.b[0], s.b[1])[3] < (s.w / 2 + 0.5) ** 2) return true;
    }
    return false;
  };
  const used = [];
  const usedIndex = new SpatialHash(30);
  for (const n of graph.nodes) {
    const keys = keysAt(n);
    if (keys.size < 2) continue;
    // incident street arms sorted by angle
    const arms = [...n.links].map(([m, r]) => {
      const dx = m.x - n.x, dz = m.z - n.z, l = Math.hypot(dx, dz) || 1;
      return { m, r, key: keyOf.get(r), dx: dx / l, dz: dz / l, ang: Math.atan2(dz, dx) };
    }).sort((a, b) => a.ang - b.ang);
    // skip crossings right next to an existing post (dual carriageways, tiny offsets)
    if ([...usedIndex.query(n.x - 30, n.z - 30, n.x + 30, n.z + 30)].some((u) => Math.hypot(u.x - n.x, u.z - n.z) < 30 && [...keys].every((k) => u.keys.has(k)))) continue;
    const corners = [];
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i], b = arms[(i + 1) % arms.length];
      let gap = b.ang - a.ang;
      if (gap <= 0) gap += Math.PI * 2;
      if (arms.length === 1 || gap < 0.6) continue;
      const bis = a.ang + gap / 2;
      const hw = Math.max(a.r.w, b.r.w) / 2 + 1.3;
      const d = Math.min(hw * 2.2, hw / Math.sin(Math.min(gap, Math.PI) / 2));
      const x = n.x + Math.cos(bis) * d, z = n.z + Math.sin(bis) * d;
      // real corners (between two different streets) first
      const score = (a.key !== b.key ? 0 : 1) + Math.abs(gap - Math.PI / 2) * 0.3;
      corners.push({ x, z, a, b, score });
    }
    corners.sort((p, q) => p.score - q.score);
    const corner = corners.find((c) => !onRoad(c.x, c.z) && !blocked(c.x, c.z));
    if (!corner) continue;
    const bis = Math.atan2(corner.z - n.z, corner.x - n.x);
    const signs = [];
    for (const key of keys) {
      // the arm of this street along the corner's sidewalk (or the closest one)
      let arm = [corner.a, corner.b].find((a) => a.key === key);
      if (!arm) {
        let bd = Infinity;
        for (const a of arms) {
          if (a.key !== key) continue;
          let d = Math.abs(a.ang - bis) % (Math.PI * 2);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < bd) (bd = d), (arm = a);
        }
      }
      const block = edgeBlock.get(eid(n, arm.m));
      const sign = { name: displayName.get(key), dir: [round2(arm.dx), round2(arm.dz)] };
      if (block?.hundred !== undefined) {
        // from: number at this corner, to: at the far end of the block (along dir)
        const sHere = block.comp.s.get(n), sThere = block.comp.s.get(arm.m);
        const up = (block.comp.dir || 1) * Math.sign(sThere - sHere || 1) > 0;
        sign.from = up ? block.hundred : block.hundred + 100;
        sign.to = up ? block.hundred + 100 : block.hundred;
        if (block.estimated || !block.comp.dir) sign.est = 1;
      }
      signs.push(sign);
    }
    const post = { x: round1(corner.x), z: round1(corner.z), signs };
    posts.push(post);
    const u = { x: n.x, z: n.z, keys };
    usedIndex.insert(u, { minX: n.x, minZ: n.z, maxX: n.x, maxZ: n.z });
    used.push(u);
  }

  const plates = posts.reduce((s, p) => s + p.signs.length, 0);
  const withNum = posts.reduce((s, p) => s + p.signs.filter((g) => g.from !== undefined).length, 0);
  return {
    posts,
    stats: { addresses: addresses.length, matched, blocks: blocks.length, known, estimated, posts: posts.length, plates, withNum },
  };
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 1000) / 1000;

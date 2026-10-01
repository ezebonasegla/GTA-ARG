// Building meshes: walls and roofs of every building go into the chunk's facade
// buffer (one texture-array material). Houses facing the street get a ground floor
// with doors, windows with rejas and portones; the other walls are medianeras.
// Self-built villa houses get ladrillo hueco, chapa roofs with stones and tires,
// rebar sticking out of the slabs and water tanks on stilts.
import * as THREE from 'three';
import { mulberry32, hashString, polygonArea, pointInPolygon, bbox } from './geo.js';
import { template } from './geobuf.js';
import { ATLAS } from './conurbanoTextures.js';

// Tint palettes (sRGB hex) per facade style.
const PALETTES = {
  house: ['#f3eee2', '#efe1c4', '#f2d6c0', '#e9c9a8', '#dfe4dc', '#d9e2ea', '#f4e7a8', '#e7b89a', '#cfd8c0', '#ffffff', '#e9dccb', '#d8c7b0', '#c9d6de', '#f0c9b4',
    '#e8d9b0', '#d6c3a5', '#c7cfc0', '#e3cfc2', '#bfcfd8', '#f1e3d3'],
  brick: ['#ffffff', '#f2eeea', '#e6dcd6', '#ffece0'],
  apartments: ['#ffffff', '#efece6', '#e6e1d6', '#d9d6d0', '#f3eadb', '#dfe3e6'],
  office: ['#ffffff', '#dfe8ee', '#e8efe8', '#d6dde6'],
  church: ['#ffffff', '#f4ead6'],
  villa: ['#7fb3e0', '#e88a8a', '#9fcf8a', '#f5d97a', '#f4b27a', '#d59ac0', '#ffffff', '#b8acdf', '#8fd0c8', '#e9e1a0', '#f0c0c0'],
};

const STYLE_MAP = {
  house: 'house', ph: 'house', apartments: 'apartments', brick: 'brick', office: 'office',
  church: 'church', civic: 'church', station: 'brick', mall: 'office', monument: 'church',
  industrial: 'brick', school: 'brick', hospital: 'apartments', brewery: 'brick',
};

const box = (w, h, d, y = h / 2) => template(new THREE.BoxGeometry(w, h, d).translate(0, y, 0));
const TPL = {
  cube: box(1, 1, 1),
  tire: template(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 7).translate(0, 0.1, 0)),
  stone: template(new THREE.OctahedronGeometry(0.2, 0).scale(1, 0.6, 1)),
  tank: template(new THREE.CylinderGeometry(0.55, 0.5, 1.1, 8, 1, true).translate(0, 0.55, 0)),
  lid: template(new THREE.CylinderGeometry(0.3, 0.55, 0.18, 8).translate(0, 1.19, 0)),
  pipe: template(new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0)),
  hat: template(new THREE.ConeGeometry(0.5, 0.4, 6).translate(0, 0.2, 0)),
  // DirecTV-style dish: shallow disc tilted up towards the north-east sky
  dish: template(new THREE.CylinderGeometry(0.42, 0.3, 0.08, 10).rotateX(1.1).translate(0, 0.75, 0)),
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function place(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const col = (hex) => new THREE.Color(hex);
const C = {
  concrete: col('#9d988e'), rebar: col('#5b3b28'), tire: col('#1d1d1d'), stone: col('#8a857c'), brick: col('#b5603c'),
  metal: col('#6d6f70'), alu: col('#b8bcbf'), pilar: col('#c9c3b6'), meter: col('#8e9396'), rust: col('#7a4a2c'), black: col('#202020'), beige: col('#d6cba2'), blue: col('#2d5f9a'), white: col('#e8e8e4'),
};

export function buildBuildings(data, { chunks, collision, tex }) {
  const L = tex.facades.layer;
  const tanks = [];
  const white = new THREE.Color(1, 1, 1);
  // stadium stands (landmarks.js) replace whatever footprints the data has under them
  const stadiums = (data.specials || []).filter((s) => s.type === 'stadium').map((s) => [s.box, 3 + Math.max(s.depth || 0, 12)]);
  const underStand = (x, z) => stadiums.some(([o, r]) => {
    const dx = x - o.cx, dz = z - o.cz;
    return Math.abs(dx * o.ux + dz * o.uz) < o.hu + r && Math.abs(dx * o.vx + dz * o.vz) < o.hv + r;
  });

  data.buildings.forEach((bld, idx) => {
    let pts = bld.pts;
    if (pts.length < 3) return;
    // cathedral and churches are modelled entirely in landmarks.js
    if (bld.special && (bld.special.type === 'cathedral' || bld.special.type === 'church')) return;
    if (!bld.special && underStand(pts[0][0], pts[0][1])) return;
    const n = pts.length;
    const flipped = polygonArea(pts) < 0;
    if (flipped) pts = pts.slice().reverse();
    const rng = mulberry32(hashString(`${idx}:${pts[0][0].toFixed(1)}`));
    const h = Math.max(2.5, bld.h || 6);
    const bb = bbox(pts);
    const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
    const chunk = chunks.at(cx, cz);
    const buf = chunk.facade;
    collision.addPolygon(pts, h, 'building');

    if (bld.villa || bld.style === 'villa') {
      villaHouse(pts, h, bld.levels || 1, rng, chunk, L, tanks);
      return;
    }

    let style = STYLE_MAP[bld.style] || 'house';
    // most conurbano houses are plastered; ladrillo visto is the minority
    if (bld.style === 'brick' && h < 10.5 && rng() < 0.55) style = 'house';
    const palette = PALETTES[style];
    const tint = new THREE.Color(bld.color || palette[Math.floor(rng() * palette.length)]);
    const low = (style === 'house' || style === 'brick') && h < 10.5 && !bld.special;
    const hasFront = bld.front !== undefined && bld.front !== null;
    // bit of the original edge (the pipeline saw the ring before we reversed it)
    const isFront = (e) => {
      if (!hasFront) return true;
      const o = flipped ? (2 * n - 2 - e) % n : e;
      return o < 30 ? ((bld.front >>> o) & 1) === 1 : bld.front !== 0;
    };
    const area = Math.abs(polygonArea(pts));
    // no generic storefronts: the real businesses get theirs in shops.js
    const shopH = 0, shopLayer = null;
    const styleLayer = L[style];
    const groundLayer = L[`ground${Math.floor(rng() * 4)}`];
    // buildings with no street front (back of the lot) keep their windows all around
    const medLayer = hasFront && bld.front === 0 ? styleLayer : style === 'brick' || rng() < 0.25 ? L.medianeraLadrillo : L.medianera;
    const medTint = medLayer === L.medianeraLadrillo ? new THREE.Color().setScalar(0.92 + rng() * 0.1) : tint;
    const unfinished = low && !bld.shop && (bld.levels >= 2 ? rng() < 0.16 : rng() < 0.05);
    const topHueco = unfinished ? Math.max(0, h - 2.9) : h;
    const uOff = Math.floor(rng() * 4) * 1.5;

    let dist = 0;
    for (let e = 0; e < n; e++) {
      const p0 = pts[e], p1 = pts[(e + 1) % n];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len < 0.01) continue;
      const u0 = -dist / 6 + uOff;
      const front = isFront(e);
      if (low) {
        if (front) {
          let y = 0;
          if (shopH) {
            buf.wall(p0, p1, 0, shopH, -dist / 4, 4, shopH, white, shopLayer, 0);
            y = shopH;
          } else {
            const gh = Math.min(3, h);
            buf.wall(p0, p1, 0, gh, u0, 6, 3, tint, groundLayer, 0);
            y = gh;
          }
          if (topHueco - y > 0.05) buf.wall(p0, p1, y, topHueco, u0, 6, 6, tint, styleLayer);
        } else if (topHueco > 0.05) buf.wall(p0, p1, 0, topHueco, u0, 6, 6, medTint, medLayer);
        if (unfinished && h - topHueco > 0.05) buf.wall(p0, p1, topHueco, h, u0, 6, 5.8, white, front ? L.hueco : L.medianeraLadrillo, 0.5);
      } else {
        let y = 0;
        if (shopH && front) {
          buf.wall(p0, p1, 0, shopH, -dist / 4, 4, shopH, white, shopLayer, 0);
          y = shopH;
        }
        if (h - y > 0.1) buf.wall(p0, p1, y, h, u0, 6, 6, tint, styleLayer);
      }
      dist += len;
    }

    // Roofs
    const shade = 0.85 + rng() * 0.3;
    const roofTint = new THREE.Color(shade, shade, shade);
    const chalet = low && !bld.shop && !unfinished && n === 4 && h < 7 && area > 50 && area < 260 && rng() < 0.14;
    if ((bld.roof === 'gable' || chalet) && n === 4) {
      addGable(pts, h, buf, tint, roofTint, L.roofTile, style === 'brick' ? L.brick : L.medianera);
    } else if (bld.roof === 'spire') {
      const apex = [cx, h + Math.max(8, h * 0.35), cz];
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        buf.tri([a[0], h, a[1]], [b[0], h, b[1]], apex, [0, 0], [1, 0], [0.5, 1], new THREE.Color(0.55, 0.6, 0.62), [(a[0] + b[0]) / 2 - cx, 0.5, (a[1] + b[1]) / 2 - cz], L.roofTile);
      }
    } else {
      const r = rng();
      const roofLayer = style === 'office' || style === 'church' ? L.roofFlat : r < 0.45 ? L.roofFlat : r < 0.78 ? L.roofMembrana : L.roofBaldosa;
      flatRoof(buf, pts, h, roofTint, roofLayer);
      if (style !== 'office' && style !== 'church' && area > 40 && rng() < 0.7 && pointInPolygon(cx, cz, pts)) {
        tanks.push([cx + (rng() - 0.5) * 2, cz + (rng() - 0.5) * 2, h, h > 12 ? 1.6 : 1]);
      }
      if (low && pointInPolygon(cx, cz, pts)) roofGear(chunk.props, cx, cz, h, rng, 1);
      if (low) {
        if (unfinished) esperas(chunk.props, pts, h, rng, 0.6);
        // terraza con baranda sobre el frente
        else if (rng() < 0.35) {
          for (let e = 0; e < n; e++) {
            if (!isFront(e)) continue;
            const p0 = pts[e], p1 = pts[(e + 1) % n];
            railing(chunk.alpha, p0, p1, h, 1, ATLAS.baranda);
          }
        }
      }
    }

    // ---- street-facing detail: cornisa, balcones with railing, aires acondicionados
    if (!hasFront) return;
    const flat = !((bld.roof === 'gable' || chalet) && n === 4) && bld.roof !== 'spire';
    const apt = (style === 'apartments' || style === 'brick') && (bld.levels || 0) >= 3;
    const cornice = tint.clone().lerp(white, 0.45);
    for (let e = 0; e < n; e++) {
      if (!isFront(e)) continue;
      const p0 = pts[e], p1 = pts[(e + 1) % n];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len < 2) continue;
      const ux = (p1[0] - p0[0]) / len, uz = (p1[1] - p0[1]) / len, ox = uz, oz = -ux;
      const ry = Math.atan2(-uz, ux); // box local x along the wall
      const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
      if (flat && style !== 'church') chunk.props.add(TPL.cube, place(mx + ox * 0.1, h - 0.34, mz + oz * 0.1, len + 0.2, 0.54, 0.24, ry), cornice);
      if (apt) {
        const k = Math.floor((len - 0.6) / 3.4);
        for (let b = 0; b < k; b++) {
          if (rng() < 0.2) continue;
          const t = (b + 0.5) / k, x = p0[0] + ux * len * t, z = p0[1] + uz * len * t;
          const acFloor = rng() < 0.4 ? 1 + Math.floor(rng() * (bld.levels - 1)) : 0;
          for (let f = 1; f < bld.levels; f++) {
            const y = f * 3;
            chunk.props.add(TPL.cube, place(x + ox * 0.5, y - 0.08, z + oz * 0.5, 2.6, 0.16, 1, ry), C.white, 0.1);
            const A = [x - ux * 1.3 + ox, z - uz * 1.3 + oz], B = [x + ux * 1.3 + ox, z + uz * 1.3 + oz];
            railing(chunk.alpha, A, B, y + 0.08, 1, ATLAS.baranda, 2.6);
            railing(chunk.alpha, [x - ux * 1.3, z - uz * 1.3], A, y + 0.08, 1, ATLAS.baranda, 1);
            railing(chunk.alpha, B, [x + ux * 1.3, z + uz * 1.3], y + 0.08, 1, ATLAS.baranda, 1);
            if (f === acFloor) chunk.props.add(TPL.cube, place(x + ux * 1.75 + ox * 0.17, y + 1.62, z + uz * 1.75 + oz * 0.17, 0.82, 0.56, 0.3, ry), C.white);
          }
        }
      }
      // pilar de luz: the electricity meter column on the front wall, by the gate
      if (low && rng() < 0.3 && len > 4) {
        const t = rng() < 0.5 ? 0.12 : 0.88, x = p0[0] + ux * len * t + ox * 0.25, z = p0[1] + uz * len * t + oz * 0.25;
        chunk.props.add(TPL.cube, place(x, 0, z, 0.5, 1.7, 0.32, ry), C.pilar, 0.2);
        chunk.props.add(TPL.cube, place(x + ox * 0.17, 0.9, z + oz * 0.17, 0.34, 0.42, 0.06, ry), C.meter);
        chunk.props.add(TPL.pipe, place(x, 1.7, z, 0.05, 1.2, 0.05), C.metal);
      }
      if (!apt && low && rng() < 0.22) {
        const t = 0.2 + rng() * 0.6;
        chunk.props.add(TPL.cube, place(p0[0] + ux * len * t + ox * 0.17, Math.min(2.3, h - 0.8) - 0.28, p0[1] + uz * len * t + oz * 0.17, 0.82, 0.56, 0.3, ry), C.white);
      }
    }
  });
  return { tanks };
}

// TV antenna, satellite dish and the calefón's chimney with its "sombrero" on a flat roof.
function roofGear(props, cx, cz, h, rng, dishBias) {
  const j = () => (rng() - 0.5) * 2.4;
  if (rng() < 0.22) {
    const x = cx + j(), z = cz + j(), mh = 2.4 + rng() * 1.6, ry = rng() * 3;
    props.add(TPL.pipe, place(x, h, z, 0.05, mh, 0.05), C.alu);
    for (let k = 0; k < 3; k++) props.add(TPL.cube, place(x, h + mh - 0.15 - k * 0.32, z, 1.3 - k * 0.3, 0.025, 0.025, ry), C.alu);
  }
  if (rng() < 0.2 * dishBias) props.add(TPL.dish, place(cx + j(), h, cz + j(), 1, 1, 1, -0.8 + rng() * 0.6), C.white, 0.1);
  if (rng() < 0.35) {
    const x = cx + j(), z = cz + j();
    props.add(TPL.pipe, place(x, h, z, 0.12, 1.1, 0.12), C.metal);
    props.add(TPL.hat, place(x, h + 1.1, z, 0.42, 0.5, 0.42), C.metal);
  }
}

function flatRoof(buf, pts, h, tint, layer, scale = 1 / 6) {
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const [i, j, k] of faces) {
    const p = [pts[i], pts[j], pts[k]];
    buf.tri(...p.map(([x, z]) => [x, h, z]), ...p.map(([x, z]) => [x * scale, z * scale]), tint, [0, 1, 0], layer);
  }
}

// Alpha-tested railing/fence panel between two points, repeated every ~3 m.
export function railing(alpha, p0, p1, y0, height, rect, tile = 3, color = new THREE.Color(1, 1, 1)) {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const k = Math.max(1, Math.round(len / tile));
  const [u0, v0, u1, v1] = rect;
  for (let i = 0; i < k; i++) {
    const a = [p0[0] + ((p1[0] - p0[0]) * i) / k, p0[1] + ((p1[1] - p0[1]) * i) / k];
    const b = [p0[0] + ((p1[0] - p0[0]) * (i + 1)) / k, p0[1] + ((p1[1] - p0[1]) * (i + 1)) / k];
    alpha.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y0 + height, b[1]], [a[0], y0 + height, a[1]], [u0, v0], [u1, v0], [u1, v1], [u0, v1], color, [b[1] - a[1], 0, a[0] - b[0]]);
  }
}

// Columns with rebar left for the next floor ("esperas").
function esperas(props, pts, h, rng, chance) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    if (rng() > chance) continue;
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    // step inside the corner
    const dx = (a[0] + b[0]) / 2 - p[0], dz = (a[1] + b[1]) / 2 - p[1];
    const l = Math.hypot(dx, dz) || 1;
    const x = p[0] + (dx / l) * 0.2, z = p[1] + (dz / l) * 0.2;
    const ch = 0.2 + rng() * 0.6;
    props.add(TPL.cube, place(x, h, z, 0.22, ch, 0.22), C.concrete, 0.3);
    for (const [ox, oz] of [[-0.07, -0.07], [0.07, 0.07]]) {
      props.add(TPL.cube, place(x + ox, h + ch, z + oz, 0.022, 0.5 + rng() * 0.6, 0.022, 0, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.3), C.rebar);
    }
  }
}

function tankOnStilts(props, x, z, y, rng) {
  const legH = 1.2 + rng() * 1.4;
  const legC = rng() < 0.5 ? C.metal : C.rust;
  for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]]) props.add(TPL.cube, place(x + ox, y, z + oz, 0.06, legH, 0.06), legC);
  props.add(TPL.cube, place(x, y + legH, z, 1.1, 0.06, 1.1), legC);
  const r = rng();
  const tc = r < 0.5 ? C.black : r < 0.8 ? C.beige : C.blue;
  props.add(TPL.tank, place(x, y + legH + 0.06, z, 1, 1, 1), tc, 0.15);
  props.add(TPL.lid, place(x, y + legH + 0.06, z, 1, 1, 1), tc);
}

function villaHouse(pts, h, levels, rng, chunk, L, tanks) {
  const buf = chunk.facade;
  const n = pts.length;
  const r = rng();
  const scheme = r < 0.55 ? 'hueco' : r < 0.85 ? 'paint' : 'mixed';
  const paint = new THREE.Color(PALETTES.villa[Math.floor(rng() * PALETTES.villa.length)]);
  const raw = new THREE.Color().setRGB(0.92 + rng() * 0.12, 0.9 + rng() * 0.1, 0.88 + rng() * 0.1);
  const floorH = h / Math.max(1, levels);
  const uOff = rng() * 6;
  let dist = 0;
  for (let e = 0; e < n; e++) {
    const p0 = pts[e], p1 = pts[(e + 1) % n];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (len < 0.01) continue;
    const u0 = -dist / 6 + uOff;
    if (scheme === 'hueco') buf.wall(p0, p1, 0, h, u0, 6, floorH * 2, raw, L.hueco);
    else if (scheme === 'paint') buf.wall(p0, p1, 0, h, u0, 6, floorH * 2, paint, L.villa);
    else {
      buf.wall(p0, p1, 0, floorH, u0, 6, floorH * 2, paint, L.villa, 0);
      if (h - floorH > 0.05) buf.wall(p0, p1, floorH, h, u0, 6, floorH * 2, raw, L.hueco);
    }
    dist += len;
  }
  const bb = bbox(pts);
  const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
  const chapa = (levels === 1 ? rng() < 0.72 : rng() < 0.4) && n === 4;
  if (chapa) {
    chapaRoof(chunk, pts, h, rng, scheme === 'paint' ? paint : raw, L);
  } else {
    const shade = 0.75 + rng() * 0.3;
    flatRoof(buf, pts, h, new THREE.Color(shade, shade, shade), L.roofFlat);
    if (rng() < 0.6) esperas(chunk.props, pts, h, rng, 0.7);
    const t = rng();
    if (pointInPolygon(cx, cz, pts)) {
      if (t < 0.35) tankOnStilts(chunk.props, cx + (rng() - 0.5), cz + (rng() - 0.5), h, rng);
      else if (t < 0.6) tanks.push([cx, cz, h, 0.9]);
    }
    if (pointInPolygon(cx, cz, pts)) roofGear(chunk.props, cx + 1, cz - 1, h, rng, 1.3);
    // stuff kept on the slab
    if (rng() < 0.4) chunk.props.add(TPL.cube, place(cx + (rng() - 0.5) * 2, h, cz + (rng() - 0.5) * 2, 0.9, 0.25 + rng() * 0.3, 0.6, rng() * 3), C.brick, 0.3);
  }
}

// Monopitch chapa roof with a small overhang, weighed down with stones and tires.
function chapaRoof(chunk, pts, h, rng, wallTint, L) {
  const buf = chunk.facade;
  // tilt across the short side: edge 0-1 high, edge 2-3 low
  const d01 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const d12 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const p = d01 >= d12 ? pts : [pts[1], pts[2], pts[3], pts[0]];
  const cx = (p[0][0] + p[2][0]) / 2, cz = (p[0][1] + p[2][1]) / 2;
  const grow = (q) => {
    const dx = q[0] - cx, dz = q[1] - cz, l = Math.hypot(dx, dz) || 1;
    return [q[0] + (dx / l) * 0.3, q[1] + (dz / l) * 0.3];
  };
  const hi = h + 0.3 + rng() * 0.2, lo = h - 0.05;
  const g = p.map(grow);
  const r = rng();
  const tint = r < 0.55 ? new THREE.Color().setScalar(0.85 + rng() * 0.25) : r < 0.85 ? new THREE.Color(1, 0.72 + rng() * 0.1, 0.55) : new THREE.Color(PALETTES.villa[Math.floor(rng() * 4)]).lerp(new THREE.Color(1, 1, 1), 0.4);
  const A = [g[0][0], hi, g[0][1]], B = [g[1][0], hi, g[1][1]], Cc = [g[2][0], lo, g[2][1]], D = [g[3][0], lo, g[3][1]];
  const wl = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), dl = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  buf.quad(A, B, Cc, D, [0, 0], [wl / 4, 0], [wl / 4, dl / 4], [0, dl / 4], tint, [0, 1, 0], L.chapa);
  // underside so it is visible from the pasillo below
  buf.quad(A, B, Cc, D, [0, 0], [wl / 4, 0], [wl / 4, dl / 4], [0, dl / 4], new THREE.Color(0.45, 0.45, 0.45), [0, -1, 0], L.chapa);
  // gap between the walls and the sloped roof (high side and gables)
  const P = (q, y) => [q[0], y, q[1]];
  const hiW = h + 0.3;
  buf.quad(P(p[0], h), P(p[1], h), P(p[1], hiW), P(p[0], hiW), [0, 0], [1, 0], [1, 0.05], [0, 0.05], wallTint, [(p[0][0] + p[1][0]) / 2 - cx, 0, (p[0][1] + p[1][1]) / 2 - cz], L.hueco);
  buf.tri(P(p[1], h), P(p[2], h), P(p[1], hiW), [0, 0], [1, 0], [0, 0.05], wallTint, [(p[1][0] + p[2][0]) / 2 - cx, 0, (p[1][1] + p[2][1]) / 2 - cz], L.hueco);
  buf.tri(P(p[3], h), P(p[0], h), P(p[0], hiW), [0, 0], [1, 0], [1, 0.05], wallTint, [(p[3][0] + p[0][0]) / 2 - cx, 0, (p[3][1] + p[0][1]) / 2 - cz], L.hueco);
  // stones, tires and bricks holding the sheets down
  const k = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < k; i++) {
    const s = 0.15 + rng() * 0.7, t = 0.15 + rng() * 0.7;
    const x = p[0][0] + (p[1][0] - p[0][0]) * s + (p[3][0] - p[0][0]) * t;
    const z = p[0][1] + (p[1][1] - p[0][1]) * s + (p[3][1] - p[0][1]) * t;
    const y = hi + (lo - hi) * t + 0.02;
    const kind = rng();
    if (kind < 0.4) chunk.props.add(TPL.tire, place(x, y, z, 1, 1, 1, 0, (rng() - 0.5) * 0.3), C.tire);
    else if (kind < 0.8) chunk.props.add(TPL.stone, place(x, y + 0.08, z, 1 + rng(), 1, 1 + rng(), rng() * 3), C.stone, 0.4);
    else chunk.props.add(TPL.cube, place(x, y, z, 0.18, 0.12, 0.33, rng() * 3), C.brick);
  }
}

function addGable(pts, h, buf, wallTint, roofTint, roofLayer, wallLayer) {
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
  buf.quad(P(p[0]), P(p[1]), r1, r0, [0, 0], [uL, 0], [uL, uS], [0, uS], roofTint, up(p[0], p[1]), roofLayer);
  buf.quad(P(p[2]), P(p[3]), r0, r1, [0, 0], [uL, 0], [uL, uS], [0, uS], roofTint, up(p[2], p[3]), roofLayer);
  const out = (a, b) => [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
  buf.tri(P(p[1]), P(p[2]), r1, [0, h / 6], [shortLen / 6, h / 6], [shortLen / 12, (h + rise) / 6], wallTint, out(p[1], p[2]), wallLayer);
  buf.tri(P(p[3]), P(p[0]), r0, [0, h / 6], [shortLen / 6, h / 6], [shortLen / 12, (h + rise) / 6], wallTint, out(p[3], p[0]), wallLayer);
}

// Real businesses only (OpenStreetMap, scripts/fetch-shops.mjs): each one gets its own
// storefront on the street-facing wall of its building, with a facade, sign and street
// props that match what it sells. Buildings without a mapped business stay residential.
import * as THREE from 'three';
import { mulberry32, SpatialHash, bbox, polygonArea, nearestBuilding, closestOnSegment } from './geo.js';
import { GeoBuf, instancedChunks, frontRoad } from './builder.js';
import { foodSub, FOOD, foodFacadeMaterial, buildShopKit } from './shopkit.js';

const RUBROS = {
  kiosco: ['kiosk', 'convenience', 'newsagent', 'tobacco', 'lottery', 'e-cigarette'],
  farmacia: ['pharmacy', 'chemist', 'medical_supply'],
  comida: ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten', 'bakery', 'pastry', 'confectionery', 'deli'],
  almacen: ['supermarket', 'greengrocer', 'butcher', 'food', 'beverages', 'alcohol', 'wine', 'dairy', 'frozen_food', 'cheese', 'farm'],
  ferreteria: ['hardware', 'doityourself', 'paint', 'electrical', 'trade', 'building_materials', 'houseware', 'locksmith'],
  ropa: ['clothes', 'shoes', 'jewelry', 'optician', 'boutique', 'fashion_accessories', 'bag', 'cosmetics', 'perfumery', 'beauty', 'hairdresser', 'sports', 'toys', 'gift'],
  banco: ['bank', 'money_lender', 'bureau_de_change'],
  taller: ['car_repair', 'car_parts', 'tyres', 'motorcycle', 'car', 'bicycle', 'car_rental'],
  tecno: ['electronics', 'mobile_phone', 'computer', 'appliance', 'hifi'],
  hotel: ['hotel', 'motel', 'guest_house', 'hostel'],
  hogar: ['furniture', 'bed', 'interior_decoration'],
  flores: ['florist', 'garden_centre'],
  libreria: ['books', 'stationery'],
  boliche: ['nightclub'],
};
const RUBRO_OF = Object.fromEntries(Object.entries(RUBROS).flatMap(([r, kinds]) => kinds.map((k) => [k, r])));
// storefront width (m) and sign color per rubro
const STYLE = {
  kiosco: { w: 3, sign: '#c0392b' }, farmacia: { w: 5, sign: '#1f8a4c' }, comida: { w: 6, sign: '#7a2b1f' },
  almacen: { w: 6, sign: '#b8431b' }, ferreteria: { w: 5, sign: '#c46a12' }, ropa: { w: 5, sign: '#4a2a63' },
  banco: { w: 7, sign: '#1d3f8a' }, taller: { w: 6, sign: '#3d4a55' }, tecno: { w: 4, sign: '#1e6f8a' }, local: { w: 4.5, sign: '#34495e' },
  hotel: { w: 6, sign: '#1f2a3a' }, boliche: { w: 9, sign: '#6a1b9a' }, hogar: { w: 7, sign: '#8a5a2b' }, flores: { w: 4, sign: '#2e7d32' }, libreria: { w: 4.5, sign: '#5d4037' },
};
const RUBRO_LABEL = {
  kiosco: 'Kiosco', farmacia: 'Farmacia', almacen: 'Almacén', ferreteria: 'Ferretería', ropa: 'Ropa y accesorios', banco: 'Banco',
  taller: 'Autos y talleres', tecno: 'Tecnología', hotel: 'Hotel', boliche: 'Boliche', hogar: 'Muebles y hogar', flores: 'Florería', libreria: 'Librería', local: 'Local',
};
export function rubroOf(shop) {
  // OSM often tags appliance chains as shop=electrical (a ferretería-like rubro)
  if (/fr[aá]vega|garbarino|musimundo|cetrogar|megatone|naldo|on city/i.test(shop.name)) return 'tecno';
  return RUBRO_OF[shop.kind] || 'local';
}
// "Bodegón", "Farmacia", ... for the HUD and the map search
export function describeShop(shop) {
  const rubro = rubroOf(shop);
  return rubro === 'comida' ? FOOD[foodSub(shop)].label : RUBRO_LABEL[rubro];
}

export function buildShops(data, { root, graph, collision, nightMaterials }) {
  const shops = data.shops || [];
  if (!shops.length) return { count: 0, setNight() {} };
  const bIndex = new SpatialHash(30);
  for (const b of data.buildings) if (!b.special && b.h >= 3) bIndex.insert(b, bbox(b.pts));

  // Boliches are big sheds that the building data often lacks: give them one, facing
  // the nearest street, so they show up where they really are.
  const sheds = new GeoBuf();
  for (const shop of shops) {
    if (rubroOf(shop) !== 'boliche' || nearestBuilding(bIndex, shop.x, shop.z, 15)) continue;
    const n = graph.nearest(shop.x, shop.z, 120);
    if (!n) continue;
    const { a, b } = n.seg;
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const ux = (b.x - a.x) / l, uz = (b.z - a.z) / l;
    let ox = n.x - shop.x, oz = n.z - shop.z; // from the venue towards the street
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol; oz /= ol;
    // front on the property line: a 3 m sidewalk back from the curb
    const off = n.seg.road.w / 2 + 3;
    const fx = n.x - ox * off, fz = n.z - oz * off;
    const W = 18, D = 14, H = 7;
    const P = (along, depth) => [fx + ux * along - ox * depth, fz + uz * along - oz * depth];
    let pts = [P(-W / 2, 0), P(W / 2, 0), P(W / 2, D), P(-W / 2, D)];
    if (polygonArea(pts) < 0) pts = pts.reverse();
    if (pts.some(([x, z]) => collision.isBlocked(x, z, 0))) continue;
    const bld = { pts, h: H, levels: 1, style: 'industrial' };
    const dark = new THREE.Color(0.16, 0.15, 0.18);
    for (let i = 0; i < 4; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % 4];
      sheds.quad([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], H, p1[1]], [p0[0], H, p0[1]], [0, 0], [1, 0], [1, 1], [0, 1], dark, [p1[1] - p0[1], 0, p0[0] - p1[0]]);
    }
    sheds.quad(...pts.map(([x, z]) => [x, H, z]), [0, 0], [1, 0], [1, 1], [0, 1], new THREE.Color(0.35, 0.35, 0.36), [0, 1, 0]);
    collision.addPolygon(pts, H, 'building');
    data.buildings.push(bld);
    bIndex.insert(bld, bbox(pts));
  }
  if (!sheds.empty) {
    const m = new THREE.Mesh(sheds.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    m.castShadow = m.receiveShadow = true;
    root.add(m);
  }

  const used = new Map(); // `${building}:${edge}` -> taken [s0, s1] intervals along the edge
  const placed = [];
  for (const shop of shops) {
    const b = nearestBuilding(bIndex, shop.x, shop.z, 15);
    if (!b) continue;
    const pts = polygonArea(b.pts) < 0 ? b.pts.slice().reverse() : b.pts;
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
      const front = frontRoad(graph, p0, p1);
      if (!front) continue;
      const [, , t, d2] = closestOnSegment(shop.x, shop.z, p0[0], p0[1], p1[0], p1[1]);
      if (!best || d2 < best.d2) best = { i, p0, p1, t, d2, front };
    }
    if (!best) continue;
    const rubro = rubroOf(shop);
    const { p0, p1, front } = best;
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const w = Math.min(STYLE[rubro].w, len - 0.4);
    if (w < 2.4) continue;
    // center on the business, kept inside the wall and clear of neighbours
    let s = Math.min(len - w / 2 - 0.2, Math.max(w / 2 + 0.2, best.t * len));
    const key = `${data.buildings.indexOf(b)}:${best.i}`;
    const taken = used.get(key) || [];
    const clash = (c) => taken.some(([a, z]) => c - w / 2 < z && c + w / 2 > a);
    for (const shift of [0, 1, -1, 2, -2, 3, -3]) {
      const c = s + shift * (w / 2 + 0.3);
      if (c - w / 2 >= 0.2 && c + w / 2 <= len - 0.2 && !clash(c)) {
        s = c;
        break;
      }
      if (shift === -3) s = null;
    }
    if (s === null) continue;
    taken.push([s - w / 2 - 0.2, s + w / 2 + 0.2]);
    used.set(key, taken);
    const ux = (p1[0] - p0[0]) / len, uz = (p1[1] - p0[1]) / len;
    const sub = rubro === 'comida' ? foodSub(shop) : null;
    placed.push({
      shop, rubro, sub, w, room: front.room, roof: b.h, label: sub ? FOOD[sub].label : RUBRO_LABEL[rubro],
      signColor: sub ? FOOD[sub].sign : STYLE[rubro].sign,
      h: Math.min(3.8, b.h - 0.3),
      x: p0[0] + ux * s, z: p0[1] + uz * s,
      ux, uz, ox: uz, oz: -ux, // along the wall, and outward
    });
  }

  // ------------------------------------------------ facades (one atlas of 4 variants per rubro)
  const mats = {};
  const bufs = {};
  const rng = mulberry32(21);
  const W = new THREE.Color(1, 1, 1);
  for (const p of placed) {
    const key = p.sub ? `comida:${p.sub}` : p.rubro;
    if (!mats[key]) {
      mats[key] = p.sub ? foodFacadeMaterial(p.sub) : facadeMaterial(p.rubro);
      nightMaterials.push(mats[key]);
      bufs[key] = new GeoBuf();
    }
    const k = Math.floor(rng() * 4);
    const { x, z, ux, uz, ox, oz, w, h } = p;
    // seen from the sidewalk (looking along -out) the viewer's right is -u
    const L = [x + ux * w / 2 + ox * 0.04, z + uz * w / 2 + oz * 0.04], R = [x - ux * w / 2 + ox * 0.04, z - uz * w / 2 + oz * 0.04];
    bufs[key].quad([L[0], 0, L[1]], [R[0], 0, R[1]], [R[0], h, R[1]], [L[0], h, L[1]],
      [k / 4, 0], [(k + 1) / 4, 0], [(k + 1) / 4, 1], [k / 4, 1], W, [ox, 0, oz]);
  }
  for (const r in bufs) {
    const mesh = new THREE.Mesh(bufs[r].geometry(), mats[r]);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // ------------------------------------------------ name signs with the real business name
  const signW = 256, signH = 40, atlas = 2048, cols = atlas / signW, perAtlas = cols * Math.floor(atlas / signH);
  for (let a = 0; a * perAtlas < placed.length; a++) {
    const c = document.createElement('canvas');
    c.width = c.height = atlas;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const buf = new GeoBuf();
    placed.slice(a * perAtlas, (a + 1) * perAtlas).forEach((p, i) => {
      const px = (i % cols) * signW, py = Math.floor(i / cols) * signH;
      ctx.fillStyle = p.signColor;
      ctx.fillRect(px, py, signW, signH);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(px, py + signH - 3, signW, 3);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.fillText(p.shop.name.toUpperCase(), px + signW / 2, py + signH / 2, signW - 14);
      const w = p.w - 0.2, hh = Math.min(0.62, w / 5.5), y = p.h - 0.42;
      const cx = p.x + p.ox * 0.1, cz = p.z + p.oz * 0.1;
      const L = [cx + p.ux * w / 2, cz + p.uz * w / 2], R = [cx - p.ux * w / 2, cz - p.uz * w / 2];
      const u0 = px / atlas, u1 = (px + signW) / atlas, v0 = 1 - (py + signH) / atlas, v1 = 1 - py / atlas;
      buf.quad([L[0], y - hh / 2, L[1]], [R[0], y - hh / 2, R[1]], [R[0], y + hh / 2, R[1]], [L[0], y + hh / 2, L[1]],
        [u0, v0], [u1, v0], [u1, v1], [u0, v1], W, [p.ox, 0, p.oz]);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 });
    nightMaterials.push(mat);
    root.add(new THREE.Mesh(buf.geometry(), mat));
  }

  // ------------------------------------------------ street props per rubro
  const q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const place = (m, [x, z, y, yaw, sx = 1]) => m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(yAxis, yaw), new THREE.Vector3(sx, 1, 1));
  const at = (p, along, out, y = 0) => [p.x + p.ux * along + p.ox * out, p.z + p.uz * along + p.oz * out, y, Math.atan2(p.ox, p.oz)];
  const crosses = [], freezers = [], crates = [], tyres = [];
  const prng = mulberry32(8);
  const block = (x, z, r) => collision.addCircle(x, z, r, 'pole');
  for (const p of placed) {
    const k = p.shop.kind;
    if (p.rubro === 'farmacia') crosses.push(at(p, p.w / 2 - 0.5, 0.55, p.h - 0.5));
    if (p.rubro === 'kiosco' && p.room > 1.8) {
      const f = at(p, p.w / 2 - 0.55, 0.4);
      freezers.push(f);
      block(f[0], f[1], 0.5);
    }
    if (k === 'greengrocer' && p.room > 1.8) {
      for (let j = 0; j < 3; j++) crates.push([...at(p, -p.w / 2 + 0.6 + j * 0.7, 0.35, 0.15), 1, j]);
      const c0 = at(p, -p.w / 2 + 1.3, 0.35);
      block(c0[0], c0[1], 0.7);
    }
    if (p.rubro === 'taller' && p.room > 1.8) {
      const t = at(p, p.w / 2 - 0.6, 0.5);
      for (let j = 0; j < 4; j++) tyres.push([t[0], t[1], 0.12 + j * 0.23, 0]);
      block(t[0], t[1], 0.45);
    }
  }

  const kit = buildShopKit(root, placed, { graph, collision, nightMaterials });

  // cruz verde de farmacia: blade sign sticking out of the facade, lit at night
  const crossMat = new THREE.MeshStandardMaterial({ map: crossTexture(), emissiveMap: crossTexture(), emissive: 0x30ff70, emissiveIntensity: 0.4 });
  instancedChunks(root, new THREE.BoxGeometry(0.08, 0.8, 0.8), crossMat, crosses, place);
  // heladera de helados en la puerta del kiosco
  instancedChunks(root, new THREE.BoxGeometry(0.9, 0.85, 0.6).translate(0, 0.425, 0), new THREE.MeshStandardMaterial({ map: freezerTexture(), roughness: 0.4 }), freezers, place, { cast: true });
  // cajones de verdura
  const crateColors = [0xc0392b, 0xe67e22, 0x6aa84f];
  instancedChunks(root, new THREE.BoxGeometry(0.6, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), crates, place, {
    cast: true, color: (it) => new THREE.Color(crateColors[it[5]]),
  });
  // gomas apiladas en la vereda del taller
  instancedChunks(root, new THREE.TorusGeometry(0.28, 0.11, 6, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.95 }), tyres, place, { cast: true });

  return {
    count: placed.length,
    placed,
    setNight(n) {
      kit.setNight(n);
      crossMat.emissiveIntensity = 0.4 + n * 2.5;
    },
  };
}

// ------------------------------------------------ facade textures
// Each 256 px tile is a 4 m x 3.8 m shopfront: fascia on top (behind the name sign),
// then the rubro's window/door/shutter below. The emissive twin lights windows at night.
function facadeMaterial(rubro) {
  const S = 256;
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = e.width = S * 4;
  c.height = e.height = S;
  const ctx = c.getContext('2d'), ectx = e.getContext('2d');
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S * 4, S);
  const rng = mulberry32(rubro.length * 97);
  for (let k = 0; k < 4; k++) (DRAW[rubro] || DRAW.local)(ctx, ectx, k * S, S, rng);
  const map = new THREE.CanvasTexture(c), emissiveMap = new THREE.CanvasTexture(e);
  map.colorSpace = emissiveMap.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffe2b0, emissiveIntensity: 0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 });
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function frame(ctx, x, S, wall, fascia) {
  ctx.fillStyle = wall;
  ctx.fillRect(x, 0, S, S);
  ctx.fillStyle = fascia;
  ctx.fillRect(x, 0, S, 54);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, 54, S, 3);
}
function glass(ctx, ectx, x, y, w, h, tint = '#27343c', lit = '#ffe7b8') {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, tint);
  g.addColorStop(1, '#46565f');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w * 0.35, y);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.25, y + h);
  ctx.fill();
  ectx.fillStyle = lit;
  ectx.fillRect(x, y, w, h);
}
function door(ctx, ectx, x, y, w, h, frameColor = '#222') {
  ctx.fillStyle = frameColor;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 4);
  glass(ctx, ectx, x, y, w, h);
  ctx.fillStyle = '#bbb';
  ctx.fillRect(x + w - 10, y + h / 2, 4, 20);
}
function shutter(ctx, x, y, w, h, color = '#8f9396') {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let yy = y; yy < y + h; yy += 6) ctx.fillRect(x, yy, w, 2);
}
function shelves(ctx, x, y, w, h, rng, colors) {
  for (let yy = y + 8; yy < y + h - 6; yy += 22) {
    ctx.fillStyle = 'rgba(230,230,230,0.8)';
    ctx.fillRect(x + 4, yy + 16, w - 8, 3);
    for (let xx = x + 6; xx < x + w - 10; xx += 7 + rng() * 5) {
      ctx.fillStyle = pick(rng, colors);
      ctx.fillRect(xx, yy + 16 - (8 + rng() * 8), 5 + rng() * 3, 8 + rng() * 8);
    }
  }
}
const CANDY = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#ffffff'];
const DRAW = {
  kiosco(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#e9e2d0', '#d7dde0', '#f1d9b5']), '#3a3a3a');
    // vidriera con golosinas detrás de la reja + ventanita de atención
    glass(ctx, ectx, x + 14, 72, 140, 130, '#39444a', '#fff3cf');
    shelves(ctx, x + 14, 72, 140, 130, rng, CANDY);
    ctx.fillStyle = '#1f1f1f';
    for (let xx = x + 14; xx <= x + 154; xx += 12) ctx.fillRect(xx, 72, 3, 130);
    ctx.fillRect(x + 14, 200, 140, 8);
    door(ctx, ectx, x + 176, 84, 62, 172, '#1f1f1f');
  },
  farmacia(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, '#f5f7f5', '#1f8a4c');
    glass(ctx, ectx, x + 12, 70, 150, 150, '#dfeee6', '#f4fff8');
    shelves(ctx, x + 12, 70, 150, 150, rng, ['#ffffff', '#b8e0c8', '#1f8a4c', '#90caf9', '#f8bbd0']);
    door(ctx, ectx, x + 178, 70, 66, 186, '#b0b8b4');
    ctx.fillStyle = '#1f8a4c';
    ctx.fillRect(x + 12, 226, 150, 8);
  },
  almacen(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#f0ebe0', '#e0e6ea']), '#b8431b');
    glass(ctx, ectx, x + 10, 70, 236, 150, '#3a464c', '#f7f2de');
    shelves(ctx, x + 10, 70, 236, 150, rng, ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ffffff', '#8d6e63', '#ff7043']);
    ctx.fillStyle = '#7a7f82';
    ctx.fillRect(x + 10, 220, 236, 36);
  },
  ferreteria(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, '#d9d2c4', '#c46a12');
    // persiana a medio subir con herramientas colgadas atrás
    ctx.fillStyle = '#2b2622';
    ctx.fillRect(x + 12, 70, 232, 186);
    ectx.fillStyle = '#6a5a40';
    ectx.fillRect(x + 12, 120, 232, 136);
    for (let i = 0; i < 16; i++) {
      const tx = x + 22 + (i % 8) * 28, ty = 126 + Math.floor(i / 8) * 56;
      ctx.fillStyle = pick(rng, ['#c46a12', '#d32f2f', '#9e9e9e', '#fbc02d', '#1565c0']);
      ctx.fillRect(tx, ty, 6, 30);
      ctx.fillStyle = '#bdbdbd';
      ctx.fillRect(tx - 5, ty, 16, 7);
    }
    shutter(ctx, x + 12, 70, 232, 52);
  },
  ropa(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#1e1e1e', '#f4f4f4', '#d8cfc4']), '#111');
    glass(ctx, ectx, x + 10, 64, 170, 192, '#e8e4df', '#fffaf0');
    // maniquíes
    for (const mx of [40, 95, 145]) {
      ctx.fillStyle = pick(rng, ['#c62828', '#283593', '#f9a825', '#2e7d32', '#f5f5f5', '#212121']);
      ctx.beginPath();
      ctx.moveTo(x + mx - 16, 120);
      ctx.lineTo(x + mx + 16, 120);
      ctx.lineTo(x + mx + 22, 205);
      ctx.lineTo(x + mx - 22, 205);
      ctx.fill();
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath();
      ctx.arc(x + mx, 106, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + mx - 2, 205, 4, 40);
    }
    door(ctx, ectx, x + 192, 70, 56, 186, '#111');
  },
  banco(ctx, ectx, x, S) {
    frame(ctx, x, S, '#c9c3b8', '#1d3f8a');
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let yy = 60; yy < S; yy += 32) ctx.fillRect(x, yy, S, 2);
    glass(ctx, ectx, x + 20, 70, 120, 186, '#1f2e3a', '#dfe9ff');
    // cajero automático
    ctx.fillStyle = '#546e7a';
    ctx.fillRect(x + 164, 110, 70, 110);
    ctx.fillStyle = '#90caf9';
    ctx.fillRect(x + 176, 124, 46, 32);
    ectx.fillStyle = '#90caf9';
    ectx.fillRect(x + 176, 124, 46, 32);
    ctx.fillStyle = '#263238';
    ctx.fillRect(x + 180, 170, 38, 20);
  },
  taller(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#bdb6a8', '#9fa6ab']), '#3d4a55');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 10, 66, 236, 190);
    ectx.fillStyle = '#403828';
    ectx.fillRect(x + 10, 66, 236, 190);
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(x + 10, 66, 236, 26);
    // auto en el elevador
    ctx.fillStyle = pick(rng, ['#8a1c1c', '#1c3f8a', '#c0c0c0']);
    ctx.fillRect(x + 50, 150, 150, 40);
    ctx.fillRect(x + 80, 128, 90, 26);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + 80, 192, 14, 0, Math.PI * 2);
    ctx.arc(x + 170, 192, 14, 0, Math.PI * 2);
    ctx.fill();
  },
  tecno(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, '#eceff1', '#1e6f8a');
    glass(ctx, ectx, x + 10, 70, 170, 150, '#263238', '#e3f2fd');
    for (let i = 0; i < 6; i++) {
      const tx = x + 20 + (i % 3) * 54, ty = 84 + Math.floor(i / 3) * 64;
      ctx.fillStyle = '#111';
      ctx.fillRect(tx, ty, 44, 50);
      ctx.fillStyle = pick(rng, ['#42a5f5', '#66bb6a', '#ab47bc', '#ffa726']);
      ctx.fillRect(tx + 3, ty + 3, 38, 44);
    }
    door(ctx, ectx, x + 192, 70, 56, 186, '#455a64');
  },
  hotel(ctx, ectx, x, S) {
    frame(ctx, x, S, '#d8d0c2', '#1f2a3a');
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let yy = 60; yy < S; yy += 28) ctx.fillRect(x, yy, S, 2);
    // puerta doble de vidrio con marco dorado y el lobby iluminado
    glass(ctx, ectx, x + 70, 74, 116, 182, '#3a3226', '#ffe2a8');
    ctx.fillStyle = '#b8963e';
    ctx.fillRect(x + 64, 68, 128, 6);
    ctx.fillRect(x + 64, 68, 6, 188);
    ctx.fillRect(x + 186, 68, 6, 188);
    ctx.fillRect(x + 125, 74, 6, 182);
    ctx.fillStyle = 'rgba(60,40,20,0.6)';
    ctx.fillRect(x + 90, 190, 76, 30);
    for (const wx of [x + 14, x + 206]) glass(ctx, ectx, wx, 90, 36, 110, '#2a3440', '#ffe2a8');
  },
  hogar(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#efe9df', '#e2e6e8']), '#8a5a2b');
    glass(ctx, ectx, x + 10, 66, 236, 154, '#e9e2d6', '#fff6e0');
    // sillón, cama y lámpara en la vidriera
    ctx.fillStyle = pick(rng, ['#6d4c41', '#37474f', '#8d6e63']);
    ctx.fillRect(x + 24, 170, 90, 30);
    ctx.fillRect(x + 24, 150, 90, 22);
    ctx.fillRect(x + 18, 160, 10, 40);
    ctx.fillRect(x + 110, 160, 10, 40);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(x + 140, 176, 96, 24);
    ctx.fillStyle = pick(rng, ['#1e5bb8', '#c2477a', '#3aa7a3']);
    ctx.fillRect(x + 140, 168, 96, 10);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x + 140, 146, 8, 54);
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.moveTo(x + 128, 110);
    ctx.lineTo(x + 148, 110);
    ctx.lineTo(x + 142, 96);
    ctx.lineTo(x + 134, 96);
    ctx.fill();
    ctx.fillStyle = '#7a7f82';
    ctx.fillRect(x + 10, 220, 236, 36);
  },
  flores(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, '#e8efe2', '#2e7d32');
    glass(ctx, ectx, x + 12, 70, 160, 150, '#2f4a32', '#f6ffe8');
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = i % 3 ? pick(rng, ['#e53935', '#f06292', '#fdd835', '#ffffff', '#ab47bc', '#ff7043']) : '#3f7a2f';
      ctx.beginPath();
      ctx.arc(x + 20 + rng() * 144, 90 + rng() * 120, 4 + rng() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    door(ctx, ectx, x + 186, 70, 60, 186, '#2e7d32');
  },
  libreria(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#efe6d6', '#e3dccf']), '#5d4037');
    glass(ctx, ectx, x + 12, 70, 160, 150, '#3a3026', '#fff1d0');
    for (let yy = 82; yy < 210; yy += 32) {
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x + 16, yy + 26, 152, 4);
      for (let xx = x + 18; xx < x + 164; xx += 6 + rng() * 4) {
        ctx.fillStyle = pick(rng, ['#c62828', '#1e5bb8', '#2e7d32', '#f9a825', '#4e342e', '#6a1b9a', '#eeeeee']);
        ctx.fillRect(xx, yy + 26 - (16 + rng() * 9), 5, 16 + rng() * 9);
      }
    }
    door(ctx, ectx, x + 186, 70, 60, 186, '#5d4037');
  },
  boliche(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, '#0d0d12', '#000');
    // tiras de neón (lit at night through the emissive map)
    const neon = pick(rng, [['#ff3fd0', '#3fe6ff'], ['#a64dff', '#ffe03f'], ['#ff4d4d', '#4dff9a']]);
    for (const [y, c] of [[64, neon[0]], [236, neon[1]]]) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, S, 5);
      ectx.fillStyle = c;
      ectx.fillRect(x, y - 2, S, 9);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ectx.fillStyle = neon[i % 2];
      ctx.fillRect(x + 8 + i * 42, 80, 3, 140);
      ectx.fillRect(x + 7 + i * 42, 80, 5, 140);
    }
    // puerta doble y boletería
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(x + 70, 96, 116, 140);
    ctx.fillStyle = '#2b2b38';
    ctx.fillRect(x + 74, 100, 52, 136);
    ctx.fillRect(x + 130, 100, 52, 136);
    ctx.fillStyle = '#c0c4c8';
    ctx.fillRect(x + 120, 160, 4, 20);
    ctx.fillRect(x + 132, 160, 4, 20);
    glass(ctx, ectx, x + 200, 130, 44, 40, '#2a1f30', '#ff9ad0');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOLETERÍA', x + 222, 182);
  },
  local(ctx, ectx, x, S, rng) {
    frame(ctx, x, S, pick(rng, ['#e6e0d4', '#d9dfe3', '#efe3c8']), '#444');
    glass(ctx, ectx, x + 12, 70, 160, 150);
    ctx.fillStyle = '#6d6d6d';
    ctx.fillRect(x + 12, 220, 160, 36);
    door(ctx, ectx, x + 186, 70, 60, 186);
  },
};

function crossTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d3b1f';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#2ee66b';
  ctx.fillRect(22, 6, 20, 52);
  ctx.fillRect(6, 22, 52, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function freezerTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1e5bb8';
  ctx.fillRect(0, 0, 128, 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HELADOS', 64, 25);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

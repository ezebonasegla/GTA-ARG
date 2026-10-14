// Hand-made places of the centre, detailed beyond what the generic city builder does:
// the Peatonal Rivadavia (paving, canteros with trees, benches, farolas, kioscos de
// diarios, bolardos), the forecourt of Estación Quilmes (puestos, carrito de choripán,
// parada de taxis) and extras for Plaza San Martín (palmeras, canteros de flores, mástil).
import * as THREE from 'three';
import { Kit, canvasTexture, signTexture, flagTexture } from './landmarks.js';
import { Line } from './streets.js';
import { mulberry32 } from './geo.js';

const PEATONAL = (r) => r.kind === 'pedestrian' && /^rivadavia$/i.test(r.name);

// Run before the road graph is built: no cars along the peatonal.
export function markZones(data) {
  for (const r of data.roads) if (PEATONAL(r)) r.noCars = true;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
// world matrix: position, rotation about y (local +x along (cos a, -sin a)) and scale
function M(x, y, z, a = 0, sx = 1, sy = sx, sz = sx) {
  return _m.compose(new THREE.Vector3(x, y, z), _q.setFromAxisAngle(_y, a), new THREE.Vector3(sx, sy, sz)).clone();
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);

function pavingTexture() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    const rng = mulberry32(77);
    const pavers = (x0, x1, base, jitter) => {
      for (let y = 0; y < h; y += 10) {
        const off = (y / 10) % 2 ? 0 : 10;
        for (let x = x0 - off; x < x1; x += 20) {
          const l = base[2] + (rng() - 0.5) * jitter;
          ctx.fillStyle = `hsl(${base[0]},${base[1]}%,${l}%)`;
          ctx.fillRect(Math.max(x0, x) + 1, y + 1, Math.min(x1, x + 20) - Math.max(x0, x) - 1, 9);
        }
      }
    };
    ctx.fillStyle = '#6d6a64';
    ctx.fillRect(0, 0, w, h);
    pavers(0, w, [38, 8, 64], 8); // grey intertrabado
    pavers(w * 0.36, w * 0.64, [16, 42, 42], 8); // central band of terracotta
    ctx.fillStyle = '#4a4844';
    ctx.fillRect(0, 0, w, 6); // dark transverse band every 6 m
    ctx.fillRect(w * 0.36 - 3, 0, 3, h);
    ctx.fillRect(w * 0.64, 0, 3, h);
    for (let i = 0; i < 1500; i++) {
      const v = Math.floor(rng() * 255);
      ctx.fillStyle = `rgba(${v},${v},${v},0.07)`;
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// rows of magazines and newspapers hanging on a kiosk's front
function rackTexture(seed, flowers = false) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const rng = mulberry32(seed);
    ctx.fillStyle = flowers ? '#2f4a22' : '#203828';
    ctx.fillRect(0, 0, w, h);
    const cols = flowers ? ['#e63946', '#f1c40f', '#ff8fab', '#ffffff', '#9b5de5', '#ff6b35'] : ['#d62828', '#f4f1de', '#1d3557', '#e9c46a', '#2a9d8f', '#f77f00', '#ffffff'];
    for (let y = 6; y < h - 10; y += flowers ? 14 : 30) {
      for (let x = 4; x < w - 20; x += flowers ? 10 + rng() * 6 : 22 + rng() * 6) {
        ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
        if (flowers) {
          ctx.beginPath();
          ctx.arc(x + 5, y + 6, 4 + rng() * 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, 18, 25);
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(x + 2, y + 3, 14, 3);
        }
      }
    }
  });
}

function flowerTexture(seed) {
  const t = canvasTexture(128, 128, (ctx, w, h) => {
    const rng = mulberry32(seed);
    ctx.fillStyle = '#3d5a2a';
    ctx.fillRect(0, 0, w, h);
    const cols = ['#e63946', '#f1c40f', '#ff8fab', '#ffffff', '#9b5de5', '#ff7b00'];
    const c = cols[seed % cols.length], c2 = cols[(seed + 2) % cols.length];
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() < 0.3 ? '#4f7a33' : rng() < 0.7 ? c : c2;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 1.5 + rng() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildZones(data, { root, graph, collision, ribbon, flatMat, keepOut, GeoBuf }) {
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const Z = {
    green: mat(0x2f4f3a, { roughness: 0.5, metalness: 0.4 }), // municipal dark green
    brick: mat(0xa4573c, { roughness: 0.95 }),
    concrete: mat(0xbdb8ad, { roughness: 0.95 }),
    soil: mat(0x3b2a1e, { roughness: 1 }),
    trunk: mat(0x5a4632, { roughness: 1 }),
    leaf: mat(0x557d3b, { flatShading: true }),
    leaf2: mat(0x6b8f3e, { flatShading: true }),
    frond: mat(0x4c7a32, { side: THREE.DoubleSide, flatShading: true }),
    palm: mat(0x8a7a62, { roughness: 1 }),
    wood: mat(0x7a5434),
    iron: mat(0x23282a, { roughness: 0.5, metalness: 0.6 }),
    yellow: mat(0xe0b320),
    white: mat(0xf2f2f2, { roughness: 0.4 }),
    lamp: mat(0xfff4d6, { emissive: 0xffd28a, emissiveIntensity: 0 }),
    tarpBlue: mat(0x2a6fb5, { side: THREE.DoubleSide }),
    tarpRed: mat(0xc0392b, { side: THREE.DoubleSide }),
    tarpGreen: mat(0x2e8b57, { side: THREE.DoubleSide }),
    grill: mat(0x151515, { roughness: 0.6, metalness: 0.5 }),
    ember: mat(0xff5a1f, { emissive: 0xff3a00, emissiveIntensity: 0.6 }),
    smoke: new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.25, depthWrite: false }),
    flag: new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.9 }),
    diarios: mat(0xffffff, { map: signTexture('DIARIOS · REVISTAS', '#f2efe4', '#1f3a2a', 1024, 160) }),
    rack: mat(0xffffff, { map: rackTexture(5) }),
    floreria: mat(0xffffff, { map: signTexture('FLORERÍA', '#f6e7ef', '#8a1c4a', 1024, 160) }),
    flowers: mat(0xffffff, { map: rackTexture(9, true) }),
    taxi: mat(0xffffff, { map: signTexture('PARADA DE TAXIS', '#111111', '#f2c200', 1024, 200, 'bold 92px Arial, sans-serif') }),
    choripan: mat(0xffffff, { map: signTexture('CHORIPÁN · BONDIOLA', '#c0392b', '#fff4d6', 1024, 160) }),
  };
  const kit = new Kit();
  const flats = new Kit();
  const pave = flatMat(pavingTexture());
  const rng = mulberry32(2024);
  const solid = (x, z, r) => collision.addCircle(x, z, r, 'prop');
  const solidBox = (x, z, a, hw, hd) => {
    const c = Math.cos(a), s = Math.sin(a);
    // local x along (c, -s), local z along (s, c)
    collision.addPolygon([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [x + c * u + s * v, z - s * u + c * v]), 3, 'prop');
  };

  // ---------------------------------------------------------------- pieces
  function tree(x, z, h = 3.2, leaf = Z.leaf) {
    kit.add(cyl(0.12, 0.18, h, 7), Z.trunk, M(x, 0, z));
    const crown = new THREE.IcosahedronGeometry(1.7, 0);
    kit.add(crown, leaf, M(x, h + 0.6, z, rng() * 6, 1, 0.8 + rng() * 0.3, 1));
    kit.add(new THREE.IcosahedronGeometry(1.1, 0), leaf, M(x + 0.6, h + 1.4, z - 0.3, rng() * 6));
  }
  function planter(x, z, a) {
    kit.add(box(1.9, 0.55, 1.9), Z.brick, M(x, 0, z, a));
    kit.add(box(1.6, 0.02, 1.6), Z.soil, M(x, 0.55, z, a));
    tree(x, z, 3 + rng());
    solidBox(x, z, a, 0.95, 0.95);
  }
  function bench(x, z, a) {
    kit.add(box(1.8, 0.08, 0.5), Z.wood, M(x, 0.42, z, a));
    kit.add(box(1.8, 0.45, 0.06), Z.wood, M(x - Math.sin(a) * 0.24, 0.5, z - Math.cos(a) * 0.24, a));
    for (const e of [-0.75, 0.75]) kit.add(box(0.08, 0.42, 0.45), Z.iron, M(x + Math.cos(a) * e, 0, z - Math.sin(a) * e, a));
  }
  const lamps = [];
  function farola(x, z, a) {
    kit.add(cyl(0.07, 0.11, 4.6, 8), Z.green, M(x, 0, z));
    kit.add(box(1.5, 0.08, 0.08), Z.green, M(x, 4.5, z, a));
    for (const e of [-0.7, 0.7]) {
      const gx = x + Math.cos(a) * e, gz = z - Math.sin(a) * e;
      kit.add(cyl(0.03, 0.03, 0.25, 6), Z.green, M(gx, 4.55, gz));
      kit.add(new THREE.SphereGeometry(0.24, 12, 8), Z.lamp, M(gx, 5.0, gz));
    }
    lamps.push([x, z]);
    solid(x, z, 0.15);
  }
  function trash(x, z) {
    kit.add(cyl(0.24, 0.22, 0.85, 10), Z.green, M(x, 0, z));
    kit.add(cyl(0.27, 0.27, 0.06, 10), Z.iron, M(x, 0.85, z));
    solid(x, z, 0.3);
  }
  function bollard(x, z) {
    kit.add(cyl(0.1, 0.12, 0.85, 8), Z.iron, M(x, 0, z));
    kit.add(cyl(0.11, 0.11, 0.08, 8), Z.yellow, M(x, 0.7, z));
    solid(x, z, 0.13);
  }
  // kiosco de diarios (or florería): booth with an overhanging roof and racks
  function kiosk(x, z, a, flowers = false) {
    kit.add(box(2.6, 2.3, 1.6), Z.green, M(x, 0, z, a));
    kit.add(box(3.4, 0.12, 2.4), Z.green, M(x, 2.3, z, a));
    const sign = flowers ? Z.floreria : Z.diarios, rack = flowers ? Z.flowers : Z.rack;
    for (const sd of [-1, 1]) {
      const nx = Math.sin(a) * sd, nz = Math.cos(a) * sd;
      const r = a + (sd < 0 ? Math.PI : 0);
      kit.add(new THREE.PlaneGeometry(3.2, 0.42), sign, M(x + nx * 1.21, 2.62, z + nz * 1.21, r));
      kit.add(new THREE.PlaneGeometry(3.2, 0.42), sign, M(x + nx * 1.19, 2.62, z + nz * 1.19, r + Math.PI));
      kit.add(new THREE.PlaneGeometry(2.4, 1.2), rack, M(x + nx * 0.81, 1.0, z + nz * 0.81, r));
    }
    kit.add(box(3.2, 0.42, 0.04), Z.white, M(x, 2.42, z, a));
    solidBox(x, z, a, 1.4, 0.9);
  }
  // puesto: folding table under a tarp on four poles
  function stall(x, z, a, tarp) {
    for (const [u, v] of [[-1, -0.8], [1, -0.8], [-1, 0.8], [1, 0.8]]) {
      const px = x + Math.cos(a) * u + Math.sin(a) * v, pz = z - Math.sin(a) * u + Math.cos(a) * v;
      kit.add(cyl(0.025, 0.025, 2.2, 5), Z.iron, M(px, 0, pz));
    }
    const roof = new THREE.PlaneGeometry(2.4, 2).rotateX(-Math.PI / 2 + 0.12);
    kit.add(roof, tarp, M(x, 2.25, z, a));
    kit.add(box(1.9, 0.05, 0.9), Z.wood, M(x, 0.75, z, a));
    kit.add(new THREE.PlaneGeometry(1.8, 0.8).rotateX(-Math.PI / 2), Z.rack, M(x, 0.81, z, a));
    solidBox(x, z, a, 1.0, 0.5);
  }
  function choriCart(x, z, a) {
    kit.add(box(1.8, 0.95, 0.9), Z.white, M(x, 0.25, z, a));
    kit.add(box(1.7, 0.08, 0.8), Z.grill, M(x, 1.2, z, a));
    kit.add(box(1.4, 0.03, 0.6), Z.ember, M(x, 1.22, z, a));
    for (const e of [-0.7, 0.7]) kit.add(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 12).rotateX(Math.PI / 2).translate(0, 0.25, 0), Z.iron, M(x + Math.cos(a) * e, 0, z - Math.sin(a) * e, a));
    kit.add(new THREE.PlaneGeometry(1.8, 0.4), Z.choripan, M(x + Math.sin(a) * 0.46, 0.7, z + Math.cos(a) * 0.46, a));
    kit.add(new THREE.PlaneGeometry(1.8, 0.4), Z.choripan, M(x - Math.sin(a) * 0.46, 0.7, z - Math.cos(a) * 0.46, a + Math.PI));
    // a sombrilla and a wisp of smoke
    kit.add(cyl(0.03, 0.03, 2.4, 5), Z.iron, M(x, 0, z));
    kit.add(new THREE.ConeGeometry(1.4, 0.5, 10, 1, true).translate(0, 2.5, 0), Z.tarpRed, M(x, 0, z));
    for (let i = 0; i < 4; i++) kit.add(new THREE.SphereGeometry(0.25 + i * 0.12, 8, 6), Z.smoke, M(x + i * 0.15, 1.5 + i * 0.35, z + i * 0.05));
    solidBox(x, z, a, 0.95, 0.5);
  }
  function palm(x, z, h) {
    for (let k = 0; k < 4; k++) kit.add(cyl(0.2 - k * 0.02, 0.22 - k * 0.02, h / 4 + 0.05, 8), Z.palm, M(x + k * 0.05, (k * h) / 4, z));
    for (let i = 0; i < 9; i++) {
      const fr = new THREE.PlaneGeometry(0.7, 3.4, 1, 3);
      const p = fr.attributes.position;
      for (let k = 0; k < p.count; k++) p.setZ(k, -((p.getY(k) + 1.7) ** 2) * 0.12); // droop
      fr.translate(0, 1.7, 0).rotateX(-1.0);
      kit.add(fr, Z.frond, M(x + 0.15, h, z, (i / 9) * Math.PI * 2 + rng() * 0.3));
    }
    solid(x, z, 0.3);
  }
  function zebraAcross(buf, x, z, dx, dz, hw, len) {
    const w = new THREE.Color(0.92, 0.92, 0.88);
    for (let o = -hw + 0.5; o < hw - 0.4; o += 1) {
      const p = (s, oo) => [x + dx * s - dz * oo, 0.075, z + dz * s + dx * oo];
      buf.quad(p(-len / 2, o), p(-len / 2, o + 0.5), p(len / 2, o + 0.5), p(len / 2, o), [0, 0], [0, 0], [0, 0], [0, 0], w, [0, 1, 0]);
    }
  }

  // ---------------------------------------------------------------- Peatonal Rivadavia
  const paveBuf = new GeoBuf(), zebraBuf = new GeoBuf();
  const nodeAt = ([x, z]) => graph.byKey.get(`${Math.round(x * 2)},${Math.round(z * 2)}`);
  let kiosks = 0;
  for (const road of data.roads.filter(PEATONAL)) {
    const line = new Line(road.pts);
    // the open width between the facades on both sides
    const free = [];
    for (let s = 5; s < line.len; s += 7) {
      const [x, z, dx, dz] = line.at(s);
      for (const sd of [-1, 1]) {
        let d = 4;
        while (d < 10 && !collision.isBlocked(x - dz * sd * d, z + dx * sd * d, 0.2)) d += 0.5;
        free.push(d);
      }
    }
    free.sort((a, b) => a - b);
    const half = Math.max(4, Math.min(8, free[Math.floor(free.length * 0.3)] ?? 4) - 0.2);
    // cross streets cut the peatonal into blocks
    const cuts = [];
    for (let i = 0; i < road.pts.length; i++) {
      const n = nodeAt(road.pts[i]);
      if (!n) continue;
      let cw = 0, cdx = 0, cdz = 0;
      for (const [nb, r] of n.links) {
        if (r === road || r.kind === 'footway' || r.kind === 'pedestrian') continue;
        if (r.w / 2 > cw) {
          cw = r.w / 2;
          const l = Math.hypot(nb.x - n.x, nb.z - n.z) || 1;
          cdx = (nb.x - n.x) / l;
          cdz = (nb.z - n.z) / l;
        }
      }
      if (cw) {
        cuts.push({ s: line.d[i], cw });
        zebraAcross(zebraBuf, n.x, n.z, cdx, cdz, cw, Math.min(2 * half - 1, 6));
      }
    }
    const blocks = [];
    let prev = { s: 0, cw: 0 };
    for (const c of [...cuts, { s: line.len, cw: 0 }]) {
      if (c.s - prev.s > 1) blocks.push([prev.s + prev.cw + (prev.cw ? 0.3 : 0), c.s - c.cw - (c.cw ? 0.3 : 0), !!prev.cw, !!c.cw]);
      prev = c;
    }
    for (const [s0, s1, cutA, cutB] of blocks) {
      const part = line.sub(s0, s1);
      if (!part) continue;
      ribbon(paveBuf, part, half * 2, 0.14, 1 / 6);
      // bolardos where the block meets a street
      for (const [s, on] of [[s0 + 0.6, cutA], [s1 - 0.6, cutB]]) {
        if (!on) continue;
        const [x, z, dx, dz] = line.at(s);
        for (let o = -half + 0.8; o <= half - 0.7; o += 1.5) bollard(x - dz * o, z + dx * o);
      }
      // furniture down the middle: cantero, banco + farola, cantero, tacho, ...
      let k = 0;
      for (let s = s0 + 6; s < s1 - 5; s += 8, k++) {
        const [x, z, dx, dz] = line.at(s);
        const a = Math.atan2(-dz, dx);
        const slot = k % 4;
        if (slot === 0 || slot === 2) planter(x, z, a);
        else if (slot === 1) {
          if (kiosks < 3 && s1 - s0 > 50 && k === 5) {
            kiosk(x, z, a, kiosks === 2);
            kiosks++;
          } else {
            bench(x - dz * 0.35, z + dx * 0.35, a);
            bench(x + dz * 0.35, z - dx * 0.35, a + Math.PI);
          }
        } else {
          farola(x, z, a + Math.PI / 2);
          trash(x + dx * 1.2 - dz * 0.6, z + dz * 1.2 + dx * 0.6);
        }
        keepOut.push([x, z, 2.5]);
      }
    }
  }

  // ---------------------------------------------------------------- Estación Quilmes forecourt
  const st = (data.specials || []).find((s) => s.type === 'station' && /quilmes/i.test(s.name || ''));
  if (st) {
    const toW = (u, v) => [st.cx + st.ux * u - st.uz * v, st.cz + st.uz * u + st.ux * v];
    const side = st.houseSide > 0 ? 1 : -1;
    const house = side > 0 ? st.hi + 1.7 + 6.5 + 5.5 : st.lo - 1.7 - 6.5 - 5.5;
    // walk out from the station house to the first street
    let street = null;
    for (let v = house + side * 6; Math.abs(v - house) < 70; v += side) {
      const [x, z] = toW(0, v);
      const n = graph.nearest(x, z, 20);
      if (n && n.seg.road.kind !== 'footway' && n.seg.road.kind !== 'pedestrian' && n.dist < n.seg.road.w / 2 + 3.5) {
        street = { v, road: n.seg.road };
        break;
      }
    }
    if (street) {
      const a = Math.atan2(-st.uz, st.ux); // local +x along the tracks
      const vStall = street.v - side * 1.8; // on the sidewalk, facing the street
      const spots = [[-28, 'stall', Z.tarpBlue], [-22, 'stall', Z.tarpRed], [-16, 'chori'], [16, 'stall', Z.tarpGreen], [22, 'stall', Z.tarpBlue], [28, 'stall', Z.tarpRed]];
      for (const [u, kind, tarp] of spots) {
        const [x, z] = toW(u, vStall);
        if (collision.isBlocked(x, z, 1.3)) continue;
        if (kind === 'chori') choriCart(x, z, a);
        else stall(x, z, a, tarp);
        keepOut.push([x, z, 2.5]);
      }
      // parada de taxis: a sign post at the curb
      const [tx, tz] = toW(-8, street.v - side * 0.6);
      kit.add(cyl(0.04, 0.04, 2.6, 6), Z.iron, M(tx, 0, tz));
      kit.add(new THREE.PlaneGeometry(1.3, 0.26), Z.taxi, M(tx, 2.45, tz, a));
      kit.add(new THREE.PlaneGeometry(1.3, 0.26), Z.taxi, M(tx, 2.45, tz, a + Math.PI));
      solid(tx, tz, 0.1);
      // the forecourt between the house and the street, paved
      const fc = new THREE.PlaneGeometry(60, Math.abs(street.v - house) - 5).rotateX(-Math.PI / 2);
      const uv = fc.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 10, uv.getY(i) * 3);
      const [fx, fz] = toW(0, (house + side * 5 + street.v - side * 3.2) / 2);
      flats.add(fc, pave, M(fx, 0.14, fz, a));
      for (const u of [-24, -8, 8, 24]) {
        const [x, z] = toW(u, (house + street.v) / 2);
        if (!collision.isBlocked(x, z, 1)) {
          farola(x, z, a);
          bench(x + Math.sin(a) * 1.5, z + Math.cos(a) * 1.5, a);
        }
      }
    }
  }

  // ---------------------------------------------------------------- Plaza San Martín extras
  const pz = (data.specials || []).find((s) => s.type === 'plaza' && /san mart/i.test(s.name || ''));
  if (pz) {
    const o = pz.box;
    const toW = (u, v) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v];
    const a = Math.atan2(-o.uz, o.ux);
    const hu = o.hu - 3, hv = o.hv - 3;
    // canteros de flores between the paths around the monument
    const bedMats = [0, 1, 2].map((k) => new THREE.MeshStandardMaterial({ map: flowerTexture(k), roughness: 1 }));
    for (let k = 0; k < 8; k++) {
      const ang = (k + 0.5) * (Math.PI / 4);
      const [x, z] = toW(Math.cos(ang) * 15, Math.sin(ang) * 15);
      const bed = new THREE.CircleGeometry(2.6, 20).rotateX(-Math.PI / 2);
      kit.add(bed, bedMats[k % 3], M(x, 0.22, z));
      kit.add(new THREE.CylinderGeometry(2.7, 2.75, 0.22, 20, 1, true).translate(0, 0.11, 0), Z.concrete, M(x, 0, z));
      keepOut.push([x, z, 3]);
    }
    // palmeras on both sides of the cross paths
    const palms = [];
    for (const f of [-0.75, -0.4, 0.4, 0.75]) palms.push([f * hu, 3.2], [f * hu, -3.2]);
    for (const f of [-0.55, 0.55]) palms.push([3.2, f * hv], [-3.2, f * hv]);
    for (const [u, v] of palms) {
      const [x, z] = toW(u, v);
      palm(x, z, 7 + rng() * 3);
      keepOut.push([x, z, 2]);
    }
    // mástil with the flag, at the head of the cross path
    const [mx, mz] = toW(hu - 8, 4.5);
    kit.add(cyl(1.2, 1.4, 0.6, 16), Z.concrete, M(mx, 0, mz));
    kit.add(cyl(0.07, 0.12, 14, 8), Z.white, M(mx, 0.6, mz));
    kit.add(new THREE.PlaneGeometry(3, 2).translate(1.5, 0, 0), Z.flag, M(mx, 13.4, mz, a + 0.6));
    solid(mx, mz, 1.3);
    keepOut.push([mx, mz, 3]);
    // farolas around the perimeter walk
    for (let u = -hu + 6; u <= hu - 6; u += 14) for (const v of [-hv - 1.8, hv + 1.8]) {
      const [x, z] = toW(u, v);
      if (!collision.isBlocked(x, z, 0.4)) farola(x, z, a);
    }
    for (let v = -hv + 6; v <= hv - 6; v += 14) for (const u of [-hu - 1.8, hu + 1.8]) {
      const [x, z] = toW(u, v);
      if (!collision.isBlocked(x, z, 0.4)) farola(x, z, a + Math.PI / 2);
    }
  }

  // ---------------------------------------------------------------- meshes
  if (paveBuf.pos.length) {
    const mesh = new THREE.Mesh(paveBuf.geometry(), pave);
    mesh.receiveShadow = true;
    mesh.renderOrder = -6.5;
    root.add(mesh);
  }
  if (zebraBuf.pos.length) {
    const mesh = new THREE.Mesh(zebraBuf.geometry(), flatMat(null, 0xffffff, { vertexColors: true }));
    mesh.renderOrder = -5.8;
    root.add(mesh);
  }
  flats.build(root, { cast: false, order: -6.5 });
  kit.build(root);
  return {
    lamps,
    setNight(n) {
      Z.lamp.emissiveIntensity = n * 2.5;
    },
  };
}

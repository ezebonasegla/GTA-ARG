// Procedural low-poly people: one skinned mesh per person (a single draw call),
// built from lathe/capsule parts with vertex colors and rigidly skinned to a
// 14-bone skeleton, plus a procedural animator (walk/run/idle/jump/push/fall/sit).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared by every person: one shader program, colors come from the vertices.
const personMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });

const SKIN = [0xf5d0b0, 0xeac0a0, 0xd9a47e, 0xc68e62, 0xa86d4a, 0x8d5a3b, 0x6b4430];
const HAIR = [0x1b1511, 0x1b1511, 0x2e1f14, 0x4a3020, 0x6b4a2b, 0x8a6a45, 0xb89a6a, 0x7a3b1e];
const GRAY = [0xb8b8b8, 0xdadada, 0x8f8f8f, 0xeeeeee];
const SHIRT = [0xffffff, 0xe9e4d8, 0x75aadb, 0x1d3f7a, 0xc0392b, 0x2e7d32, 0x222222, 0xf1c40f, 0x8e44ad, 0x7f8c8d, 0xe67e22, 0xd46a9a, 0x3a6ea5, 0x556b2f, 0x9b2335, 0x2a9d8f];
const JEANS = [0x2c3e66, 0x3b5a8a, 0x1f2a44, 0x4a6a9a, 0x243552];
const PANTS = [0x2b2b2b, 0x4a4a4a, 0x6b5b45, 0xc2b280, 0x3d3d2d, 0x1d1d24];
const SHOE = [0xf2f2f2, 0xf2f2f2, 0x222222, 0xc0392b, 0x2e5c8a, 0x9a9a9a, 0x2e7d32];
const CAP = [0x1d3f7a, 0xc0392b, 0x222222, 0xf2f2f2, 0x2e7d32, 0xf1c40f];
const BAG = [0x222222, 0x1d3f7a, 0x7a2e2e, 0x556b2f, 0x6b4a2b, 0xd46a9a];

// Bone indices.
const B = { root: 0, pelvis: 1, spine: 2, head: 3, shL: 4, elL: 5, shR: 6, elR: 7, hipL: 8, knL: 9, anL: 10, hipR: 11, knR: 12, anR: 13 };
const HIP_H = 0.95;

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ geometry
// Densify a lathe profile so per-face patterns get enough rows.
function resample(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i], [r1, y1] = pts[i + 1];
    const k = Math.max(1, Math.round((Math.hypot(r1 - r0, y1 - y0) / 0.6) * n));
    for (let j = 0; j < k; j++) out.push([r0 + ((r1 - r0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function lathe(pts, seg = 10) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// Capsule along +y from 0 to len, radius r0 at the bottom and r1 at the top.
function taper(r0, r1, len, seg = 8, cap = 3) {
  const pts = [];
  for (let i = 0; i <= cap; i++) {
    const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2);
    pts.push([Math.max(0.0001, r0 * Math.cos(a)), r0 * Math.sin(a)]);
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push([Math.max(0.0001, r1 * Math.cos(a)), len + r1 * Math.sin(a)]);
  }
  return lathe(pts, seg);
}

// Tube with a rounded top and an open, slightly turned-in bottom (sleeves, shorts).
function sleeve(rTop, rBot, len, seg = 8) {
  const pts = [[rBot - 0.01, 0], [rBot, 0]];
  pts.push([rTop, len]);
  for (let i = 1; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2);
    pts.push([Math.max(0.0001, rTop * Math.cos(a)), len + rTop * Math.sin(a)]);
  }
  return lathe(pts, seg);
}

class PartList {
  constructor() {
    this.geos = [];
    this.flat = false; // some part needs per-face colors -> non-indexed
  }

  // color: hex, or fn(x, y, z) -> hex evaluated per face in the part's local space.
  add(geo, bone, color, { p, r, s, q } = {}) {
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    if (typeof color === 'function') {
      geo = geo.toNonIndexed();
      this.flat = true;
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i += 3) {
        const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        _c.setHex(color(cx, cy, cz));
        for (let k = 0; k < 3; k++) col.set([_c.r, _c.g, _c.b], (i + k) * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    } else {
      _c.setHex(color);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p || [0, 0, 0])),
      q || new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))),
      new THREE.Vector3(...(s || [1, 1, 1])),
    );
    geo.applyMatrix4(m);
    const n = geo.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = bone;
      sw[i * 4] = 1;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.geos.push(geo);
  }

  // Tapered capsule between two bind-pose points.
  seg(a, b, r0, r1, bone, color, radial = 8, scale) {
    const d = _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const geo = taper(r0, r1, len, radial);
    if (scale) geo.scale(scale[0], 1, scale[1]);
    this.add(geo, bone, color, { p: a, q: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()) });
  }

  build() {
    const geos = this.flat ? this.geos.map((g) => (g.index ? g.toNonIndexed() : g)) : this.geos;
    const geo = mergeGeometries(geos);
    for (const g of this.geos) g.dispose();
    return geo;
  }
}

// Shirt patterns (per face, in torso space: x = person's left, y up, z forward).
const PATTERNS = {
  arg: (x, y, z) => (Math.floor((Math.atan2(x, z) + Math.PI) / ((Math.PI * 2) / 26)) % 2 ? 0xffffff : 0x75aadb),
  boca: (x, y) => (y > 1.19 && y < 1.3 ? 0xf4c20d : 0x0b2e7a),
  river: (x, y) => (Math.abs(y - 1.17 + x * 1.3) < 0.055 ? 0xd62828 : 0xfafafa),
  quilmes: (x, y) => (y > 1.4 || (y > 1.3 && y < 1.33) ? 0x13235b : 0xfafafa),
  rayas: (x, y) => (Math.floor(y / 0.06) % 2 ? 0xf2f2f2 : 0x1d3f7a),
};
const PATTERN_SLEEVE = { arg: 0x75aadb, boca: 0x0b2e7a, river: 0xfafafa, quilmes: 0xfafafa, rayas: 0x1d3f7a };

// Random look for a pedestrian.
export function randomPersonOpts(rng = Math.random) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const r = rng();
  const age = r < 0.1 ? 'kid' : r < 0.26 ? 'elder' : 'adult';
  const fem = rng() < 0.5;
  const o = { age, fem, skin: pick(SKIN), build: 0.92 + rng() * 0.26, rng };
  o.hairColor = age === 'elder' ? pick(GRAY) : pick(HAIR);
  o.hair = fem
    ? pick(age === 'elder' ? ['bun', 'short', 'bob'] : ['long', 'long', 'ponytail', 'ponytail', 'bun', 'bob', 'cap'])
    : pick(age === 'elder' ? ['bald', 'bald', 'short', 'cap'] : ['short', 'short', 'buzz', 'cap', 'cap', 'long', 'bald', 'afro']);
  o.beard = !fem && age !== 'kid' && rng() < 0.3;
  o.glasses = age === 'elder' ? rng() < 0.6 : rng() < 0.08;
  o.shirt = pick(SHIRT);
  const pr = rng();
  o.pattern = age !== 'elder' && pr < 0.16 ? pick(['arg', 'boca', 'river', 'quilmes', 'rayas', 'boca', 'river']) : null;
  o.longSleeves = age === 'elder' ? rng() < 0.8 : rng() < 0.3;
  o.shorts = age !== 'elder' && rng() < 0.25;
  o.pants = o.shorts || rng() < 0.6 ? pick(JEANS) : pick(PANTS);
  if (o.shorts && rng() < 0.4) o.pants = pick(PANTS);
  o.shoes = age === 'elder' ? pick([0x2b1d14, 0x222222, 0x5b3a1e]) : pick(SHOE);
  o.sole = age === 'elder' ? 0x2a2a2a : pick([0xf5f5f5, 0xf5f5f5, 0x333333]);
  const acc = rng();
  o.backpack = age !== 'elder' && acc < 0.18;
  o.bag = !o.backpack && acc < (fem ? 0.45 : 0.28);
  o.mate = age !== 'kid' && rng() < 0.12;
  o.capColor = pick(CAP);
  o.bagColor = pick(BAG);
  return o;
}

export function createPersonMesh(opts = {}) {
  const rng = opts.rng || Math.random;
  if (!opts.full) opts = { ...randomPersonOpts(rng), ...opts };
  if (opts.stripes && !opts.pattern) opts.pattern = 'arg';
  const { fem, age } = opts;
  const P = new PartList();
  const skin = opts.skin, hairC = opts.hairColor, pants = opts.pants;
  const shirtFn = opts.pattern ? PATTERNS[opts.pattern] : opts.shirt;
  const sleeveC = opts.pattern ? PATTERN_SLEEVE[opts.pattern] : opts.shirt;
  const bw = opts.build ?? 1;
  const sw = (fem ? 0.168 : 0.186) * (0.94 + bw * 0.06); // shoulder joint x
  const hx = fem ? 0.095 : 0.09; // hip joint x
  const headS = age === 'kid' ? 1.14 : 1;

  // --- pelvis (pants)
  const hipK = (fem ? 1.06 : 1) * bw;
  P.add(lathe([[0.0001, 0.8], [0.1, 0.8], [0.13 * hipK, 0.84], [0.136 * hipK, 0.89], [0.128 * bw, 0.95], [0.0001, 0.97]], 12), B.pelvis, pants, { s: [1, 1, 0.64] });

  // --- torso (shirt): waist -> chest -> shoulders
  const tw = bw, chest = fem ? 0.145 : 0.16;
  const prof = resample([
    [0.0001, 0.875], [0.148 * tw * (fem ? 1.04 : 1), 0.88], [0.15 * tw, 0.95], [(fem ? 0.125 : 0.142) * tw, 1.06], [(fem ? 0.135 : 0.15) * tw, 1.16],
    [chest * (0.95 + tw * 0.05), 1.27], [chest * 1.03, 1.35], [chest * 0.98, 1.41], [0.12, 1.455], [0.06, 1.48], [0.0001, 1.485],
  ], opts.pattern ? 16 : 5);
  P.add(lathe(prof, opts.pattern ? 26 : 12), B.spine, shirtFn, { s: [1, 1, fem ? 0.66 : 0.64] });
  if (fem && age !== 'kid') {
    for (const sx of [-1, 1]) P.add(new THREE.SphereGeometry(0.058, 10, 7), B.spine, typeof shirtFn === 'function' ? shirtFn(0, 1.25, 1) : shirtFn, { p: [sx * 0.05, 1.245, 0.058], s: [1.15, 0.8, 0.6] });
  }
  if (opts.pattern === 'arg' || opts.pattern === 'boca' || opts.pattern === 'quilmes') {
    // collar
    P.add(new THREE.TorusGeometry(0.052, 0.011, 4, 10), B.spine, opts.pattern === 'boca' ? 0xf4c20d : opts.pattern === 'quilmes' ? 0x13235b : 0xffffff, { p: [0, 1.472, 0.004], r: [Math.PI / 2 + 0.15, 0, 0] });
  }

  // --- neck + head
  P.seg([0, 1.43, -0.005], [0, 1.56, 0.005], 0.047, 0.043, B.head, skin, 8);
  const hy = 1.63, hz = 0.008;
  const H = (x, y, z) => [x * headS, hy + (y - hy) * headS, hz + (z - hz) * headS];
  const hs = (s) => s.map((k) => k * headS);
  P.add(lathe([[0.0001, -0.125], [0.045, -0.12], [0.074, -0.097], [0.091, -0.052], [0.099, -0.005], [0.1, 0.035], [0.089, 0.083], [0.062, 0.114], [0.03, 0.128], [0.0001, 0.131]], 12), B.head, skin, { p: H(0, hy, hz), s: hs([0.94, 1, 1.08]) });
  // face
  const dark = 0x1a1410;
  for (const sx of [-1, 1]) {
    P.add(new THREE.SphereGeometry(0.0125, 6, 4), B.head, dark, { p: H(sx * 0.035, hy + 0.012, hz + 0.093), s: hs([1, 1.1, 0.6]) });
    P.add(new THREE.BoxGeometry(0.036, 0.009, 0.012), B.head, hairC, { p: H(sx * 0.036, hy + 0.038, hz + 0.095), r: [0, 0, sx * -0.12], s: hs([1, 1, 1]) });
    P.add(new THREE.SphereGeometry(0.022, 6, 4), B.head, skin, { p: H(sx * 0.093, hy + 0.002, hz - 0.004), s: hs([0.5, 1.1, 0.8]) });
  }
  P.add(new THREE.BoxGeometry(0.022, 0.042, 0.03), B.head, skin, { p: H(0, hy - 0.012, hz + 0.1), r: [-0.25, 0, 0], s: hs([1, 1, 1]) });
  P.add(new THREE.BoxGeometry(0.038, 0.007, 0.012), B.head, 0x7a3030, { p: H(0, hy - 0.058, hz + 0.09), s: hs([1, 1, 1]) });
  if (opts.glasses) {
    for (const sx of [-1, 1]) P.add(new THREE.TorusGeometry(0.02, 0.004, 3, 8), B.head, 0x151515, { p: H(sx * 0.036, hy + 0.012, hz + 0.104), s: hs([1, 1, 1]) });
    P.add(new THREE.BoxGeometry(0.03, 0.005, 0.005), B.head, 0x151515, { p: H(0, hy + 0.016, hz + 0.106), s: hs([1, 1, 1]) });
  }
  if (opts.beard) {
    P.add(new THREE.SphereGeometry(0.103, 12, 6, 0, Math.PI * 2, Math.PI * 0.57, Math.PI * 0.33), B.head, hairC, { p: H(0, hy - 0.004, hz + 0.004), r: [0.3, 0, 0], s: hs([0.97, 1.22, 1.1]) });
    P.add(new THREE.BoxGeometry(0.06, 0.012, 0.015), B.head, hairC, { p: H(0, hy - 0.044, hz + 0.1), s: hs([1, 1, 1]) });
  }
  // hair
  const cap = (r, tilt, theta, dy = 0.012, dz = -0.008) =>
    P.add(new THREE.SphereGeometry(r, 12, 7, 0, Math.PI * 2, 0, theta), B.head, hairC, { p: H(0, hy + dy, hz + dz), r: [-tilt, 0, 0], s: hs([0.98, 1.2, 1.1]) });
  switch (opts.hair) {
    case 'buzz':
      cap(0.107, 0.35, 1.55, 0.014);
      break;
    case 'bald':
      cap(0.104, 1.25, 1.2, 0.0, -0.004);
      break;
    case 'afro':
      cap(0.126, 0.45, 1.7, 0.02, -0.02);
      break;
    case 'long':
      cap(0.111, 0.25, 1.64, 0.016);
      P.seg(H(0, hy + 0.04, hz - 0.055), H(0, hy - 0.2, hz - 0.075), 0.085 * headS, 0.07 * headS, B.head, hairC, 8, [1.18, 0.55]);
      break;
    case 'bob':
      cap(0.111, 0.25, 1.64, 0.016);
      P.seg(H(0, hy + 0.03, hz - 0.03), H(0, hy - 0.08, hz - 0.045), 0.1 * headS, 0.098 * headS, B.head, hairC, 10, [1.02, 0.85]);
      break;
    case 'ponytail':
      cap(0.11, 0.3, 1.6, 0.016);
      P.add(new THREE.SphereGeometry(0.028, 6, 4), B.head, hairC, { p: H(0, hy + 0.035, hz - 0.112) });
      P.seg(H(0, hy + 0.03, hz - 0.125), H(0, hy - 0.14, hz - 0.165), 0.035 * headS, 0.014 * headS, B.head, hairC, 6);
      break;
    case 'bun':
      cap(0.11, 0.3, 1.6, 0.016);
      P.add(new THREE.SphereGeometry(0.048, 8, 6), B.head, hairC, { p: H(0, hy + 0.11, hz - 0.085), s: hs([1, 0.85, 1]) });
      break;
    case 'cap': {
      cap(0.105, 0.9, 1.45, 0.0, -0.006);
      const cc = opts.capColor ?? 0x1d3f7a;
      P.add(new THREE.SphereGeometry(0.112, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), B.head, cc, { p: H(0, hy + 0.03, hz - 0.004), s: hs([0.97, 1.05, 1.1]) });
      P.add(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 10, 1, false, -Math.PI / 2, Math.PI), B.head, cc, { p: H(0, hy + 0.035, hz + 0.1), r: [0.12, 0, 0], s: hs([1, 1, 1.05]) });
      P.add(new THREE.SphereGeometry(0.012, 5, 3), B.head, cc, { p: H(0, hy + 0.147, hz) });
      break;
    }
    default:
      cap(0.111, 0.28, 1.62, 0.016);
  }

  // --- arms
  for (const side of [1, -1]) {
    const L = side === 1;
    const sh = L ? B.shL : B.shR, el = L ? B.elL : B.elR;
    const x = side * sw;
    const armC = opts.longSleeves ? sleeveC : skin;
    P.seg([x, 1.14, 0], [x, 1.42, 0], 0.041, 0.05, sh, armC, 8);
    if (!opts.longSleeves) P.add(sleeve(0.058, 0.056, 0.15, 9), sh, sleeveC, { p: [x, 1.27, 0] });
    P.seg([x, 0.895, 0], [x, 1.14, 0], 0.032, 0.04, el, armC, 8);
    if (opts.longSleeves) P.add(new THREE.CylinderGeometry(0.041, 0.043, 0.04, 8), el, sleeveC, { p: [x, 0.915, 0] });
    // hand (mitten + thumb)
    P.add(new THREE.SphereGeometry(0.04, 7, 5), el, skin, { p: [x + side * 0.004, 0.845, 0.006], s: [0.62, 1.3, 1] });
    P.add(new THREE.SphereGeometry(0.016, 5, 4), el, skin, { p: [x - side * 0.004, 0.865, 0.034], s: [0.9, 1.5, 0.9] });
  }
  if (opts.mate) {
    // mate in the right hand, termo in the left
    P.add(new THREE.SphereGeometry(0.034, 8, 6), B.elR, 0x6b4423, { p: [-sw, 0.83, 0.05], s: [1, 1.15, 1] });
    P.add(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), B.elR, 0xc9c9c9, { p: [-sw + 0.01, 0.875, 0.052], r: [0, 0, 0.2] });
        // held so it stands upright when the elbow is bent
    P.add(new THREE.CylinderGeometry(0.034, 0.034, 0.3, 10), B.elL, 0x8c1c1c, { p: [sw, 0.83, 0.1], r: [Math.PI / 2, 0, 0] });
    P.add(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 10), B.elL, 0x222222, { p: [sw, 0.83, 0.265], r: [Math.PI / 2, 0, 0] });
  }

  // --- legs
  for (const side of [1, -1]) {
    const L = side === 1;
    const hip = L ? B.hipL : B.hipR, kn = L ? B.knL : B.knR, an = L ? B.anL : B.anR;
    const x = side * hx;
    const legC = opts.shorts ? skin : pants;
    P.seg([x, 0.5, 0], [x, 0.93, 0], 0.058, 0.082 * (fem ? 1.04 : 1) * bw, hip, legC, 9);
    if (opts.shorts) P.add(sleeve(0.09 * bw, 0.084, 0.3, 10), hip, pants, { p: [x, 0.64, 0] });
    P.seg([x, 0.1, -0.005], [x, 0.5, 0], 0.042, 0.056, kn, legC, 8);
    if (opts.shorts) P.add(new THREE.CylinderGeometry(0.047, 0.045, 0.12, 8), kn, 0xf2f2f2, { p: [x, 0.15, -0.004] });
    else P.add(new THREE.CylinderGeometry(0.052, 0.058, 0.07, 9), kn, pants, { p: [x, 0.15, -0.004] });
    // zapatilla
    P.seg([x, 0.065, -0.05], [x, 0.058, 0.14], 0.052, 0.046, an, opts.shoes ?? 0xf2f2f2, 8, [1.05, 0.72]);
    P.add(new THREE.BoxGeometry(0.094, 0.034, 0.25), an, opts.sole ?? 0xf5f5f5, { p: [x, 0.017, 0.042] });
  }

  // --- accessories
  if (opts.backpack) {
    const bc = opts.bagColor ?? 0x222222;
    P.add(new THREE.BoxGeometry(0.26, 0.34, 0.13), B.spine, bc, { p: [0, 1.2, -0.165] });
    P.seg([-0.12, 1.37, -0.165], [0.12, 1.37, -0.165], 0.065, 0.065, B.spine, bc, 8, [1, 1]);
    P.add(new THREE.BoxGeometry(0.2, 0.12, 0.04), B.spine, bc, { p: [0, 1.1, -0.245] });
    for (const sx of [-1, 1]) {
      P.add(new THREE.BoxGeometry(0.035, 0.3, 0.018), B.spine, 0x1a1a1a, { p: [sx * 0.085, 1.3, 0.103], r: [-0.12, 0, 0] });
      P.add(new THREE.BoxGeometry(0.035, 0.02, 0.24), B.spine, 0x1a1a1a, { p: [sx * 0.095, 1.456, -0.02] });
    }
  } else if (opts.bag) {
    const bc = opts.bagColor ?? 0x6b4a2b;
    // strap across the chest (left shoulder -> right hip) and the bag on the right side
    for (const zz of [0.104, -0.104]) P.add(new THREE.BoxGeometry(0.03, 0.56, 0.012), B.spine, 0x2a2016, { p: [0, 1.2, zz], r: [0, 0, -0.62] });
    P.add(new THREE.BoxGeometry(0.07, 0.2, 0.23), B.spine, bc, { p: [-0.2, 0.92, 0.02], r: [0, 0, 0.12] });
  }

  // --- skeleton
  const bones = [];
  const bone = (parent, x, y, z) => {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const root = bone(null, 0, 0, 0);
  const pelvis = bone(root, 0, HIP_H, 0);
  const spine = bone(pelvis, 0, 0.05, 0);
  const head = bone(spine, 0, 0.47, 0);
  const shL = bone(spine, sw, 0.42, 0);
  const elL = bone(shL, 0, -0.28, 0);
  const shR = bone(spine, -sw, 0.42, 0);
  const elR = bone(shR, 0, -0.28, 0);
  const hipL = bone(pelvis, hx, -0.02, 0);
  const knL = bone(hipL, 0, -0.43, 0);
  const anL = bone(knL, 0, -0.41, 0);
  const hipR = bone(pelvis, -hx, -0.02, 0);
  const knR = bone(hipR, 0, -0.43, 0);
  const anR = bone(knR, 0, -0.41, 0);

  const g = new THREE.Group();
  g.rotation.order = 'YXZ'; // falls tip over in the person's own frame
  const mesh = new THREE.SkinnedMesh(P.build(), personMaterial);
  mesh.castShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.25);
  g.add(root, mesh);
  g.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));

  const scale = age === 'kid' ? 0.66 + rng() * 0.14 : (fem ? 0.93 : 0.98) * (0.96 + rng() * 0.08) * (age === 'elder' ? 0.97 : 1);
  g.scale.setScalar(opts.scale ?? scale);
  g.userData.rig = { pelvis, spine, head, shL, elL, shR, elR, hipL, knL, anL, hipR, knR, anR };
  g.userData.skinned = mesh;
  g.userData.look = opts;
  g.userData.anim = {
    phase: rng() * Math.PI * 2, t: rng() * 100, seed: rng() * 1000,
    move: 0, run: 0, air: 0, down: 0, downAir: 0, sit: 0, panic: 0,
    stoop: age === 'elder' ? 0.18 : 0, mate: !!opts.mate, fem: !!fem,
  };
  return g;
}

export function disposePerson(g) {
  const m = g.userData.skinned;
  if (!m) return;
  m.geometry.dispose();
  m.skeleton.dispose();
}

// ----------------------------------------------------------------- animation
const CH = ['py', 'px', 'pz', 'prx', 'pry', 'prz', 'srx', 'sry', 'srz', 'hrx', 'hry', 'hrz',
  'lsx', 'lsy', 'lsz', 'le', 'rsx', 'rsy', 'rsz', 're',
  'lhx', 'lhy', 'lhz', 'lk', 'la', 'rhx', 'rhy', 'rhz', 'rk', 'ra'];
const pose = () => Object.fromEntries(CH.map((k) => [k, 0]));
const P0 = pose(), P1 = pose(), P2 = pose();
function blend(out, b, w) {
  if (w <= 0) return;
  if (w >= 1) {
    for (const k of CH) out[k] = b[k];
    return;
  }
  for (const k of CH) out[k] += (b[k] - out[k]) * w;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const approach = (v, target, rate, dt) => v + (target - v) * Math.min(1, rate * dt);

function idlePose(o, a) {
  const t = a.t;
  const br = Math.sin(t * 2.1 + a.seed);
  const w = Math.sin(t * 0.45 + a.seed * 0.7);
  o.py = -0.008 + br * 0.003;
  o.px = w * 0.022;
  o.prz = -w * 0.035;
  o.srz = w * 0.03;
  o.srx = 0.02 + a.stoop + br * 0.012;
  o.hrx = -0.03 - a.stoop * 0.6;
  o.hry = Math.sin(t * 0.23 + a.seed) * Math.sin(t * 0.11 + a.seed * 1.3) * 0.5;
  // legs keep the feet planted under the shifted pelvis; the unloaded leg relaxes
  o.lhz = w * 0.035 - 0.015;
  o.rhz = w * 0.035 + 0.015;
  o.lk = 0.05 + Math.max(0, -w) * 0.16;
  o.rk = 0.05 + Math.max(0, w) * 0.16;
  o.lhx = -o.lk * 0.35;
  o.rhx = -o.rk * 0.35;
  o.la = o.lk * 0.5;
  o.ra = o.rk * 0.5;
  o.lsz = 0.09 + br * 0.012;
  o.rsz = -0.09 - br * 0.012;
  o.lsx = 0.03;
  o.rsx = 0.03;
  o.le = -0.16;
  o.re = -0.16;
  if (a.mate) {
    // sip from the mate every few seconds
    const c = (t + a.seed) % 7;
    const s = smooth(0, 0.5, c) * (1 - smooth(2.2, 2.8, c));
    o.rsx = -0.45 * s + 0.03 * (1 - s) - 0.25;
    o.rsz = -0.09 + 0.25 * s;
    o.re = -1.1 - 1.0 * s;
    o.rsy = 0.35 * s;
    o.hrx -= 0.08 * s;
    o.hry *= 1 - s;
    o.le = -1.3;
    o.lsx = -0.1;
  }
}

function locoPose(o, a) {
  const p = a.phase, run = a.run;
  const sp = Math.sin(p), cp = Math.cos(p);
  const lerp = (x, y) => x + (y - x) * run;
  const A = lerp(0.42, 0.78), K = lerp(0.95, 1.75);
  o.lhx = -A * sp + lerp(0, -0.12);
  o.rhx = A * sp + lerp(0, -0.12);
  // knee flexes during the swing and a little after heel strike
  const kneeF = (q) => 0.05 + K * Math.pow(Math.max(0, Math.cos(q + lerp(0.45, 0.2))), lerp(1.6, 1.2)) + lerp(0.1, 0.4) * Math.max(0, Math.sin(q - lerp(1.8, 1.4)));
  o.lk = kneeF(p);
  o.rk = kneeF(p + Math.PI);
  // keep the foot roughly level, toe push-off behind the body
  o.la = -(o.lhx + o.lk) * 0.75 + lerp(0.15, 0.35) * Math.max(0, -sp);
  o.ra = -(o.rhx + o.rk) * 0.75 + lerp(0.15, 0.35) * Math.max(0, sp);
  o.lhz = -0.03;
  o.rhz = 0.03;
  // pelvis: inverted-pendulum bob (walk) / low stance + flight (run), yaw and roll
  const s2 = sp * sp;
  o.py = lerp(-0.012 - 0.05 * s2, -0.1 + 0.06 * s2);
  o.pry = -lerp(0.13, 0.18) * sp;
  o.prz = lerp(0.035, 0.02) * Math.sin(p * 2);
  o.px = lerp(0.012, 0.0) * sp;
  // torso counter-rotates, leans into the run
  o.srx = lerp(0.06, 0.26) + a.stoop + lerp(0.015, 0.04) * Math.cos(p * 2);
  o.sry = lerp(0.22, 0.34) * sp;
  o.srz = -o.prz * 0.8;
  o.hrx = -o.srx * 0.6 - lerp(0, 0.06);
  o.hry = -(o.pry + o.sry) * 0.8;
  // arms opposite to the legs, elbows bend more when the arm swings forward
  const B2 = lerp(0.4, 0.75);
  o.lsx = B2 * sp + lerp(0.04, 0.1);
  o.rsx = -B2 * sp + lerp(0.04, 0.1);
  o.lsz = lerp(0.1, 0.16);
  o.rsz = -lerp(0.1, 0.16);
  o.lsy = lerp(0, -0.25);
  o.rsy = lerp(0, 0.25);
  o.le = -lerp(0.2, 1.45) - lerp(0.3, 0.35) * Math.max(0, -sp);
  o.re = -lerp(0.2, 1.45) - lerp(0.3, 0.35) * Math.max(0, sp);
  if (a.panic > 0) {
    // hands up, flailing
    const f = a.panic, wv = Math.sin(a.t * 14 + a.seed);
    o.lsx += (-2.5 + wv * 0.25 - o.lsx) * f;
    o.rsx += (-2.5 - wv * 0.25 - o.rsx) * f;
    o.lsz += (0.35 - o.lsz) * f;
    o.rsz += (-0.35 - o.rsz) * f;
    o.le += (-0.5 - o.le) * f;
    o.re += (-0.5 - o.re) * f;
    o.hrx += -0.2 * f;
  }
  if (a.mate) {
    o.re = Math.min(o.re, -1.25);
    o.le = Math.min(o.le, -1.1);
  }
}

function airPose(o, a, vy) {
  const f = smooth(3, -4, vy); // 0 rising (tucked), 1 falling (reaching down)
  o.py = -0.02;
  o.srx = 0.12 - 0.08 * f;
  o.hrx = -0.1;
  o.lhx = -1.0 + 0.6 * f;
  o.lk = 1.5 - 0.95 * f;
  o.la = 0.3;
  o.rhx = 0.3 - 0.35 * f;
  o.rk = 1.0 - 0.6 * f;
  o.ra = 0.3;
  o.lhz = -0.06;
  o.rhz = 0.06;
  o.lsx = 0.3 - 0.9 * f;
  o.rsx = -0.9 + 0.5 * f;
  o.lsz = 0.35 + 0.5 * f;
  o.rsz = -0.35 - 0.5 * f;
  o.le = -0.7;
  o.re = -0.9;
}

// t: seconds since the shove started.
function pushPose(o, t) {
  const ext = smooth(0.06, 0.18, t); // 0 wind-up, 1 arms extended
  o.py = -0.05;
  o.srx = 0.1 + 0.22 * ext;
  o.sry = 0.15 * (1 - ext);
  o.hrx = -0.1 - 0.12 * ext;
  o.lhx = -0.45;
  o.lk = 0.25;
  o.la = 0.25;
  o.rhx = 0.35;
  o.rk = 0.12;
  o.ra = -0.2;
  o.lsx = -0.9 - 0.62 * ext;
  o.rsx = -0.9 - 0.62 * ext;
  o.lsz = 0.05 - 0.2 * ext;
  o.rsz = -0.05 + 0.2 * ext;
  o.lsy = 0.5 * (1 - ext);
  o.rsy = -0.5 * (1 - ext);
  o.le = -1.9 + 1.75 * ext;
  o.re = -1.9 + 1.75 * ext;
}

function downPose(o, a) {
  const t = a.t, s = a.seed, fl = a.downAir;
  const v = (k) => Math.sin(s * 3.1 + k * 7.7); // per-person variation in [-1, 1]
  // sprawled on the ground
  o.py = -0.02;
  o.srx = -0.05;
  o.srz = v(1) * 0.15;
  o.hry = v(2) * 0.8;
  o.hrx = -0.2;
  o.lsx = -1.3 + v(3) * 0.8;
  o.lsz = 1.1 + v(4) * 0.35;
  o.le = -0.4 - Math.max(0, v(5)) * 1.2;
  o.rsx = -0.4 + v(6) * 0.8;
  o.rsz = -1.2 - v(7) * 0.3;
  o.re = -0.3 - Math.max(0, -v(5)) * 1.2;
  o.lhx = -0.15 + v(8) * 0.35;
  o.lhz = 0.22;
  o.lk = 0.15 + Math.max(0, v(9)) * 1.1;
  o.rhx = -0.2 - Math.max(0, -v(9)) * 0.9;
  o.rhz = -0.2;
  o.rk = 0.2 + Math.max(0, -v(9)) * 1.4;
  o.la = 0.5;
  o.ra = 0.5;
  if (fl > 0) {
    // flailing through the air
    const w = Math.sin(t * 17 + s), w2 = Math.cos(t * 13 + s);
    o.lsx += (-2.3 + w * 0.5 - o.lsx) * fl;
    o.rsx += (-1.9 - w2 * 0.5 - o.rsx) * fl;
    o.lsz += (0.8 - o.lsz) * fl;
    o.rsz += (-0.8 - o.rsz) * fl;
    o.le += (-0.6 - o.le) * fl;
    o.re += (-0.8 - o.re) * fl;
    o.lhx += (-0.6 + w2 * 0.4 - o.lhx) * fl;
    o.rhx += (0.2 + w * 0.4 - o.rhx) * fl;
    o.lk += (1.0 - o.lk) * fl;
    o.rk += (0.6 - o.rk) * fl;
    o.srx += (-0.3 - o.srx) * fl;
    o.hrx += (-0.4 - o.hrx) * fl;
  }
}

function sitPose(o) {
  o.py = -0.43;
  o.srx = -0.08;
  o.hrx = 0.05;
  o.lhx = -1.5;
  o.rhx = -1.5;
  o.lhz = -0.05;
  o.rhz = 0.05;
  o.lk = 1.45;
  o.rk = 1.45;
  o.lsx = -0.95;
  o.rsx = -0.95;
  o.lsz = -0.05;
  o.rsz = 0.05;
  o.le = -0.75;
  o.re = -0.75;
}

// Poses the rig. state: { speed (m/s), air, vy, push (seconds since a shove, <0 none),
// down (knocked over), downAir (still flying), sit (0..1, getting into a car), panic }.
export function animatePerson(g, dt, state = {}) {
  const a = g.userData.anim;
  const r = g.userData.rig;
  const speed = state.speed || 0;
  a.t += dt;
  const scale = g.scale.x || 1;
  a.move = approach(a.move, smooth(0.08, 0.9, speed), 10, dt);
  a.run = approach(a.run, smooth(2.3, 4.6, speed), 6, dt);
  a.air = approach(a.air, state.air ? 1 : 0, state.air ? 14 : 20, dt);
  a.down = approach(a.down, state.down ? 1 : 0, 10, dt);
  a.downAir = approach(a.downAir, state.downAir ? 1 : 0, 6, dt);
  a.sit = state.sit ?? 0;
  a.panic = approach(a.panic, state.panic ? 1 : 0, 6, dt);
  const stride = (1.35 + (2.9 - 1.35) * a.run) * scale;
  a.phase = (a.phase + (dt * speed * Math.PI * 2) / stride) % (Math.PI * 2);

  const o = P0;
  idlePose(o, a);
  if (a.move > 0.001) {
    locoPose(P1, a);
    blend(o, P1, a.move);
  }
  if (a.air > 0.001) {
    airPose(P1, a, state.vy || 0);
    blend(o, P1, a.air);
  }
  const pt = state.push ?? -1;
  if (pt >= 0 && pt < 0.6) {
    pushPose(P1, pt);
    blend(o, P1, smooth(0, 0.07, pt) * (1 - smooth(0.32, 0.58, pt)));
  }
  if (a.sit > 0) {
    sitPose(P1);
    blend(o, P1, a.sit);
  }
  if (a.down > 0.001) {
    downPose(P2, a);
    blend(o, P2, a.down);
  }

  r.pelvis.position.set(o.px, HIP_H + o.py, o.pz);
  r.pelvis.rotation.set(o.prx, o.pry, o.prz);
  r.spine.rotation.set(o.srx, o.sry, o.srz);
  r.head.rotation.set(o.hrx, o.hry, o.hrz);
  r.shL.rotation.set(o.lsx, o.lsy, o.lsz);
  r.elL.rotation.x = o.le;
  r.shR.rotation.set(o.rsx, o.rsy, o.rsz);
  r.elR.rotation.x = o.re;
  r.hipL.rotation.set(o.lhx, o.lhy, o.lhz);
  r.knL.rotation.x = o.lk;
  r.anL.rotation.x = o.la;
  r.hipR.rotation.set(o.rhx, o.rhy, o.rhz);
  r.knR.rotation.x = o.rk;
  r.anR.rotation.x = o.ra;
}

// Procedural models for well-known places, built on their real footprint/position:
// cathedral and churches, civic buildings with portico and flag, hospitals, train
// stations with platforms and canopies, stadiums with stands and floodlights, the
// Quilmes brewery (silos, chimney, sign), plazas (paths, monument, benches, lamps)
// and football pitches (lines and goals).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxCorners } from './geo.js';

// ------------------------------------------------------------------ helpers
class Kit {
  constructor() {
    this.parts = new Map();
  }
  add(geo, mat, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(matrix);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }
  build(root, { cast = true, receive = true, order } = {}) {
    for (const [mat, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = cast && !mat.transparent && mat.depthWrite !== false;
      mesh.receiveShadow = receive;
      if (order !== undefined || mat.depthWrite === false) mesh.renderOrder = order ?? -5.5;
      root.add(mesh);
    }
    this.parts.clear();
  }
}

// Local frame of an oriented box: local +x = long axis u, local +z = v, y up.
function frame(o) {
  const m = new THREE.Matrix4().makeRotationY(Math.atan2(-o.uz, o.ux));
  m.setPosition(o.cx, 0, o.cz);
  return m;
}
const tmp = new THREE.Matrix4();
function at(F, x, y, z, rotY = 0, s = 1) {
  const local = new THREE.Matrix4().makeRotationY(rotY).scale(new THREE.Vector3(s, s, s)).setPosition(x, y, z);
  return tmp.copy(F).multiply(local).clone();
}
function toWorld(o, u, v) {
  return [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v];
}

// Box whose UVs tile every `tile` meters (so facade textures keep their scale).
function tiledBox(w, h, d, tile = 6) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return g;
}
const boxAt = (w, h, d, tile) => {
  const g = tiledBox(w, h, d, tile);
  g.translate(0, h / 2, 0);
  return g;
};

// Gable roof prism along local x (length L), width W, rise H, base at y = 0.
function gablePrism(L, W, H) {
  const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, H)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  return g;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(text, bg, fg, w = 1024, h = 160, font = 'bold 96px Arial, sans-serif') {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4, w - 60);
  });
}

function flagTexture() {
  return canvasTexture(300, 200, (ctx) => {
    ctx.fillStyle = '#74acdf';
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 67, 300, 66);
    ctx.fillStyle = '#f6b40e';
    ctx.beginPath();
    ctx.arc(150, 100, 20, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(150 + Math.cos(a) * 18, 100 + Math.sin(a) * 18);
      ctx.lineTo(150 + Math.cos(a + 0.1) * 30, 100 + Math.sin(a + 0.1) * 30);
      ctx.lineTo(150 + Math.cos(a - 0.1) * 30, 100 + Math.sin(a - 0.1) * 30);
      ctx.fill();
    }
  });
}

// Which side of a box faces the nearest street: returns { nu, nv, off, half }.
function streetSide(o, graph) {
  const sides = [
    { nu: 1, nv: 0, off: o.hu, half: o.hv },
    { nu: -1, nv: 0, off: o.hu, half: o.hv },
    { nu: 0, nv: 1, off: o.hv, half: o.hu },
    { nu: 0, nv: -1, off: o.hv, half: o.hu },
  ];
  let best = sides[0], bestD = Infinity;
  for (const s of sides) {
    const [x, z] = toWorld(o, s.nu * (s.off + 2), s.nv * (s.off + 2));
    const d = graph.nearest(x, z, 80)?.dist ?? 999;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// ------------------------------------------------------------------ builder
export function buildLandmarks(data, { root, collision, graph, tex }) {
  const glow = []; // materials that light up at night: [material, intensity]
  const keepOut = []; // [x, z, r] circles where no trees should be planted
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const M = {
    stone: mat(0xf0e6cf, { map: tex.church.map }),
    stucco: mat(0xefe4cc),
    stuccoDark: mat(0xd8c9a8),
    slate: mat(0x56626a, { roughness: 0.6 }),
    tile: mat(0xb0563a, { map: tex.roofTile }),
    dome: mat(0x6f9c98, { roughness: 0.4, metalness: 0.5 }),
    gold: mat(0xd8b65a, { roughness: 0.3, metalness: 0.9 }),
    dark: mat(0x2a2522, { roughness: 0.9 }),
    brick: mat(0xffffff, { map: tex.brick.map }),
    concrete: mat(0xb9b5ac, { roughness: 0.95 }),
    metal: mat(0x6f7a73, { roughness: 0.5, metalness: 0.6 }),
    canopy: mat(0x3f5f4c, { roughness: 0.6, metalness: 0.3 }),
    cream: mat(0xf1e7c9),
    white: mat(0xf6f6f6, { roughness: 0.5 }),
    wood: mat(0x6b4a2f),
    iron: mat(0x1e2426, { roughness: 0.5, metalness: 0.6 }),
    bronze: mat(0x5a4632, { roughness: 0.45, metalness: 0.7 }),
    water: mat(0x5f93a8, { roughness: 0.05, metalness: 0.2 }),
    silo: mat(0xc9ccce, { roughness: 0.35, metalness: 0.7 }),
    lamp: mat(0xfff4d6, { emissive: 0xffd28a, emissiveIntensity: 0 }),
    flood: mat(0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 0 }),
    redCross: mat(0xffffff, { map: canvasTexture(128, 128, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#d62828'; c.fillRect(44, 12, 40, 104); c.fillRect(12, 44, 104, 40); }), emissive: 0xff3030, emissiveIntensity: 0 }),
    flag: new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.9 }),
    line: new THREE.MeshBasicMaterial({ color: 0xf4f4f4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    path: new THREE.MeshStandardMaterial({ map: tex.plaza, color: 0xe0c7b0, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  glow.push([M.lamp, 2.5], [M.flood, 4], [M.redCross, 0.8]);
  const kit = new Kit();
  const flats = new Kit();

  const byType = (t) => (data.specials || []).filter((s) => s.type === t);

  // ---------------------------------------------------------------- churches
  for (const b of data.buildings) {
    const sp = b.special;
    if (!sp || (sp.type !== 'cathedral' && sp.type !== 'church')) continue;
    const o = sp.box;
    const F = frame(o);
    const L = o.hu * 2, W = o.hv * 2;
    // facade on the short end closest to a street
    const dPlus = graph.nearest(...toWorld(o, o.hu + 3, 0), 80)?.dist ?? 999;
    const dMinus = graph.nearest(...toWorld(o, -o.hu - 3, 0), 80)?.dist ?? 999;
    const s = dPlus <= dMinus ? 1 : -1; // facade at u = s * hu
    const rot = s > 0 ? 0 : Math.PI;
    if (sp.type === 'cathedral') {
      const naveW = W * 0.56, aisleW = (W - naveW) / 2, naveH = 17, aisleH = 10;
      const r = naveW / 2;
      const bodyL = L - 7 - r; // between the facade block and the apse
      const bodyC = (s * (r - 7)) / 2;
      kit.add(boxAt(bodyL, naveH, naveW, 10), M.stone, at(F, bodyC, 0, 0));
      for (const side of [-1, 1]) {
        kit.add(boxAt(bodyL, aisleH, aisleW, 10), M.stone, at(F, bodyC, 0, side * (naveW / 2 + aisleW / 2)));
        kit.add(boxAt(bodyL, 0.6, aisleW + 0.4), M.slate, at(F, bodyC, aisleH, side * (naveW / 2 + aisleW / 2)));
        for (let u = -bodyL / 2 + 4; u < bodyL / 2 - 2; u += 6) kit.add(boxAt(1.2, aisleH - 1, 1.2), M.stuccoDark, at(F, bodyC + u, 0, side * (W / 2 + 0.3)));
      }
      kit.add(gablePrism(bodyL, naveW + 0.6, 6), M.slate, at(F, bodyC, naveH, 0));
      // apse
      const apse = new THREE.CylinderGeometry(r, r, naveH - 2, 20, 1, false, 0, Math.PI);
      apse.translate(0, (naveH - 2) / 2, 0);
      kit.add(apse, M.stucco, at(F, -s * (L / 2 - r), 0, 0, rot + Math.PI));
      const apseRoof = new THREE.SphereGeometry(r, 20, 8, Math.PI / 2, Math.PI, 0, Math.PI / 2);
      kit.add(apseRoof, M.slate, at(F, -s * (L / 2 - r), naveH - 2, 0, rot + Math.PI));
      // facade block with pediment
      const fu = s * (L / 2 - 3.5);
      kit.add(boxAt(7, 21, W), M.stone, at(F, fu, 0, 0));
      const ped = gablePrism(7.5, W + 0.6, 5.5);
      kit.add(ped, M.stucco, at(F, fu + s * 0.2, 21, 0));
      kit.add(boxAt(0.6, 1.2, W + 0.8), M.stuccoDark, at(F, fu + s * 3.5, 20, 0));
      // doors and rose window
      kit.add(boxAt(0.4, 6, 3.4), M.dark, at(F, s * (L / 2 + 0.05), 0, 0));
      for (const side of [-1, 1]) kit.add(boxAt(0.4, 4.5, 2.2), M.dark, at(F, s * (L / 2 + 0.05), 0, side * W * 0.3));
      const rose = new THREE.CylinderGeometry(2.3, 2.3, 0.4, 20);
      rose.rotateZ(Math.PI / 2);
      kit.add(rose, M.dark, at(F, s * (L / 2 + 0.1), 13, 0));
      // columns on the facade
      for (const side of [-1, 1]) {
        for (const k of [0.18, 0.42]) {
          const col = new THREE.CylinderGeometry(0.45, 0.5, 17, 12);
          col.translate(0, 8.5, 0);
          kit.add(col, M.cream, at(F, s * (L / 2 + 0.5), 0, side * W * k));
        }
      }
      // central bell tower: square shaft, belfry, octagonal drum, dome, lantern, cross
      const tu = s * (L / 2 - 4);
      kit.add(boxAt(7.5, 30, 7.5), M.stone, at(F, tu, 0, 0));
      kit.add(boxAt(8.3, 1, 8.3), M.stuccoDark, at(F, tu, 30, 0));
      kit.add(boxAt(6.6, 6, 6.6), M.stucco, at(F, tu, 31, 0));
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) kit.add(boxAt(du ? 0.3 : 2.4, 4, dv ? 0.3 : 2.4), M.dark, at(F, tu + du * 3.35, 32, dv * 3.35));
      kit.add(boxAt(7.2, 0.8, 7.2), M.stuccoDark, at(F, tu, 37, 0));
      const drum = new THREE.CylinderGeometry(2.8, 3.1, 3.5, 8);
      drum.translate(0, 1.75, 0);
      kit.add(drum, M.stucco, at(F, tu, 37.8, 0));
      kit.add(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.dome, at(F, tu, 41.3, 0));
      const lantern = new THREE.CylinderGeometry(0.7, 0.8, 2, 8);
      lantern.translate(0, 1, 0);
      kit.add(lantern, M.stucco, at(F, tu, 44, 0));
      kit.add(boxAt(0.3, 3.2, 0.3), M.gold, at(F, tu, 46, 0));
      kit.add(boxAt(0.3, 0.3, 1.6), M.gold, at(F, tu, 48, 0));
      collision.addPolygon(b.pts, 20, 'building');
    } else {
      // parish church: nave with gable roof and a bell tower with spire at a front corner
      const h = Math.min(10, Math.max(8, b.h));
      kit.add(boxAt(L, h, W, 10), M.stone, at(F, 0, 0, 0));
      kit.add(gablePrism(L + 0.6, W + 0.8, Math.min(W * 0.4, 7)), M.tile, at(F, 0, h, 0));
      const ped = gablePrism(0.6, W + 0.8, Math.min(W * 0.4, 7));
      kit.add(ped, M.stucco, at(F, s * (L / 2 + 0.2), h, 0));
      kit.add(boxAt(0.4, 4.5, 2.6), M.dark, at(F, s * (L / 2 + 0.05), 0, 0));
      const ts = Math.min(5, W * 0.35);
      const tu = s * (L / 2 - ts / 2), tv = W / 2 - ts / 2;
      const th = h + 9;
      kit.add(boxAt(ts, th, ts), M.stucco, at(F, tu, 0, tv));
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) kit.add(boxAt(du ? 0.3 : 1.4, 2.4, dv ? 0.3 : 1.4), M.dark, at(F, tu + du * ts / 2, th - 3.5, tv + dv * ts / 2));
      const spire = new THREE.ConeGeometry(ts * 0.72, 6, 4);
      spire.rotateY(Math.PI / 4);
      spire.translate(0, 3, 0);
      kit.add(spire, M.slate, at(F, tu, th, tv));
      kit.add(boxAt(0.2, 2.2, 0.2), M.gold, at(F, tu, th + 6, tv));
      kit.add(boxAt(0.2, 0.2, 1.1), M.gold, at(F, tu, th + 7.4, tv));
      collision.addPolygon(b.pts, h, 'building');
    }
  }

  // ---------------------------------------------------------------- civic & hospitals
  for (const b of data.buildings) {
    const sp = b.special;
    if (!sp || (sp.type !== 'civic' && sp.type !== 'hospital')) continue;
    const o = sp.box;
    const F = frame(o);
    const side = streetSide(o, graph);
    const tu = -side.nv, tv = side.nu; // tangent along the facade
    const rotSide = side.nu ? Math.PI / 2 : 0; // boxes are built along local x
    if (sp.type === 'civic') {
      const span = Math.min(side.half * 2 * 0.7, 26);
      const colH = Math.min(b.h - 2, 10);
      const n = Math.max(4, Math.round(span / 3.5) | 1);
      const out = side.off + 2.6;
      for (let i = 0; i < n; i++) {
        const t = -span / 2 + (span * i) / (n - 1);
        const col = new THREE.CylinderGeometry(0.42, 0.5, colH, 14);
        col.translate(0, colH / 2 + 0.9, 0);
        kit.add(col, M.cream, at(F, side.nu * out + tu * t, 0, side.nv * out + tv * t));
      }
      kit.add(boxAt(span + 2, 1.2, 4.2), M.cream, at(F, side.nu * (side.off + 2.1), colH + 0.9, side.nv * (side.off + 2.1), rotSide));
      const ped = gablePrism(4.2, span + 2.4, 2.8);
      kit.add(ped, M.stucco, at(F, side.nu * (side.off + 2.1), colH + 2.1, side.nv * (side.off + 2.1), rotSide + Math.PI / 2));
      for (let k = 0; k < 3; k++) kit.add(boxAt(span + 3 - k, 0.3, 5.2 - k * 0.7), M.concrete, at(F, side.nu * (side.off + 2.4 - k * 0.3), k * 0.3, side.nv * (side.off + 2.4 - k * 0.3), rotSide));
      if (sp.flag) {
        const px = side.nu * (side.off - 2), pz = side.nv * (side.off - 2);
        const pole = new THREE.CylinderGeometry(0.08, 0.1, 9, 8);
        pole.translate(0, 4.5, 0);
        kit.add(pole, M.metal, at(F, px, b.h, pz));
        const flag = new THREE.PlaneGeometry(3, 2);
        flag.translate(1.5, 0, 0);
        kit.add(flag, M.flag, at(F, px, b.h + 7.8, pz, Math.atan2(side.nu, side.nv) + Math.PI / 2));
        const name = new THREE.PlaneGeometry(Math.min(span, 18), 1.6);
        const signMat = new THREE.MeshStandardMaterial({ map: signTexture(sp.name.toUpperCase(), '#efe4cc', '#3a3024'), roughness: 0.8 });
        kit.add(name, signMat, at(F, side.nu * (side.off + 4.35), colH + 1.5, side.nv * (side.off + 4.35), Math.atan2(side.nu, side.nv)));
      }
    } else {
      // hospital: red crosses on the facade and the roof edge, entrance canopy
      const face = Math.atan2(side.nu, side.nv);
      const cross = new THREE.PlaneGeometry(2.6, 2.6);
      kit.add(cross, M.redCross, at(F, side.nu * (side.off + 0.08), b.h - 2.2, side.nv * (side.off + 0.08), face));
      kit.add(boxAt(8, 0.3, 4), M.white, at(F, side.nu * (side.off + 2), 3.2, side.nv * (side.off + 2), rotSide));
      for (const t of [-3.6, 3.6]) kit.add(boxAt(0.2, 3.2, 0.2), M.metal, at(F, side.nu * (side.off + 3.8) + tu * t, 0, side.nv * (side.off + 3.8) + tv * t));
      const sign = new THREE.PlaneGeometry(Math.min(side.half * 1.6, 16), 1.4);
      const signMat = new THREE.MeshStandardMaterial({ map: signTexture(sp.name.toUpperCase(), '#ffffff', '#1d4e89'), emissive: 0xffffff, emissiveIntensity: 0 });
      signMat.emissiveMap = signMat.map;
      glow.push([signMat, 0.6]);
      kit.add(sign, signMat, at(F, side.nu * (side.off + 0.1), 4.4, side.nv * (side.off + 0.1), face));
    }
  }

  // ---------------------------------------------------------------- train stations
  for (const st of byType('station')) {
    const o = { cx: st.cx, cz: st.cz, ux: st.ux, uz: st.uz };
    const F = frame(o);
    const half = st.length / 2;
    const platH = 1.05, platW = 6.5;
    const platforms = [st.lo - 1.7 - platW / 2, st.hi + 1.7 + platW / 2];
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture(st.name.toUpperCase(), '#1f3f8f', '#ffffff'), roughness: 0.6 });
    for (const pv of platforms) {
      kit.add(boxAt(st.length, platH, platW, 3), M.concrete, at(F, 0, 0, pv));
      const edge = pv < st.lo ? pv + platW / 2 - 0.25 : pv - platW / 2 + 0.25;
      flats.add(new THREE.PlaneGeometry(st.length, 0.35).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8c630 }), at(F, 0, platH + 0.01, edge));
      // British-style canopy over the middle of the platform
      const cl = 96;
      for (let u = -cl / 2; u <= cl / 2; u += 12) {
        const col = new THREE.CylinderGeometry(0.12, 0.15, 3.6, 8);
        col.translate(0, platH + 1.8, 0);
        kit.add(col, M.canopy, at(F, u, 0, pv));
      }
      kit.add(boxAt(cl + 2, 0.25, platW - 0.4), M.canopy, at(F, 0, platH + 3.6, pv));
      kit.add(gablePrism(cl + 2, platW - 0.2, 1.2), M.metal, at(F, 0, platH + 3.85, pv));
      for (const sv of [-1, 1]) kit.add(boxAt(cl + 2, 0.5, 0.08), M.cream, at(F, 0, platH + 3.1, pv + sv * (platW / 2 - 0.25)));
      // name boards and benches
      for (const u of [-half + 20, 0, half - 20]) {
        for (const pu of [-2.2, 2.2]) kit.add(boxAt(0.12, 2.6, 0.12), M.iron, at(F, u + pu, platH, pv));
        kit.add(new THREE.PlaneGeometry(4.6, 0.8), signMat, at(F, u, platH + 2.5, pv + 0.05));
        kit.add(new THREE.PlaneGeometry(4.6, 0.8), signMat, at(F, u, platH + 2.5, pv - 0.05, Math.PI));
      }
      for (let u = -40; u <= 40; u += 16) kit.add(boxAt(2, 0.45, 0.5), M.wood, at(F, u + 6, platH, pv));
      // ramps at both ends
      for (const e of [-1, 1]) {
        const ramp = new THREE.BoxGeometry(12, 0.2, platW - 1);
        ramp.rotateZ(e * Math.atan2(platH, 12));
        kit.add(ramp, M.concrete, at(F, e * (half + 5.8), platH / 2, pv));
      }
      collision.addPolygon(boxCorners({ cx: 0, cz: 0, ux: 1, uz: 0, vx: 0, vz: 1, hu: half, hv: platW / 2 }).map(([u, v]) => toWorld(o, u, v + pv)), platH, 'platform');
    }
    // station house (red brick, tiled gable roof) behind one platform
    const hv = st.houseSide > 0 ? st.hi + 1.7 + platW + 5.5 : st.lo - 1.7 - platW - 5.5;
    kit.add(boxAt(34, 7, 10), M.brick, at(F, 0, 0, hv));
    kit.add(gablePrism(35, 11, 3.2), M.tile, at(F, 0, 7, hv));
    kit.add(boxAt(10, 9.5, 11), M.brick, at(F, 0, 0, hv));
    const clockTower = gablePrism(11, 12, 3);
    clockTower.rotateY(Math.PI / 2);
    kit.add(clockTower, M.tile, at(F, 0, 9.5, hv));
    const bigSign = new THREE.PlaneGeometry(12, 1.6);
    kit.add(bigSign, signMat, at(F, 0, 5.4, hv + (st.houseSide > 0 ? 5.06 : -5.06), st.houseSide > 0 ? 0 : Math.PI));
    kit.add(bigSign, signMat, at(F, 0, 5.4, hv - (st.houseSide > 0 ? 5.06 : -5.06), st.houseSide > 0 ? Math.PI : 0));
    collision.addPolygon([[-17, -5], [17, -5], [17, 5], [-17, 5]].map(([u, v]) => toWorld(o, u, v + hv)), 9, 'building');
  }

  // ---------------------------------------------------------------- stadiums
  for (const sd of byType('stadium')) {
    const o = sd.box;
    const F = frame(o);
    const seat = sd.colors.map((c) => mat(c, { roughness: 0.6 }));
    const D = sd.depth, H = sd.height, steps = D > 16 ? 6 : 4;
    const gap = 3;
    const main = streetSide(o, graph);
    const stands = [
      { nu: 0, nv: 1, len: o.hu * 2 + 4, off: o.hv },
      { nu: 0, nv: -1, len: o.hu * 2 + 4, off: o.hv },
      { nu: 1, nv: 0, len: o.hv * 2 + 4, off: o.hu },
      { nu: -1, nv: 0, len: o.hv * 2 + 4, off: o.hu },
    ];
    for (const s of stands) {
      const isMain = s.nu === main.nu && s.nv === main.nv;
      const h = isMain ? H * 1.25 : H;
      const rot = s.nu ? Math.PI / 2 : 0;
      const dd = D / steps;
      for (let i = 0; i < steps; i++) {
        const d = s.off + gap + dd * (i + 0.5);
        kit.add(boxAt(s.len, (h * (i + 1)) / steps, dd), seat[i % seat.length], at(F, s.nu * d, 0, s.nv * d, rot));
      }
      kit.add(boxAt(s.len, h + 1.2, 0.6), M.concrete, at(F, s.nu * (s.off + gap + D + 0.3), 0, s.nv * (s.off + gap + D + 0.3), rot));
      const outer = s.off + gap + D + 0.6;
      const corners = [[-s.len / 2, s.off + gap], [s.len / 2, s.off + gap], [s.len / 2, outer], [-s.len / 2, outer]];
      collision.addPolygon(corners.map(([t, d]) => (s.nu ? toWorld(o, s.nu * d, t) : toWorld(o, t, s.nv * d))), h, 'building');
      if (isMain) {
        // roof over the main stand
        kit.add(boxAt(s.len, 0.4, D + 3), M.metal, at(F, s.nu * (s.off + gap + D / 2), h + 4, s.nv * (s.off + gap + D / 2), rot));
        for (let t = -s.len / 2 + 4; t <= s.len / 2 - 4; t += 12) {
          const col = new THREE.CylinderGeometry(0.25, 0.3, h + 4, 8);
          col.translate(0, (h + 4) / 2, 0);
          kit.add(col, M.metal, s.nu ? at(F, s.nu * (s.off + gap + D), 0, t) : at(F, t, 0, s.nv * (s.off + gap + D)));
        }
        if (sd.name) {
          const label = /centenario|quilmes atl/i.test(sd.name) ? 'QUILMES ATLÉTICO CLUB' : sd.name.toUpperCase();
          const sMat = new THREE.MeshStandardMaterial({ map: signTexture(label, sd.colors[1], sd.colors[0] === '#ffffff' ? '#ffffff' : '#ffffff'), roughness: 0.6 });
          const face = Math.atan2(s.nu, s.nv) + Math.PI;
          const d = s.off + gap + 0.5;
          kit.add(new THREE.PlaneGeometry(Math.min(40, s.len * 0.5), 3), sMat, at(F, s.nu * d, h + 2.4, s.nv * d, face));
          kit.add(new THREE.PlaneGeometry(Math.min(40, s.len * 0.5), 3), sMat, at(F, s.nu * (d + D + 0.4), h + 2.4, s.nv * (d + D + 0.4), face + Math.PI));
        }
      }
    }
    // floodlight towers in the corners
    for (const [cu, cv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const u = cu * (o.hu + gap + D * 0.7), v = cv * (o.hv + gap + D * 0.7);
      const pole = new THREE.CylinderGeometry(0.5, 0.9, H + 22, 8);
      pole.translate(0, (H + 22) / 2, 0);
      kit.add(pole, M.metal, at(F, u, 0, v));
      const panel = boxAt(5, 3, 0.6);
      kit.add(panel, M.flood, at(F, u, H + 21, v, Math.atan2(-cu, -cv)));
      collision.addCircle(...toWorld(o, u, v), 1, 'pole');
    }
    if (sd.turf) {
      flats.add(new THREE.PlaneGeometry(o.hu * 2, o.hv * 2).rotateX(-Math.PI / 2), mat(sd.turf, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), at(F, 0, 0.05, 0));
    }
    keepOut.push([o.cx, o.cz, Math.hypot(o.hu, o.hv) + D + 6]);
  }

  // ---------------------------------------------------------------- pitches: lines and goals
  for (const p of byType('pitch')) {
    const o = p.box;
    const F = frame(o);
    const lw = 0.14, y = 0.06;
    const line = (len, u, v, rot = 0) => flats.add(new THREE.PlaneGeometry(len, lw).rotateX(-Math.PI / 2), M.line, at(F, u, y, v, rot));
    const hu = o.hu - 1, hv = o.hv - 1;
    line(hu * 2, 0, hv);
    line(hu * 2, 0, -hv);
    line(hv * 2, hu, 0, Math.PI / 2);
    line(hv * 2, -hu, 0, Math.PI / 2);
    line(hv * 2, 0, 0, Math.PI / 2);
    const cr = Math.min(9.15, hv * 0.3);
    flats.add(new THREE.RingGeometry(cr - lw / 2, cr + lw / 2, 40).rotateX(-Math.PI / 2), M.line, at(F, 0, y, 0));
    const goalW = Math.min(7.32, hv * 0.3), goalH = goalW > 5 ? 2.44 : 2;
    const boxD = Math.min(16.5, hu * 0.3), boxW = Math.min(40.3, hv * 1.3);
    for (const e of [-1, 1]) {
      line(boxW, e * (hu - boxD), 0, Math.PI / 2);
      line(boxD, e * (hu - boxD / 2), boxW / 2);
      line(boxD, e * (hu - boxD / 2), -boxW / 2);
      for (const sv of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.06, 0.06, goalH, 6);
        post.translate(0, goalH / 2, 0);
        kit.add(post, M.white, at(F, e * hu, 0, sv * goalW / 2));
      }
      kit.add(boxAt(0.12, 0.12, goalW), M.white, at(F, e * hu, goalH - 0.06, 0));
      kit.add(boxAt(0.1, 0.1, goalW), M.white, at(F, e * (hu + 1.5), 0, 0));
    }
  }

  // ---------------------------------------------------------------- Cervecería Quilmes
  for (const bw of byType('brewery')) {
    const o = bw.box;
    const F = frame(o);
    const h = bw.h || 12;
    // silos in two rows near one end, rising above the roof
    for (let i = 0; i < 4; i++) {
      for (const v of [-5.2, 5.2]) {
        const silo = new THREE.CylinderGeometry(4.5, 4.5, h + 18, 20);
        silo.translate(0, (h + 18) / 2, 0);
        kit.add(silo, M.silo, at(F, o.hu - 8 - i * 9.6, 0, v));
        const cap = new THREE.ConeGeometry(4.6, 2.2, 20);
        cap.translate(0, h + 19.1, 0);
        kit.add(cap, M.silo, at(F, o.hu - 8 - i * 9.6, 0, v));
      }
    }
    kit.add(boxAt(40, 3, 1.4), M.metal, at(F, o.hu - 22, h + 18, 0));
    // brick chimney at the other end
    const ch = new THREE.CylinderGeometry(1.7, 2.8, h + 38, 16);
    ch.translate(0, (h + 38) / 2, 0);
    kit.add(ch, M.brick, at(F, -o.hu + 10, 0, 0));
    kit.add(new THREE.CylinderGeometry(2, 2, 1.2, 16).translate(0, h + 38, 0), M.stuccoDark, at(F, -o.hu + 10, 0, 0));
    // the big QUILMES sign on the roof
    const sMat = new THREE.MeshStandardMaterial({
      map: canvasTexture(1024, 256, (ctx, w, hh) => {
        ctx.fillStyle = '#12308a';
        ctx.fillRect(0, 0, w, hh);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, hh - 46, w, 14);
        ctx.fillStyle = '#d7263d';
        ctx.fillRect(0, hh - 32, w, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic bold 170px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Quilmes', w / 2, hh / 2 - 16);
      }),
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.5,
    });
    sMat.emissiveMap = sMat.map;
    glow.push([sMat, 0.9]);
    const sw = Math.min(70, o.hu * 0.5), sh = sw / 4;
    for (const t of [-sw * 0.4, 0, sw * 0.4]) kit.add(boxAt(0.5, 6, 0.5), M.iron, at(F, t, h, 0));
    for (const face of [0, Math.PI]) kit.add(new THREE.PlaneGeometry(sw, sh), sMat, at(F, 0, h + 5 + sh / 2, face ? -0.15 : 0.15, face));
    collision.addCircle(...toWorld(o, -o.hu + 10, 0), 2.8, 'building');
  }

  // ---------------------------------------------------------------- plazas
  for (const pz of byType('plaza')) {
    const o = pz.box;
    const F = frame(o);
    const hu = o.hu - 3, hv = o.hv - 3;
    const path = (u0, v0, u1, v1, w) => {
      const len = Math.hypot(u1 - u0, v1 - v0);
      const g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 4, (uv.getY(i) * w) / 4);
      flats.add(g, M.path, at(F, (u0 + u1) / 2, 0.045, (v0 + v1) / 2, -Math.atan2(v1 - v0, u1 - u0)));
      for (let t = 0; t <= len; t += 6) keepOut.push([...toWorld(o, u0 + ((u1 - u0) * t) / len, v0 + ((v1 - v0) * t) / len), w / 2 + 1.5]);
    };
    // perimeter walk, diagonals and cross paths
    path(-hu, -hv, hu, -hv, 3);
    path(-hu, hv, hu, hv, 3);
    path(-hu, -hv, -hu, hv, 3);
    path(hu, -hv, hu, hv, 3);
    path(-hu, -hv, hu, hv, 3.2);
    path(-hu, hv, hu, -hv, 3.2);
    path(-hu, 0, hu, 0, 2.6);
    path(0, -hv, 0, hv, 2.6);
    const round = new THREE.CircleGeometry(Math.min(9, hv * 0.3), 32).rotateX(-Math.PI / 2);
    flats.add(round, M.path, at(F, 0, 0.05, 0));
    keepOut.push([o.cx, o.cz, Math.min(9, hv * 0.3) + 2]);
    // benches and lamps along the diagonals
    for (const [du, dv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ang = Math.atan2(dv * hv, du * hu);
      for (const t of [0.35, 0.65]) {
        const u = du * hu * t, v = dv * hv * t;
        const nu = -Math.sin(ang) * 2.4, nv = Math.cos(ang) * 2.4;
        const r = -ang;
        kit.add(boxAt(1.8, 0.45, 0.5), M.wood, at(F, u + nu, 0, v + nv, r));
        kit.add(boxAt(1.8, 0.5, 0.08), M.wood, at(F, u + nu * 1.1, 0.45, v + nv * 1.1, r));
      }
      const lu = du * hu * 0.5, lv = dv * hv * 0.5;
      kit.add(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 6).translate(0, 1.8, 0), M.iron, at(F, lu, 0, lv));
      kit.add(new THREE.SphereGeometry(0.32, 12, 8), M.lamp, at(F, lu, 3.8, lv));
    }
    buildMonument(pz.monument, F, o);
  }

  function buildMonument(kind, F, o) {
    if (kind === 'equestrian') {
      // General San Martín on horseback over a stone pedestal
      kit.add(boxAt(7, 1, 4.6), M.stuccoDark, at(F, 0, 0, 0));
      kit.add(boxAt(5.6, 4.5, 3), M.stone, at(F, 0, 1, 0));
      kit.add(boxAt(6, 0.5, 3.4), M.stuccoDark, at(F, 0, 5.5, 0));
      const S = 1.7, y0 = 6;
      const part = (w, h, d, x, y, z, rz = 0) => {
        const g = new THREE.BoxGeometry(w * S, h * S, d * S);
        g.rotateZ(rz);
        g.translate(x * S, y0 + y * S, z * S);
        kit.add(g, M.bronze, F.clone());
      };
      part(1.9, 0.8, 0.7, 0, 1.45, 0); // body
      for (const [x, z, rz] of [[0.75, 0.22, -0.35], [0.75, -0.22, 0], [-0.75, 0.22, 0.2], [-0.75, -0.22, 0]]) part(0.16, 1.1, 0.16, x + (rz ? 0.1 : 0), 0.6, z, rz);
      part(0.35, 0.9, 0.35, 1.05, 2.05, 0, -0.6); // neck
      part(0.7, 0.3, 0.28, 1.45, 2.45, 0, -0.25); // head
      part(0.12, 0.7, 0.12, -1, 1.4, 0, 0.5); // tail
      part(0.45, 0.8, 0.4, -0.05, 2.25, 0); // rider torso
      part(0.25, 0.28, 0.25, -0.05, 2.8, 0); // head
      part(0.3, 0.12, 0.3, -0.05, 2.98, 0); // bicorn hat
      part(0.12, 0.7, 0.12, 0.35, 2.8, 0.2, -1.1); // raised arm
      part(0.14, 0.5, 0.14, -0.05, 1.85, 0.3); // legs
      part(0.14, 0.5, 0.14, -0.05, 1.85, -0.3);
      collision.addPolygon([[-3.5, -2.3], [3.5, -2.3], [3.5, 2.3], [-3.5, 2.3]].map(([u, v]) => toWorld(o, u, v)), 6, 'building');
    } else if (kind === 'obelisk') {
      kit.add(boxAt(4, 0.8, 4), M.stuccoDark, at(F, 0, 0, 0));
      const ob = new THREE.CylinderGeometry(0.9, 1.4, 12, 4);
      ob.rotateY(Math.PI / 4);
      ob.translate(0, 6.8, 0);
      kit.add(ob, M.cream, at(F, 0, 0, 0));
      const tip = new THREE.ConeGeometry(0.95, 1.6, 4);
      tip.rotateY(Math.PI / 4);
      tip.translate(0, 13.6, 0);
      kit.add(tip, M.cream, at(F, 0, 0, 0));
      collision.addCircle(o.cx, o.cz, 2.2, 'building');
    } else if (kind === 'fountain') {
      const rim = new THREE.CylinderGeometry(5, 5.2, 0.7, 32, 1, true);
      rim.translate(0, 0.35, 0);
      kit.add(rim, M.stone, at(F, 0, 0, 0));
      kit.add(new THREE.TorusGeometry(5.05, 0.18, 6, 32).rotateX(Math.PI / 2), M.stone, at(F, 0, 0.7, 0));
      kit.add(new THREE.CircleGeometry(5, 32).rotateX(-Math.PI / 2), M.water, at(F, 0, 0.55, 0));
      kit.add(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 12).translate(0, 1.1, 0), M.stone, at(F, 0, 0, 0));
      kit.add(new THREE.CylinderGeometry(1.8, 0.6, 0.5, 20).translate(0, 2.3, 0), M.stone, at(F, 0, 0, 0));
      kit.add(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 10).translate(0, 3, 0), M.stone, at(F, 0, 0, 0));
      kit.add(new THREE.SphereGeometry(0.45, 12, 8).translate(0, 3.8, 0), M.stone, at(F, 0, 0, 0));
      collision.addCircle(o.cx, o.cz, 5.3, 'building');
    } else {
      kit.add(boxAt(1.2, 2, 1.2), M.stone, at(F, 0, 0, 0));
      kit.add(boxAt(0.8, 0.5, 0.4), M.bronze, at(F, 0, 2, 0));
      kit.add(boxAt(0.36, 0.45, 0.36), M.bronze, at(F, 0, 2.5, 0));
      collision.addCircle(o.cx, o.cz, 0.9, 'building');
    }
  }

  kit.build(root);
  flats.build(root, { cast: false, order: -5.5 });

  return {
    keepOut,
    setNight(n) {
      for (const [m, k] of glow) m.emissiveIntensity = n * k;
    },
  };
}

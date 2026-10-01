// Buenos Aires-style street corner signs: a dark green post with one blue plate
// per street (name + block "altura"), each plate parallel to its street.
// Posts get collision everywhere, but meshes are built lazily per chunk around
// the player: one merged mesh + one canvas atlas per chunk (1 draw call each).
import * as THREE from 'three';
import { computeStreetSigns } from './alturas.js';

const CHUNK = 160;
const LOAD_R = 300; // build chunks whose center is closer than this
const UNLOAD_R = 420;
const PLATE_W = 1.1, PLATE_H = 0.3, PLATE_T = 0.03, GAP = 0.04;
const TOP_Y = 2.45; // center of the upper plate
const POLE_R = 0.04;
const CELL_W = 512, CELL_H = 140, COLS = 2, SWATCH = 16;
const POLE_COLOR = '#1f3a2a';
const PLATE_BG = '#133b82';

export function buildStreetSigns(data, { root, collision }) {
  let posts = data.streetSigns;
  if (!posts) {
    // procedural map or an older data file: compute them here
    posts = computeStreetSigns(data.roads, data.addresses || [], { blocked: (x, z) => collision.isBlocked(x, z, 0.5) }).posts;
  }
  const chunks = new Map();
  for (const p of posts) {
    if (!p.signs?.length || collision.isBlocked(p.x, p.z, 0.25)) continue;
    collision.addCircle(p.x, p.z, POLE_R + 0.06, 'pole');
    const key = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, { key, cx: (Math.floor(p.x / CHUNK) + 0.5) * CHUNK, cz: (Math.floor(p.z / CHUNK) + 0.5) * CHUNK, posts: [], mesh: null });
    chunks.get(key).posts.push(p);
  }
  const group = new THREE.Group();
  group.name = 'streetSigns';
  root.add(group);
  let night = 0;
  const loaded = new Set();

  function load(c) {
    const plates = c.posts.reduce((s, p) => s + p.signs.length, 0);
    const rows = Math.ceil(plates / COLS);
    const scale = Math.min(1, 4000 / (rows * CELL_H + SWATCH));
    const cw = Math.round(CELL_W * scale), ch = Math.round(CELL_H * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw * COLS;
    canvas.height = SWATCH + rows * ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = POLE_COLOR;
    ctx.fillRect(0, 0, canvas.width, SWATCH);
    const W = canvas.width, H = canvas.height;
    const poleUV = [0.5, 1 - SWATCH / 2 / H];

    const pos = [], nor = [], uv = [];
    const quad = (a, b, c2, d, n, ua, ub, uc, ud) => {
      for (const [p, u] of [[a, ua], [b, ub], [c2, uc], [a, ua], [c2, uc], [d, ud]]) {
        pos.push(p[0], p[1], p[2]);
        nor.push(n[0], n[1], n[2]);
        uv.push(u[0], u[1]);
      }
    };
    // Axis-aligned-in-local-frame box: center, half sizes along (ex, up, en).
    const box = (cx, cy, cz, ex, en, hx, hy, hz, faceUV) => {
      const P = (sx, sy, sz) => [cx + ex[0] * hx * sx + en[0] * hz * sz, cy + hy * sy, cz + ex[1] * hx * sx + en[1] * hz * sz];
      const faces = [
        [[1, 0, 0], (s, t) => P(1, t, -s)],
        [[-1, 0, 0], (s, t) => P(-1, t, s)],
        [[0, 0, 1], (s, t) => P(s, t, 1)],
        [[0, 0, -1], (s, t) => P(-s, t, -1)],
        [[0, 1, 0], (s, t) => P(s, 1, -t)],
        [[0, -1, 0], (s, t) => P(s, -1, t)],
      ];
      for (const [[lx, ly, lz], f] of faces) {
        const n = [ex[0] * lx + en[0] * lz, ly, ex[1] * lx + en[1] * lz];
        const u = faceUV?.(lx, ly, lz);
        quad(f(-1, -1), f(1, -1), f(1, 1), f(-1, 1), n, ...(u || [poleUV, poleUV, poleUV, poleUV]));
      }
    };

    let cell = 0;
    for (const p of c.posts) {
      const n = p.signs.length;
      const lowY = TOP_Y - (n - 1) * (PLATE_H + GAP);
      // post up to the lowest plate, short connectors in the gaps between plates
      const poleTop = lowY - PLATE_H / 2;
      box(p.x, poleTop / 2, p.z, [1, 0], [0, 1], POLE_R, poleTop / 2, POLE_R);
      for (let i = 0; i < n - 1; i++) {
        box(p.x, TOP_Y - i * (PLATE_H + GAP) - (PLATE_H + GAP) / 2, p.z, [1, 0], [0, 1], 0.025, GAP / 2 + 0.005, 0.025);
      }
      p.signs.forEach((s, i) => {
        const col = cell % COLS, row = Math.floor(cell / COLS);
        cell++;
        const x0 = col * cw, y0 = SWATCH + row * ch;
        drawPlate(ctx, x0, y0, cw, ch, s);
        const u0 = (x0 + 2) / W, u1 = (x0 + cw - 2) / W;
        const v1 = 1 - (y0 + 2) / H, v0 = 1 - (y0 + ch - 2) / H;
        let [dx, dz] = s.dir;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        // plate local x along the street, local z = normal (-dz, dx)
        const ex = [dx, dz], en = [-dz, dx];
        const y = TOP_Y - i * (PLATE_H + GAP);
        // both big faces list their corners left to right as seen from outside, so
        // the same UVs make the text readable from either sidewalk
        const face = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        box(p.x, y, p.z, ex, en, PLATE_W / 2, PLATE_H / 2, PLATE_T / 2, (lx, ly, lz) => (lz ? face : null));
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    // the atlas can be 16 MB of pixels: drop them once the GPU has the copy instead of
    // waiting for the garbage collector (flying over the city made dozens pile up)
    tex.onUpdate = () => {
      canvas.width = canvas.height = 1;
    };
    tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: night * 0.35, roughness: 0.55, metalness: 0.2 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    c.mesh = mesh;
    group.add(mesh);
    loaded.add(c);
  }

  function unload(c) {
    group.remove(c.mesh);
    c.mesh.geometry.dispose();
    c.mesh.material.map.dispose();
    c.mesh.material.dispose();
    c.mesh = null;
    loaded.delete(c);
  }

  return {
    posts: [...chunks.values()].flatMap((c) => c.posts),
    // Build the nearest missing chunk (at most one per call) and drop far ones.
    update(x, z, fast = false) {
      for (const c of loaded) if (Math.hypot(c.cx - x, c.cz - z) > UNLOAD_R) unload(c);
      const ix = Math.floor(x / CHUNK), iz = Math.floor(z / CHUNK);
      const r = Math.ceil(LOAD_R / CHUNK);
      let best = null, bestD = LOAD_R;
      for (let i = ix - r; i <= ix + r; i++) {
        for (let k = iz - r; k <= iz + r; k++) {
          const c = chunks.get(`${i},${k}`);
          if (!c || c.mesh) continue;
          const d = Math.hypot(c.cx - x, c.cz - z);
          if (d < bestD) (bestD = d), (best = c);
        }
      }
      if (best && !fast) load(best);
    },
    setNight(n) {
      night = n;
      for (const c of loaded) c.mesh.material.emissiveIntensity = n * 0.35;
    },
  };
}

function drawPlate(ctx, x, y, w, h, s) {
  const k = h / CELL_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4 * k;
  ctx.strokeRect(8 * k, 8 * k, w - 16 * k, h - 16 * k);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = s.name.toUpperCase();
  const num = s.from !== undefined;
  ctx.font = `bold ${Math.round((num ? 56 : 62) * k)}px "Arial Narrow", Arial, Helvetica, sans-serif`;
  ctx.fillText(name, w / 2, (num ? 52 : 72) * k, w - 44 * k);
  if (num) {
    ctx.fillRect(40 * k, 86 * k, w - 80 * k, 2 * k);
    ctx.font = `bold ${Math.round(40 * k)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(`${Math.min(s.from, s.to)} - ${Math.max(s.from, s.to)}`, w / 2, 113 * k, w - 60 * k);
  }
  ctx.restore();
}

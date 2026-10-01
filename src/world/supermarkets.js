// Big supermarkets and hipermercados (Carrefour, Coto, Jumbo, Vital, ...): the whole box
// clad in metal panels, the chain's colour band along the front, a huge lit name sign
// over the roof, a glass entrance with automatic doors under a big canopy, and rows of
// shopping carts. Chain colours are approximations; names are written, not logos.
import * as THREE from 'three';
import { polygonArea } from './geo.js';
import { GeoBuf, instancedChunks } from './builder.js';

const CHAINS = [
  [/carrefour/i, { name: 'Carrefour', band: '#1e4fa0', accent: '#e21b23', sign: '#ffffff', ink: '#1e4fa0' }],
  [/\bcoto\b/i, { name: 'COTO', band: '#d2232a', accent: '#ffffff', sign: '#d2232a', ink: '#ffffff' }],
  [/jumbo/i, { name: 'JUMBO', band: '#00a650', accent: '#ffffff', sign: '#00a650', ink: '#ffffff' }],
  [/\bd[ií]a\b/i, { name: 'Día', band: '#e2001a', accent: '#ffffff', sign: '#e2001a', ink: '#ffffff' }],
  [/chango ?m[aá]s/i, { name: 'ChangoMás', band: '#0b8a3a', accent: '#ffd200', sign: '#0b8a3a', ink: '#ffd200' }],
  [/vital/i, { name: 'VITAL', band: '#c62828', accent: '#ffd200', sign: '#c62828', ink: '#ffd200' }],
  [/\bvea\b/i, { name: 'VEA', band: '#e30613', accent: '#ffcc00', sign: '#e30613', ink: '#ffffff' }],
  [/disco\b/i, { name: 'DISCO', band: '#d71920', accent: '#ffffff', sign: '#d71920', ink: '#ffffff' }],
];
export function chainOf(name) {
  for (const [re, c] of CHAINS) if (re.test(name)) return c;
  return { name: name.toUpperCase(), band: '#00796b', accent: '#ffffff', sign: '#00796b', ink: '#ffffff' };
}

const WHITE = new THREE.Color(1, 1, 1);
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// placed: big-store shopfronts from shops.js ({ shop, chain, building, x, z, ux, uz, ox, oz, w, room })
export function buildBigStores(root, placed, { collision, nightMaterials }) {
  if (!placed.length) return { setNight() {} };
  // metal cladding (vertical ribs) for every wall of the box
  const clad = new GeoBuf();
  const cladTex = canvasTex(64, 64, (c) => {
    c.fillStyle = '#d9dcdf';
    c.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 8) {
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(x, 0, 2, 64);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x + 2, 0, 1, 64);
    }
  });
  cladTex.wrapS = cladTex.wrapT = THREE.RepeatWrapping;
  const bands = new Map(), glass = new GeoBuf(), signs = [];
  const canopy = [], columns = [], carts = [];
  const done = new Set();
  for (const p of placed) {
    const b = p.building, H = b.h;
    if (!done.has(b)) {
      done.add(b);
      const pts = polygonArea(b.pts) < 0 ? b.pts.slice().reverse() : b.pts;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 0.5) continue;
        const ox = (c[1] - a[1]) / len, oz = -(c[0] - a[0]) / len;
        const A = [a[0] + ox * 0.05, a[1] + oz * 0.05], C = [c[0] + ox * 0.05, c[1] + oz * 0.05];
        clad.quad([A[0], 0, A[1]], [C[0], 0, C[1]], [C[0], H + 0.6, C[1]], [A[0], H + 0.6, A[1]], [0, 0], [len / 3, 0], [len / 3, (H + 0.6) / 3], [0, (H + 0.6) / 3], WHITE, [ox, 0, oz]);
      }
    }
    const { x, z, ux, uz, ox, oz, w, chain } = p;
    const at = (along, out, y = 0) => [x + ux * along + ox * out, y, z + uz * along + oz * out];
    // colour band along the top of the front
    const key = chain.band;
    if (!bands.has(key)) bands.set(key, new GeoBuf());
    const band = bands.get(key);
    const quad = (buf, along0, along1, y0, y1, out, u1 = 1) => {
      const a = at(along0, out, y0), c = at(along1, out, y0), d = at(along1, out, y1), e = at(along0, out, y1);
      buf.quad(a, c, d, e, [0, 0], [u1, 0], [u1, 1], [0, 1], WHITE, [ox, 0, oz]);
    };
    // seen from outside the viewer's right is -u: run from +w/2 to -w/2
    quad(band, w / 2, -w / 2, H - 1.6, H + 0.6, 0.12);
    // glass entrance with automatic doors
    const gw = Math.min(10, w * 0.4);
    quad(glass, gw / 2, -gw / 2, 0, Math.min(3.6, H - 1.8), 0.1);
    // canopy over the entrance, in the chain colour, on two columns
    const cp = at(0, 2.2);
    canopy.push([cp[0], cp[2], Math.min(3.9, H - 1.7), Math.atan2(ox, oz), gw + 3, chain.band]);
    for (const s of [-1, 1]) {
      const c = at(s * (gw / 2 + 1), 4.1);
      columns.push([c[0], c[2], Math.atan2(ox, oz)]);
      collision.addCircle(c[0], c[2], 0.25, 'pole');
    }
    // the big name sign on the roof edge, lit at night
    signs.push({ p, at: at(0, 0.3, H + 0.6), w: Math.min(w * 0.55, 24), chain });
    // rows of shopping carts beside the entrance
    if (p.room > 3) {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const c = at(s * (gw / 2 + 2.5 + k * 0.55), 1.4);
          carts.push([c[0], c[2], Math.atan2(ux, uz) * s]);
        }
        const cc = at(s * (gw / 2 + 3.9), 1.4);
        collision.addCircle(cc[0], cc[2], 1.2, 'pole');
      }
    }
  }

  const cladMesh = new THREE.Mesh(clad.geometry(), new THREE.MeshStandardMaterial({ map: cladTex, roughness: 0.55, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -1 }));
  cladMesh.castShadow = cladMesh.receiveShadow = true;
  root.add(cladMesh);
  for (const [color, buf] of bands) {
    const m = new THREE.Mesh(buf.geometry(), new THREE.MeshStandardMaterial({ color, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
    root.add(m);
  }
  const glassTex = canvasTex(256, 96, (c, w, h) => {
    c.fillStyle = '#1d2a33';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 4; i++) c.fillRect(20 + i * 60, 0, 18, h);
    c.fillStyle = '#9aa3a8';
    for (let x = 0; x <= w; x += 64) c.fillRect(x, 0, 3, h);
    c.fillRect(0, 0, w, 4);
    c.fillStyle = '#fff';
    c.font = 'bold 12px Arial';
    c.textAlign = 'center';
    c.fillText('ENTRADA', w / 2, 16);
  });
  const glassMat = new THREE.MeshStandardMaterial({ map: glassTex, emissiveMap: glassTex, emissive: 0xfff2d0, emissiveIntensity: 0, roughness: 0.15, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -3 });
  nightMaterials.push(glassMat);
  root.add(new THREE.Mesh(glass.geometry(), glassMat));

  const q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  // canopy: one instanced box per chain colour
  const byColor = new Map();
  for (const c of canopy) (byColor.get(c[5]) || byColor.set(c[5], []).get(c[5])).push(c);
  for (const [color, items] of byColor) {
    instancedChunks(root, new THREE.BoxGeometry(1, 0.45, 4.6), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), items, (m, [x, z, y, yaw, w]) => {
      m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(yAxis, yaw), new THREE.Vector3(w, 1, 1));
    }, { cast: true });
  }
  instancedChunks(root, new THREE.CylinderGeometry(0.22, 0.22, 4, 10).translate(0, 2, 0), new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.6, roughness: 0.4 }), columns, (m, [x, z]) => m.makeTranslation(x, 0, z), { cast: true });
  // changuitos: wire basket on a frame with four wheels
  const cartG = cartGeometry();
  instancedChunks(root, cartG, new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.7, roughness: 0.35 }), carts, (m, [x, z, yaw]) => m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(yAxis, yaw), new THREE.Vector3(1, 1, 1)), { cast: true });

  // name signs: one canvas each (there are only a handful of big stores)
  const signMats = [];
  for (const s of signs) {
    const tex = canvasTex(1024, 192, (c, w, h) => {
      c.fillStyle = s.chain.sign;
      c.fillRect(0, 0, w, h);
      c.fillStyle = s.chain.accent;
      c.fillRect(0, h - 14, w, 14);
      const emblem = EMBLEMS[s.chain.name];
      c.fillStyle = s.chain.ink;
      c.font = 'bold 128px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (emblem) {
        emblem(c, 100, h / 2 - 6, 70);
        c.fillStyle = s.chain.ink;
        c.fillText(s.chain.name, w / 2 + 70, h / 2 - 4, w - 260);
      } else c.fillText(s.chain.name, w / 2, h / 2 - 4, w - 60);
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 });
    signMats.push(mat);
    const h = s.w / 5.3;
    const g = new THREE.BoxGeometry(s.w, h, 0.3);
    const m = new THREE.Mesh(g, mat);
    m.position.set(s.at[0], s.at[1] + h / 2, s.at[2]);
    m.rotation.y = Math.atan2(s.p.ox, s.p.oz);
    m.castShadow = true;
    root.add(m);
  }
  return {
    setNight(n) {
      for (const m of signMats) m.emissiveIntensity = n * 1.2;
    },
  };
}

// Emblems in the style of each chain, drawn at (x, y) with radius r.
const EMBLEMS = {
  Carrefour(c, x, y, r) {
    // the "C" between a red arrow (left) and a blue one (right)
    c.fillStyle = '#e21b23';
    c.beginPath(); c.moveTo(x - r * 0.15, y - r); c.lineTo(x - r, y); c.lineTo(x - r * 0.15, y + r); c.lineTo(x - r * 0.15, y + r * 0.45); c.lineTo(x - r * 0.45, y); c.lineTo(x - r * 0.15, y - r * 0.45); c.fill();
    c.fillStyle = '#1e4fa0';
    c.beginPath(); c.moveTo(x + r * 0.15, y - r); c.lineTo(x + r, y); c.lineTo(x + r * 0.15, y + r); c.lineTo(x + r * 0.15, y + r * 0.45); c.lineTo(x + r * 0.45, y); c.lineTo(x + r * 0.15, y - r * 0.45); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r * 0.42, Math.PI * 0.25, Math.PI * 1.75); c.lineTo(x + r * 0.15, y - r * 0.12); c.arc(x, y, r * 0.2, Math.PI * 1.75, Math.PI * 0.25, true); c.fill();
  },
  COTO(c, x, y, r) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d2232a';
    c.font = `bold ${r * 1.1}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('C', x, y + 3);
  },
  JUMBO(c, x, y, r) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#00a650';
    c.beginPath(); c.arc(x - r * 0.3, y, r * 0.35, 0, Math.PI * 2); c.arc(x + r * 0.3, y, r * 0.35, 0, Math.PI * 2); c.fill();
  },
  'Día'(c, x, y, r) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e2001a';
    c.font = `bold ${r}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('%', x, y + 2);
  },
  VITAL(c, x, y, r) {
    c.fillStyle = '#ffd200';
    c.beginPath(); c.moveTo(x - r, y - r * 0.7); c.lineTo(x, y + r * 0.8); c.lineTo(x + r, y - r * 0.7); c.lineTo(x + r * 0.5, y - r * 0.7); c.lineTo(x, y + r * 0.1); c.lineTo(x - r * 0.5, y - r * 0.7); c.fill();
  },
};

function cartGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  // basket: thin walls so it reads as wire mesh from the street
  box(0.5, 0.42, 0.02, 0, 0.78, -0.42); box(0.5, 0.42, 0.02, 0, 0.78, 0.42);
  box(0.02, 0.42, 0.86, -0.25, 0.78, 0); box(0.02, 0.42, 0.86, 0.25, 0.78, 0);
  box(0.5, 0.02, 0.86, 0, 0.58, 0);
  box(0.5, 0.03, 0.03, 0, 1.02, -0.5); // handle
  for (const [x, z] of [[-0.2, -0.35], [0.2, -0.35], [-0.2, 0.35], [0.2, 0.35]]) {
    box(0.02, 0.5, 0.02, x, 0.33, z);
    box(0.04, 0.1, 0.1, x, 0.05, z);
  }
  const pos = [], nor = [];
  for (const g of parts) {
    const ng = g.toNonIndexed();
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

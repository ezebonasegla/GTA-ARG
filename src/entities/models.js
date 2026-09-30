// Low-poly procedural models: cars, colectivos, taxis and patrulleros (people: person.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.1, metalness: 0.6 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.3, metalness: 0.9 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.3 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });

export { headMat as headlightMaterial };

export const VEHICLE_TYPES = {
  sedan: { length: 4.5, width: 1.8, height: 1.45, maxSpeed: 46, accel: 7.5, mass: 1.2, colors: [0xb8bcc0, 0x2a2d31, 0xe6e6e6, 0x7d1d1d, 0x1f3b66, 0x5b5f63, 0x9c8f7a, 0x3d5a3a] },
  hatch: { length: 3.9, width: 1.72, height: 1.5, maxSpeed: 40, accel: 7, mass: 1, colors: [0xd0d3d6, 0xa31c1c, 0x2e5c8a, 0xf0f0f0, 0x333333, 0xc9a227] },
  pickup: { length: 5.2, width: 1.9, height: 1.8, maxSpeed: 42, accel: 6.5, mass: 1.6, colors: [0xf0f0f0, 0x6b6e70, 0x1a1a1a, 0x7a5a36] },
  taxi: { length: 4.5, width: 1.8, height: 1.45, maxSpeed: 44, accel: 7.2, mass: 1.2, colors: [0x111111] },
  bus: { length: 11.5, width: 2.55, height: 3.1, maxSpeed: 26, accel: 3.2, mass: 5, colors: [0xd1302f, 0x2b62b0, 0xf2b705, 0x2f8f4e, 0xe36b1e] },
  police: { length: 4.6, width: 1.82, height: 1.5, maxSpeed: 52, accel: 8.8, mass: 1.3, colors: [0xf4f4f4] },
};

export function createVehicleMesh(type, color) {
  const spec = VEHICLE_TYPES[type];
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
  const L = spec.length, W = spec.width, H = spec.height;
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };

  if (type === 'bus') {
    add(new THREE.BoxGeometry(W, H - 0.5, L), paint, 0, 0.35 + (H - 0.5) / 2, 0);
    // white upper band + windows
    const band = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    add(new THREE.BoxGeometry(W + 0.02, 0.35, L - 0.2), band, 0, H - 0.55, 0);
    add(new THREE.BoxGeometry(W + 0.04, 1.0, L - 2.2), glassMat, 0, 1.95, -0.4);
    add(new THREE.BoxGeometry(W - 0.2, 1.3, 0.05), glassMat, 0, 1.9, L / 2 + 0.01);
    // route sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.35), makeSignMaterial(String([85, 98, 148, 159, 257, 278, 324, 582][Math.floor(Math.random() * 8)])));
    sign.position.set(0, H - 0.3, L / 2 + 0.03);
    g.add(sign);
    for (const z of [L / 2 - 2.2, -L / 2 + 2.6]) for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) addWheel(g, x, z, 0.5);
  } else {
    const bodyH = type === 'pickup' ? 0.75 : 0.62;
    add(new THREE.BoxGeometry(W, bodyH, L), paint, 0, 0.35 + bodyH / 2, 0);
    const cabinL = type === 'pickup' ? L * 0.38 : type === 'hatch' ? L * 0.55 : L * 0.48;
    const cabinZ = type === 'pickup' ? L * 0.08 : type === 'hatch' ? -L * 0.08 : -L * 0.04;
    const cabinH = H - 0.35 - bodyH;
    const cabinTop = type === 'taxi' ? new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.4, metalness: 0.3 }) : paint;
    add(new THREE.BoxGeometry(W * 0.86, cabinH, cabinL), glassMat, 0, 0.35 + bodyH + cabinH / 2, cabinZ);
    add(new THREE.BoxGeometry(W * 0.87, 0.08, cabinL * 0.92), cabinTop, 0, 0.35 + bodyH + cabinH, cabinZ);
    if (type === 'pickup') {
      const bedMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      add(new THREE.BoxGeometry(W * 0.9, 0.05, L * 0.36), bedMat, 0, 0.35 + bodyH + 0.01, -L * 0.28);
    }
    if (type === 'police') {
      const blue = new THREE.MeshStandardMaterial({ color: 0x12408c, roughness: 0.4 });
      add(new THREE.BoxGeometry(W + 0.02, 0.22, L * 0.7), blue, 0, 0.35 + bodyH * 0.55, 0);
      const bar = new THREE.Group();
      const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0 });
      const blu = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1040ff, emissiveIntensity: 0 });
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.26), red);
      r.position.x = -0.32;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.26), blu);
      b.position.x = 0.32;
      bar.add(r, b);
      bar.position.set(0, 0.35 + bodyH + cabinH + 0.1, cabinZ);
      g.add(bar);
      g.userData.siren = { red, blu };
    }
    if (type === 'taxi') {
      const roofSign = add(new THREE.BoxGeometry(0.8, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd24a, emissiveIntensity: 0.4 }), 0, 0.35 + bodyH + cabinH + 0.15, cabinZ);
      roofSign.castShadow = false;
    }
    // lights
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
      add(new THREE.BoxGeometry(0.35, 0.14, 0.05), headMat, x, 0.35 + bodyH * 0.7, L / 2 + 0.01);
    }
    const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.25 });
    for (const x of [-W / 2 + 0.25, W / 2 - 0.25]) add(new THREE.BoxGeometry(0.3, 0.14, 0.05), tail, x, 0.35 + bodyH * 0.7, -L / 2 - 0.01);
    g.userData.tail = tail;
    add(new THREE.BoxGeometry(W * 0.9, 0.12, 0.1), chromeMat, 0, 0.42, L / 2 + 0.03);
    add(new THREE.BoxGeometry(W * 0.9, 0.12, 0.1), chromeMat, 0, 0.42, -L / 2 - 0.03);
    add(new THREE.BoxGeometry(0.5, 0.13, 0.02), plateMat, 0, 0.55, -L / 2 - 0.06);
    const wb = L * 0.32;
    for (const z of [wb, -wb]) for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) addWheel(g, x, z, 0.34);
  }
  g.userData.spec = spec;
  compact(g);
  return g;
}

// Merge static parts that share a material into a single mesh (fewer draw calls).
function compact(g) {
  const keep = new Set(g.userData.wheels || []);
  const byMat = new Map();
  for (const child of [...g.children]) {
    if (!child.isMesh || keep.has(child)) continue;
    child.updateMatrix();
    const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(child.matrix);
    if (!byMat.has(child.material)) byMat.set(child.material, []);
    byMat.get(child.material).push(geo);
    g.remove(child);
  }
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.castShadow = true;
    g.add(mesh);
  }
}

function addWheel(g, x, z, r) {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.scale.setScalar(r / 0.34);
  w.position.set(x, r, z);
  w.castShadow = true;
  g.add(w);
  (g.userData.wheels ||= []).push(w);
  return w;
}

function makeSignMaterial(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 56;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 256, 56);
  ctx.fillStyle = '#ffb000';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${text}  QUILMES`, 128, 30, 240);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6 });
}

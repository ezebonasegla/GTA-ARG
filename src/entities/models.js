// Vehicles: CC0 models (Kenney Car Kit, Quaternius colectivo; see public/models/*/LICENSE.txt)
// loaded once by loadVehicleModels(), with the low-poly procedural ones as fallback.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.1, metalness: 0.6 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.3, metalness: 0.9 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.3 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });

export { headMat as headlightMaterial };

// Resources shared between vehicles (templates, module materials, paint caches) are
// tagged `keep`; everything else in a vehicle is its own and is freed with it, or every
// car that drives out of range leaves its buffers and textures on the GPU.
function keep(o) {
  if (!o) return;
  if (o.isObject3D) return o.traverse((c) => { keep(c.geometry); [].concat(c.material || []).forEach(keep); });
  o.userData.keep = true;
  if (o.isMaterial) for (const v of Object.values(o)) if (v?.isTexture) v.userData.keep = true;
}
[wheelGeo, wheelMat, glassMat, chromeMat, headMat, plateMat].forEach(keep);
export function disposeVehicleMesh(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) {
      if (m.userData.keep) continue;
      for (const v of Object.values(m)) if (v?.isTexture && !v.userData.keep) v.dispose();
      m.dispose();
    }
  });
}

export const VEHICLE_TYPES = {
  sedan: { length: 4.5, width: 1.8, height: 1.45, maxSpeed: 46, accel: 7.5, mass: 1.2, colors: [0xb8bcc0, 0x2a2d31, 0xe6e6e6, 0x7d1d1d, 0x1f3b66, 0x5b5f63, 0x9c8f7a, 0x3d5a3a] },
  hatch: { length: 3.9, width: 1.72, height: 1.5, maxSpeed: 40, accel: 7, mass: 1, colors: [0xd0d3d6, 0xa31c1c, 0x2e5c8a, 0xf0f0f0, 0x333333, 0xc9a227] },
  pickup: { length: 5.2, width: 1.9, height: 1.8, maxSpeed: 42, accel: 6.5, mass: 1.6, colors: [0xf0f0f0, 0x6b6e70, 0x1a1a1a, 0x7a5a36] },
  taxi: { length: 4.5, width: 1.8, height: 1.45, maxSpeed: 44, accel: 7.2, mass: 1.2, colors: [0x111111] },
  bus: { length: 11.5, width: 2.55, height: 3.1, maxSpeed: 26, accel: 3.2, mass: 5, colors: [0xd1302f, 0x2b62b0, 0xf2b705, 0x2f8f4e, 0xe36b1e] },
  police: { length: 4.6, width: 1.82, height: 1.5, maxSpeed: 52, accel: 8.8, mass: 1.3, colors: [0xf4f4f4] },
};

const CAR_FILES = { pickup: 'truck' }; // Kenney, until there is a replica
// Real-car replicas (CC-BY, credits in public/models/cars/CREDITS.md), prepared with
// scripts/prep_car.py: real size, body + 4 wheels, paint material named "paint".
const REAL_CARS = [
  { file: 'fiat-uno', types: ['hatch', 'sedan', 'taxi'] },
  { file: 'peugeot-208', types: ['hatch'] },
  { file: 'peugeot-206', types: ['hatch', 'sedan'] },
  { file: 'peugeot-308', types: ['sedan', 'police'] },
];
const templates = {};
const real = [];

export async function loadVehicleModels(base) {
  const gltf = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(`${base}draco/`));
  const jobs = Object.entries(CAR_FILES).map(([type, file]) =>
    gltf.loadAsync(`${base}models/cars/${file}.glb`).then(({ scene }) => { templates[type] = prepCar(scene); }));
  for (const car of REAL_CARS) {
    jobs.push(gltf.loadAsync(`${base}models/cars/${car.file}.glb`).then(({ scene }) => {
      compactCar(scene);
      real.push({ ...car, scene, size: new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()), paints: new Map() });
    }));
  }
  jobs.push(new OBJLoader().loadAsync(`${base}models/bus/Bus.obj`).then((o) => { templates.bus = prepBus(o); }));
  const res = await Promise.allSettled(jobs);
  for (const t of Object.values(templates)) {
    keep(t.scene);
    keep(t.material);
    if (t.body) [t.body, ...t.axles].forEach((a) => keep(a.geometry));
  }
  for (const c of real) keep(c.scene);
  Object.values(BUS_FIXED).forEach(keep);
  for (const r of res) if (r.status === 'rejected') console.warn('vehicle model missing, using procedural:', r.reason);
}

// Kenney cars share one 8x4 swatch atlas; the paint is the body's most used swatch
// that isn't tyre/trim grey. Recoloring = repainting that swatch in a copy of the atlas.
const TRIM = new Set(['3,2', '2,2', '0,3']);
function prepCar(scene) {
  const body = scene.getObjectByName('body');
  const area = new Map();
  body.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, uv = g.attributes.uv, pos = g.attributes.position, idx = g.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < idx.count; t += 3) {
      const [i, j, k] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      const key = `${Math.floor(((uv.getX(i) + uv.getX(j) + uv.getX(k)) / 3) * 8)},${Math.floor(((uv.getY(i) + uv.getY(j) + uv.getY(k)) / 3) * 4)}`;
      if (TRIM.has(key)) continue;
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, j).sub(a);
      c.fromBufferAttribute(pos, k).sub(a);
      area.set(key, (area.get(key) || 0) + b.cross(c).length());
    }
  });
  const cell = [...area].sort((x, y) => y[1] - x[1])[0][0].split(',').map(Number);
  let material;
  scene.traverse((o) => { if (o.isMesh) material = o.material; });
  return { scene, cell, material, size: new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()), variants: new Map() };
}

function paintMaterial(t, color) {
  const key = t.cell.join() + color;
  if (t.variants.has(key)) return t.variants.get(key);
  const img = t.material.map.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const w = img.width / 8, h = img.height / 4, x0 = t.cell[0] * w, y0 = t.cell[1] * h;
  const px = ctx.getImageData(x0, y0, w, h);
  const d = px.data;
  let mean = 0;
  for (let i = 0; i < d.length; i += 4) mean += d[i] + d[i + 1] + d[i + 2];
  mean /= d.length * 0.75;
  const target = new THREE.Color(color);
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] + d[i + 1] + d[i + 2]) / 3 / mean; // keep the swatch's shading gradient
    d[i] = Math.min(255, target.r * 255 * k);
    d[i + 1] = Math.min(255, target.g * 255 * k);
    d[i + 2] = Math.min(255, target.b * 255 * k);
  }
  ctx.putImageData(px, x0, y0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = t.material.map.flipY;
  map.magFilter = map.minFilter = THREE.NearestFilter;
  const m = t.material.clone();
  m.map = map;
  keep(m);
  t.variants.set(key, m);
  return m;
}

function carFromTemplate(type, color, spec) {
  const t = templates[type];
  const g = new THREE.Group();
  const model = t.scene.clone(true);
  const s = spec.length / t.size.z;
  model.scale.setScalar(s);
  const mat = type === 'police' ? t.material : paintMaterial(t, color);
  const wheels = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = mat;
      o.castShadow = true;
    }
  });
  for (const w of [...model.children]) {
    if (!/^wheel-(front|back)-(left|right)$/.test(w.name)) continue;
    // spin/steer a pivot so the wheel keeps its own mirrored orientation
    const pivot = new THREE.Group();
    pivot.position.copy(w.position);
    w.position.set(0, 0, 0);
    model.add(pivot);
    pivot.add(w);
    wheels.push(pivot);
  }
  wheels.sort((a, b) => b.position.z - a.position.z); // front pair first (it steers)
  g.add(model);
  const L = spec.length, W = t.size.x * s, y = t.size.y * s * 0.45;
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), headMat);
    head.position.set(x, y, L / 2 - 0.02);
    g.add(head);
  }
  const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.25 });
  for (const x of [-W / 2 + 0.25, W / 2 - 0.25]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.04), tail);
    m.position.set(x, y, -L / 2 + 0.02);
    g.add(m);
  }
  g.userData.tail = tail;
  if (type === 'police') {
    const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0 });
    const blu = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1040ff, emissiveIntensity: 0 });
    const bar = new THREE.Group();
    for (const [mtl, x] of [[red, -0.3], [blu, 0.3]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), mtl);
      m.position.x = x;
      bar.add(m);
    }
    bar.position.set(0, t.size.y * s + 0.04, -0.1);
    g.add(bar);
    g.userData.siren = { red, blu };
  }
  g.userData.wheels = wheels;
  g.userData.spec = spec;
  return g;
}

// Quaternius bus: one body mesh with per-part materials (Top, Bottom, Windows, Lights,
// Bumper, Details, Material = wheels) plus two axle meshes. Stretched to a real
// colectivo's size; axles keep round wheels (radial scale = height scale).
function prepBus(obj) {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  const spec = VEHICLE_TYPES.bus;
  const sx = spec.length / size.x, sy = spec.height / size.y, sz = spec.width / size.z;
  const xc = (box.min.x + box.max.x) / 2, y0 = box.min.y;
  const map = (x, y, z) => new THREE.Vector3(z * sz, (y - y0) * sy, -(x - xc) * sx); // rotate so front (-x) -> +z
  const parts = { axles: [] };
  for (const mesh of obj.children) {
    const g = mesh.geometry.clone();
    const p = g.attributes.position;
    if (/Wheels/.test(mesh.name)) {
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new THREE.Vector3());
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3((p.getZ(i) - c.z) * sz, (p.getY(i) - c.y) * sy, -(p.getX(i) - c.x) * sy);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      parts.axles.push({ geometry: g, center: map(c.x, c.y, c.z) });
    } else {
      for (let i = 0; i < p.count; i++) {
        const v = map(p.getX(i), p.getY(i), p.getZ(i));
        p.setXYZ(i, v.x, v.y, v.z);
      }
      parts.body = { geometry: g, materials: [].concat(mesh.material).map((m) => m.name) };
    }
    g.computeVertexNormals();
  }
  parts.axles.sort((a, b) => b.center.z - a.center.z);
  return parts;
}

// the OBJ mixes face windings, so bus materials are double sided
const busMat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide, ...extra });
const BUS_FIXED = {
  Windows: busMat(0x1d2a33, { roughness: 0.1, metalness: 0.6 }),
  Lights: headMat,
  Bumper: busMat(0x2b2d30, { roughness: 0.7 }),
  Material: wheelMat,
};
function busFromTemplate(livery, spec) {
  const t = templates.bus;
  const [top, bottom, detail] = typeof livery === 'object' ? livery : [0xf2f2f2, livery, 0x222222];
  const paint = { Top: busMat(top), Bottom: busMat(bottom), Details: busMat(detail) };
  const g = new THREE.Group();
  const body = new THREE.Mesh(t.body.geometry, t.body.materials.map((n) => BUS_FIXED[n] || paint[n] || paint.Bottom));
  body.castShadow = true;
  g.add(body);
  g.userData.wheels = t.axles.map((a) => {
    const pivot = new THREE.Group();
    pivot.position.copy(a.center);
    const m = new THREE.Mesh(a.geometry, wheelMat);
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  });
  g.userData.steer = 1; // only the front axle turns
  g.userData.spec = spec;
  return g;
}

// Replicas come with dozens of meshes and materials (the 206 has 47): every one is a
// draw call per car, per frame, plus its shadow. Merge them: plain-coloured materials
// become vertex colours of one mesh; the paint, glass, lights and textured parts keep
// their own material; each wheel becomes a single mesh.
const plainCarMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.4 });
function compactCar(scene) {
  scene.updateMatrixWorld(true);
  let glass = null;
  const keyOf = (m) => {
    if (/^paint/.test(m.name)) return m;
    if (m.transparent || m.opacity < 1) return (glass ||= m); // one glass for every window
    if (m.map || m.alphaMap) return m;
    return plainCarMat; // plain colours, lights included (as their colour)
  };
  const bake = (meshes, into) => {
    const inv = new THREE.Matrix4().copy(into.matrixWorld).invert();
    const groups = new Map();
    for (const mesh of meshes) {
      for (const [i, mat] of [].concat(mesh.material).entries()) {
        const key = keyOf(mat);
        let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        if (Array.isArray(mesh.material)) {
          const grp = mesh.geometry.groups[i];
          if (!grp) continue;
          g = g.clone();
          const take = (a) => new THREE.BufferAttribute(a.array.slice(grp.start * a.itemSize, (grp.start + grp.count) * a.itemSize), a.itemSize, a.normalized);
          for (const k of Object.keys(g.attributes)) g.setAttribute(k, take(g.attributes[k]));
        }
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
        const keep = key === plainCarMat ? ['position', 'normal'] : ['position', 'normal', 'uv'];
        for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
        if (key !== plainCarMat && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (key === plainCarMat) {
          const n = g.attributes.position.count, col = new Float32Array(n * 3);
          const c = mat.emissive && mat.emissive.getHex() && mat.emissiveIntensity > 0 ? mat.emissive : mat.color || new THREE.Color(1, 1, 1);
          for (let v = 0; v < n; v++) col.set([c.r, c.g, c.b], v * 3);
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(g);
      }
      mesh.parent.remove(mesh);
    }
    for (const [mat, geos] of groups) {
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true;
      into.add(m);
    }
  };
  const wheels = [];
  scene.traverse((o) => { if (/^wheel-(front|back)-(left|right)$/.test(o.name)) wheels.push(o); });
  for (const w of wheels) {
    // a wheel that is itself one mesh stays as it is; merge only meshes inside it
    const ms = [];
    w.traverse((o) => { if (o.isMesh && o !== w) ms.push(o); });
    if (ms.length > 1) bake(ms, w);
  }
  const body = [];
  scene.traverse((o) => { if (o.isMesh && !wheels.some((w) => w === o || isChild(o, w))) body.push(o); });
  bake(body, scene);
}
const isChild = (o, p) => { for (let q = o.parent; q; q = q.parent) if (q === p) return true; return false; };

// Paint = the model's "paint" material in the requested color. A painted texture is
// turned to grey first (keeping its shading and details) so the color tints it.
const greyMaps = new Map();
function repaint(car, mat, color) {
  const key = `${mat.uuid}:${color}`;
  if (car.paints.has(key)) return car.paints.get(key);
  const m = mat.clone();
  m.color = new THREE.Color(color);
  if (mat.map) {
    if (!greyMaps.has(mat.map)) {
      const img = mat.map.image;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height), d = px.data;
      let mean = 0;
      for (let i = 0; i < d.length; i += 4) mean += (d[i] + d[i + 1] + d[i + 2]) / 3;
      mean /= d.length / 4;
      for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = Math.min(255, ((d[i] + d[i + 1] + d[i + 2]) / 3 / mean) * 235);
      ctx.putImageData(px, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = mat.map.flipY;
      greyMaps.set(mat.map, t);
    }
    m.map = greyMaps.get(mat.map);
  }
  keep(m);
  car.paints.set(key, m);
  return m;
}

function realCar(type, color, spec) {
  const options = real.filter((c) => c.types.includes(type));
  const car = options[Math.floor(Math.random() * options.length)];
  const g = new THREE.Group();
  const model = car.scene.clone(true);
  const wheels = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (/^paint/.test(o.material.name)) o.material = repaint(car, o.material, type === 'taxi' ? 0x111111 : color);
    }
    if (/^wheel-(front|back)-(left|right)$/.test(o.name)) wheels.push(o);
  });
  wheels.sort((a, b) => b.position.z - a.position.z); // front pair first (it steers)
  g.add(model);
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.28), new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0xffc000, emissiveIntensity: 0.4 }));
    sign.position.set(0, car.size.y + 0.1, -0.2);
    g.add(sign);
  }
  if (type === 'police') {
    const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0 });
    const blu = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1040ff, emissiveIntensity: 0 });
    const bar = new THREE.Group();
    for (const [mtl, x] of [[red, -0.3], [blu, 0.3]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), mtl);
      m.position.x = x;
      bar.add(m);
    }
    bar.position.set(0, car.size.y + 0.02, -0.2);
    g.add(bar);
    g.userData.siren = { red, blu };
  }
  g.userData.wheels = wheels;
  // physics uses the replica's real footprint (mirrors excluded)
  g.userData.spec = { ...spec, length: car.size.z, width: car.size.x * 0.9, height: car.size.y };
  return g;
}

export function createVehicleMesh(type, color) {
  const spec = VEHICLE_TYPES[type];
  if (real.some((c) => c.types.includes(type))) return realCar(type, type === 'police' ? 0xf4f4f4 : color, spec);
  if (type === 'bus' && templates.bus) return busFromTemplate(color, spec);
  if (templates[type] && type !== 'bus') return carFromTemplate(type, color, spec);
  if (typeof color === 'object') color = color[1];
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

// Geometry accumulators used to merge the city into a few meshes per chunk.
import * as THREE from 'three';

// Growable typed array: the city has millions of vertices, and plain JS number arrays
// (8 bytes per value, plus a full copy when the geometry is made) blew past what a
// phone allows. Normals and colors are stored as normalized bytes.
class List {
  constructor(Type, n = 768) {
    this.Type = Type;
    this.a = new Type(n);
    this.length = 0;
  }
  grow(k) {
    if (this.length + k <= this.a.length) return;
    const b = new this.Type(Math.max(this.a.length * 2, this.length + k));
    b.set(this.a);
    this.a = b;
  }
  push(x, y, z) {
    this.grow(3);
    const a = this.a;
    a[this.length++] = x;
    if (y !== undefined) a[this.length++] = y;
    if (z !== undefined) a[this.length++] = z;
  }
  // the filled part, as a view (no copy: copying every buffer doubled the peak memory)
  take() {
    const out = this.a.subarray(0, this.length);
    this.a = new this.Type(0);
    this.length = 0;
    return out;
  }
}
const n8 = (v) => Math.max(-127, Math.min(127, Math.round(v * 127)));
const c8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
// Drop the CPU copy once the GPU has it (nothing reads these meshes back).
export function freeAfterUpload(g) {
  for (const a of Object.values(g.attributes)) a.onUpload(function () { this.array = null; });
  return g;
}

// Triangle soup with normals, uvs, vertex colors and (optionally) a texture-array layer.
export class GeoBuf {
  constructor(layered = false) {
    this.layered = layered;
    this.pos = new List(Float32Array);
    this.nor = new List(Int8Array);
    this.uv = new List(Float32Array);
    this.col = new List(Uint8Array);
    this.lay = new List(Uint8Array);
  }
  tri(a, b, c, ua, ub, uc, color, want, layer = 0) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    if (want && nx * want[0] + ny * want[1] + nz * want[2] < 0) {
      [b, c] = [c, b];
      [ub, uc] = [uc, ub];
      nx = -nx; ny = -ny; nz = -nz;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    nx = n8(nx / l); ny = n8(ny / l); nz = n8(nz / l);
    const r = c8(color.r), g = c8(color.g), bl = c8(color.b);
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(u[0], u[1]);
      this.col.push(r, g, bl);
      if (this.layered) this.lay.push(layer);
    }
  }
  quad(a, b, c, d, ua, ub, uc, ud, color, want, layer = 0) {
    this.tri(a, b, c, ua, ub, uc, color, want, layer);
    this.tri(a, c, d, ua, uc, ud, color, want, layer);
  }
  // Vertical wall from p0 to p1 (xz) between heights y0 and y1; u runs along the
  // wall every `tu` meters, v = y / tv (+ v0).
  wall(p0, p1, y0, y1, u0, tu, tv, color, layer, v0 = y0 / tv, out = null) {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const u1 = u0 - len / tu;
    const va = v0, vb = v0 + (y1 - y0) / tv;
    const n = out || [p1[1] - p0[1], 0, -(p1[0] - p0[0])];
    this.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], [u0, va], [u1, va], [u1, vb], [u0, vb], color, n, layer);
    return u1;
  }
  get empty() {
    return this.pos.length === 0;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.take(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.take(), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.take(), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.take(), 3, true));
    if (this.layered) g.setAttribute('layer', new THREE.BufferAttribute(this.lay.take(), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Untextured props (vertex colors) baked from template geometries.
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
export class PropBuf {
  constructor() {
    this.pos = new List(Float32Array);
    this.nor = new List(Int8Array);
    this.col = new List(Uint8Array);
  }
  add(template, matrix, color, shade = 0) {
    const p = template.attributes.position.array, n = template.attributes.normal.array;
    _nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.length; i += 3) {
      _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(matrix);
      _n.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_nm).normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(n8(_n.x), n8(_n.y), n8(_n.z));
      const k = shade ? 1 - shade * ((i * 7919) % 13) / 13 : 1;
      this.col.push(c8(color.r * k), c8(color.g * k), c8(color.b * k));
    }
  }
  get empty() {
    return this.pos.length === 0;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.take(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.take(), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.take(), 3, true));
    g.computeBoundingSphere();
    return g;
  }
}

// Non-indexed template geometry (position + normal only).
export function template(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}

// Per-chunk accumulators: facade (texture array), props, alpha cut-outs and cables.
export class ChunkSet {
  constructor(size) {
    this.size = size;
    this.map = new Map();
    this.detail = []; // small stuff hidden beyond `range` meters
  }
  at(x, z) {
    const key = `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
    let c = this.map.get(key);
    if (!c) this.map.set(key, (c = { facade: new GeoBuf(true), props: new PropBuf(), alpha: new GeoBuf(), lines: [] }));
    return c;
  }
  build(root, mats) {
    for (const [key, c] of this.map) {
      const [ix, iz] = key.split(',').map(Number);
      const cx = (ix + 0.5) * this.size, cz = (iz + 0.5) * this.size;
      const detail = (mesh, range) => this.detail.push({ mesh, cx, cz, range: range + this.size * 0.7 });
      if (!c.facade.empty) {
        const m = new THREE.Mesh(freeAfterUpload(c.facade.geometry()), mats.facade);
        m.castShadow = m.receiveShadow = true;
        root.add(m);
      }
      if (!c.props.empty) {
        const m = new THREE.Mesh(freeAfterUpload(c.props.geometry()), mats.props);
        m.castShadow = m.receiveShadow = true;
        root.add(m);
        detail(m, 420);
      }
      if (!c.alpha.empty) {
        const m = new THREE.Mesh(freeAfterUpload(c.alpha.geometry()), mats.alpha);
        m.receiveShadow = true;
        root.add(m);
        detail(m, 320);
      }
      if (c.lines.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(c.lines, 3));
        c.lines = null;
        g.computeBoundingSphere();
        freeAfterUpload(g);
        const l = new THREE.LineSegments(g, mats.cables);
        root.add(l);
        detail(l, 350);
      }
      this.map.delete(key); // let this chunk's buffers go before the next one
    }
  }
  // Show the small details only around the camera.
  updateDetail(p) {
    for (const d of this.detail) d.mesh.visible = (d.cx - p.x) ** 2 + (d.cz - p.z) ** 2 < d.range * d.range;
  }
}

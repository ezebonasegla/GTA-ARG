// Geometry accumulators used to merge the city into a few meshes per chunk.
import * as THREE from 'three';

// Growable typed array: the city has millions of vertices, and plain JS number arrays
// (8 bytes per value, plus a full copy when the geometry is made) blew past what a
// phone allows. Normals and colors are stored as normalized bytes, in groups of 4:
// Direct3D (Chrome / Edge on Windows) has no 3-byte vertex formats, and converting
// them on every upload of a streamed chunk ate the GPU process's memory.
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
  // the filled part: a view when the buffer is nearly full, else a trimmed copy so the
  // doubling slack (up to half the buffer) doesn't stay alive with the mesh
  take() {
    const out = this.length > this.a.length * 0.8 ? this.a.subarray(0, this.length) : this.a.slice(0, this.length);
    this.a = new this.Type(0);
    this.length = 0;
    return out;
  }
}
const QUAD = [0, 1, 2, 0, 2, 3], QUAD_FLIP = [0, 2, 1, 0, 3, 2];
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
    this.lay = new List(Float32Array);
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
      this.nor.push(0);
      this.uv.push(u[0], u[1]);
      this.col.push(r, g, bl);
      this.col.push(255);
      if (this.layered) this.lay.push(layer);
    }
  }
  // Allocation-free quad for bulk relief geometry: corners in v[0..11] (a, b, c, d as
  // x,y,z), facing (wx, wy, wz); no uv, no layer.
  quadRaw(v, color, wx, wy, wz) {
    const e1x = v[3] - v[0], e1y = v[4] - v[1], e1z = v[5] - v[2];
    const e2x = v[6] - v[0], e2y = v[7] - v[1], e2z = v[8] - v[2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const flip = nx * wx + ny * wy + nz * wz < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    const qx = n8(nx / l), qy = n8(ny / l), qz = n8(nz / l);
    const r = c8(color.r), g = c8(color.g), b = c8(color.b);
    const order = flip ? QUAD_FLIP : QUAD;
    for (let k = 0; k < 6; k++) {
      const o = order[k] * 3;
      this.pos.push(v[o], v[o + 1], v[o + 2]);
      this.nor.push(qx, qy, qz);
      this.nor.push(0);
      this.uv.push(0, 0);
      this.col.push(r, g, b);
      this.col.push(255);
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
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.take(), 4, true));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.take(), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.take(), 4, true));
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
// Props are kept as a compact list (template, matrix, color: ~84 bytes each) and only
// baked into a mesh when needed: a baked cube is 36 full vertices, and the whole
// city's props baked at once was the largest chunk of memory on phones.
const _m4 = new THREE.Matrix4();
export class PropBuf {
  constructor() {
    this.tpls = [];
    this.tpl = new List(Uint16Array);
    this.mat = new List(Float32Array);
    this.col = new List(Float32Array);
  }
  add(template, matrix, color, shade = 0) {
    let t = this.tpls.indexOf(template);
    if (t < 0) t = this.tpls.push(template) - 1;
    this.tpl.push(t);
    const e = matrix.elements;
    for (let i = 0; i < 16; i += 2) this.mat.push(e[i], e[i + 1]);
    this.col.push(color.r, color.g, color.b);
    this.col.push(shade);
  }
  get empty() {
    return this.tpl.length === 0;
  }
  // Bake in slices of `budget` ms: returns the geometry when done, null meanwhile.
  bakeStep(budget) {
    const t0 = performance.now();
    let j = this.job;
    if (!j) {
      let verts = 0;
      for (let k = 0; k < this.tpl.length; k++) verts += this.tpls[this.tpl.a[k]].attributes.position.count;
      j = this.job = { k: 0, o: 0, o4: 0, pos: new Float32Array(verts * 3), nor: new Int8Array(verts * 4), col: new Uint8Array(verts * 4).fill(255) };
    }
    const { pos, nor, col } = j;
    for (; j.k < this.tpl.length; j.k++) {
      if ((j.k & 63) === 0 && performance.now() - t0 > budget) return null;
      const k = j.k;
      const tp = this.tpls[this.tpl.a[k]];
      const p = tp.attributes.position.array, n = tp.attributes.normal.array;
      _m4.fromArray(this.mat.a, k * 16);
      _nm.getNormalMatrix(_m4);
      const r = this.col.a[k * 4], g = this.col.a[k * 4 + 1], b = this.col.a[k * 4 + 2], shade = this.col.a[k * 4 + 3];
      for (let i = 0; i < p.length; i += 3, j.o += 3, j.o4 += 4) {
        const o = j.o, o4 = j.o4;
        _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(_m4);
        _n.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_nm).normalize();
        pos[o] = _v.x; pos[o + 1] = _v.y; pos[o + 2] = _v.z;
        nor[o4] = n8(_n.x); nor[o4 + 1] = n8(_n.y); nor[o4 + 2] = n8(_n.z);
        const k2 = shade ? 1 - shade * ((i * 7919) % 13) / 13 : 1;
        col[o4] = c8(r * k2); col[o4 + 1] = c8(g * k2); col[o4 + 2] = c8(b * k2);
      }
    }
    this.job = null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 4, true));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4, true));
    geo.computeBoundingSphere();
    return geo;
  }
  // Baked geometry; the list is kept so the mesh can be rebuilt after a dispose.
  geometry() {
    let verts = 0;
    for (let k = 0; k < this.tpl.length; k++) verts += this.tpls[this.tpl.a[k]].attributes.position.count;
    const pos = new Float32Array(verts * 3), nor = new Int8Array(verts * 4), col = new Uint8Array(verts * 4).fill(255);
    let o = 0, o4 = 0;
    for (let k = 0; k < this.tpl.length; k++) {
      const tp = this.tpls[this.tpl.a[k]];
      const p = tp.attributes.position.array, n = tp.attributes.normal.array;
      _m4.fromArray(this.mat.a, k * 16);
      _nm.getNormalMatrix(_m4);
      const r = this.col.a[k * 4], g = this.col.a[k * 4 + 1], b = this.col.a[k * 4 + 2], shade = this.col.a[k * 4 + 3];
      for (let i = 0; i < p.length; i += 3, o += 3, o4 += 4) {
        _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(_m4);
        _n.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_nm).normalize();
        pos[o] = _v.x; pos[o + 1] = _v.y; pos[o + 2] = _v.z;
        nor[o4] = n8(_n.x); nor[o4 + 1] = n8(_n.y); nor[o4 + 2] = n8(_n.z);
        const k2 = shade ? 1 - shade * ((i * 7919) % 13) / 13 : 1;
        col[o4] = c8(r * k2); col[o4 + 1] = c8(g * k2); col[o4 + 2] = c8(b * k2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 4, true));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4, true));
    geo.computeBoundingSphere();
    return geo;
  }
  // trim the lists once filling is over
  pack() {
    for (const l of [this.tpl, this.mat, this.col]) {
      const n = l.length;
      l.a = l.a.slice(0, n);
      l.length = n;
    }
  }
}

// Non-indexed template geometry (position + normal only).
export function template(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}

// How far facades and cut-outs stream in (light mode shortens it).
export const streaming = { range: 1 };

// Per-chunk accumulators: facade (texture array), props, alpha cut-outs and cables.
export class ChunkSet {
  constructor(size) {
    this.size = size;
    this.map = new Map();
    this.detail = []; // small stuff hidden beyond `range` meters
    this.lazy = []; // props baked only while the camera is near
    this.streamed = []; // meshes kept on the GPU only while the camera is near
  }
  at(x, z) {
    const key = `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
    let c = this.map.get(key);
    if (!c) this.map.set(key, (c = { facade: new GeoBuf(true), props: new PropBuf(), alpha: new GeoBuf(), lines: [] }));
    return c;
  }
  build(root, mats) {
    this.root = root;
    this.mats = mats;
    for (const [key, c] of this.map) {
      const [ix, iz] = key.split(',').map(Number);
      const cx = (ix + 0.5) * this.size, cz = (iz + 0.5) * this.size;
      const detail = (mesh, range) => this.detail.push({ mesh, cx, cz, range: range + this.size * 0.7 });
      // facades and cut-outs stream in and out of the GPU around the player (the fog
      // hides anything past ~1.1 km anyway); their CPU copy stays to come back quickly
      if (!c.facade.empty) {
        const m = new THREE.Mesh(c.facade.geometry(), mats.facade);
        m.castShadow = m.receiveShadow = true;
        this.streamed.push({ mesh: m, cx, cz, range: 950 * streaming.range + this.size * 0.7, on: false });
      }
      if (!c.props.empty) {
        // baked on demand near the camera (see updateDetail)
        c.props.pack();
        this.lazy.push({ props: c.props, mesh: null, cx, cz, range: 420 + this.size * 0.7 });
      }
      if (!c.alpha.empty) {
        const m = new THREE.Mesh(c.alpha.geometry(), mats.alpha);
        m.receiveShadow = true;
        this.streamed.push({ mesh: m, cx, cz, range: 320 * streaming.range + this.size * 0.7, on: false });
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
  // Show the small details only around the camera; bake nearby props (a couple per
  // frame so driving doesn't stutter) and free the far ones.
  updateDetail(p, fast = false, initial = false, full = true) {
    if (!full) {
      // in between full checks: one queued upload and a slice of the current bake
      const s = this.addQueue?.pop();
      if (s && !s.on) {
        this.root.add(s.mesh);
        s.on = true;
      }
      if (this.pending && !this.pending.mesh && !fast) {
        const geo = this.pending.props.bakeStep(2);
        if (geo) this.finishBake(this.pending, geo);
      }
      return;
    }
    for (const d of this.detail) d.mesh.visible = (d.cx - p.x) ** 2 + (d.cz - p.z) ** 2 < d.range * d.range;
    // spread the uploads when flying in fast; at load time bring everything in range at once
    // (otherwise the first seconds show balconies and roofs floating without their walls)
    let uploads = initial ? Infinity : 1;
    this.addQueue = [];
    for (const s of this.streamed) {
      const d2 = (s.cx - p.x) ** 2 + (s.cz - p.z) ** 2;
      if (!s.on && d2 < s.range * s.range) {
        if (uploads-- > 0) {
          this.root.add(s.mesh);
          s.on = true;
        } else this.addQueue.push(s);
      } else if (s.on && d2 > (s.range * 1.15) ** 2) {
        this.root.remove(s.mesh);
        s.mesh.geometry.dispose(); // frees the GPU buffers; re-uploaded when it comes back
        s.on = false;
      }
    }
    // bake one chunk's props at a time, ~2 ms a frame (nearest first); flying over: no
    // baking, it'd be garbage a second later; at load time everything in range at once
    let next = null, nd = Infinity;
    for (const l of this.lazy) {
      const d2 = (l.cx - p.x) ** 2 + (l.cz - p.z) ** 2;
      if (d2 < l.range * l.range) {
        if (!l.mesh && initial) this.finishBake(l, l.props.bakeStep(Infinity));
        else if (!l.mesh && (l.props.job ? -1 : d2) < nd) {
          nd = l.props.job ? -1 : d2;
          next = l;
        }
      } else if (l.mesh && d2 > (l.range * 1.4) ** 2) {
        this.root.remove(l.mesh);
        l.mesh.geometry.dispose();
        l.mesh = null;
      } else if (!l.mesh && l.props.job && d2 > (l.range * 1.4) ** 2) l.props.job = null;
    }
    this.pending = next;
    if (next && !fast) {
      const geo = next.props.bakeStep(2);
      if (geo) this.finishBake(next, geo);
    }
  }
  finishBake(l, geo) {
    l.mesh = new THREE.Mesh(freeAfterUpload(geo), this.mats.props);
    l.mesh.castShadow = l.mesh.receiveShadow = true;
    this.root.add(l.mesh);
  }
}

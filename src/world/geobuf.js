// Geometry accumulators used to merge the city into a few meshes per chunk.
import * as THREE from 'three';

// Triangle soup with normals, uvs, vertex colors and (optionally) a texture-array layer.
export class GeoBuf {
  constructor(layered = false) {
    this.layered = layered;
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.lay = [];
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
    nx /= l; ny /= l; nz /= l;
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(u[0], u[1]);
      this.col.push(color.r, color.g, color.b);
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
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.layered) g.setAttribute('layer', new THREE.Float32BufferAttribute(this.lay, 1));
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
    this.pos = [];
    this.nor = [];
    this.col = [];
  }
  add(template, matrix, color, shade = 0) {
    const p = template.attributes.position.array, n = template.attributes.normal.array;
    _nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.length; i += 3) {
      _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(matrix);
      _n.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_nm).normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      const k = shade ? 1 - shade * ((i * 7919) % 13) / 13 : 1;
      this.col.push(color.r * k, color.g * k, color.b * k);
    }
  }
  get empty() {
    return this.pos.length === 0;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
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
        const m = new THREE.Mesh(c.facade.geometry(), mats.facade);
        m.castShadow = m.receiveShadow = true;
        root.add(m);
      }
      if (!c.props.empty) {
        const m = new THREE.Mesh(c.props.geometry(), mats.props);
        m.castShadow = m.receiveShadow = true;
        root.add(m);
        detail(m, 420);
      }
      if (!c.alpha.empty) {
        const m = new THREE.Mesh(c.alpha.geometry(), mats.alpha);
        m.receiveShadow = true;
        root.add(m);
        detail(m, 320);
      }
      if (c.lines.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(c.lines, 3));
        g.computeBoundingSphere();
        const l = new THREE.LineSegments(g, mats.cables);
        root.add(l);
        detail(l, 350);
      }
    }
    this.map.clear();
  }
  // Show the small details only around the camera.
  updateDetail(p) {
    for (const d of this.detail) d.mesh.visible = (d.cx - p.x) ** 2 + (d.cz - p.z) ** 2 < d.range * d.range;
  }
}

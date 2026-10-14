// Level of detail for traffic: a real car model is up to ~20 meshes (each one a draw
// call, plus its shadow); 70 of them were close to half the frame. Past NEAR metres a
// vehicle is drawn as a simple body + cabin + wheels in its paint colour instead, all
// of them in one instanced draw (two: cars and buses).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const NEAR = 85;
const MAX = 256;

// unit-size shape (width x height x length = 1): vertex colours shade the paint
function shape(parts) {
  const geos = parts.map(([x0, x1, y0, y1, z0, z1, shade]) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.deleteAttribute('uv');
    const c = new Float32Array(g.attributes.position.count * 3).fill(shade);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  });
  return mergeGeometries(geos);
}
const CAR = shape([
  [-0.5, 0.5, 0.2, 0.58, -0.5, 0.5, 1], // body
  [-0.44, 0.44, 0.58, 0.97, -0.28, 0.2, 0.18], // cabin (glass)
  [-0.5, -0.36, 0, 0.32, 0.22, 0.4, 0.06], [0.36, 0.5, 0, 0.32, 0.22, 0.4, 0.06], // wheels
  [-0.5, -0.36, 0, 0.32, -0.4, -0.22, 0.06], [0.36, 0.5, 0, 0.32, -0.4, -0.22, 0.06],
]);
const BUS = shape([
  [-0.5, 0.5, 0.1, 0.5, -0.5, 0.5, 1], // lower body
  [-0.51, 0.51, 0.5, 0.86, -0.47, 0.5, 0.15], // window band
  [-0.5, 0.5, 0.86, 1, -0.5, 0.5, 1], // roof
  [-0.5, -0.4, 0, 0.2, 0.25, 0.38, 0.06], [0.4, 0.5, 0, 0.2, 0.25, 0.38, 0.06],
  [-0.5, -0.4, 0, 0.2, -0.38, -0.25, 0.06], [0.4, 0.5, 0, 0.2, -0.38, -0.25, 0.06],
]);

export class CarLOD {
  constructor(scene) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 });
    this.cars = new THREE.InstancedMesh(CAR, mat, MAX);
    this.buses = new THREE.InstancedMesh(BUS, mat, 64);
    for (const m of [this.cars, this.buses]) {
      m.count = 0;
      m.frustumCulled = false; // spread over the whole city; few hundred triangles each
      m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.userData.dynamic = true;
      m.setColorAt(0, new THREE.Color(1, 1, 1)); // colours from the first frame: no recompile later
      scene.add(m);
    }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }
  update(vehicles, cam, playerVehicle) {
    let nc = 0, nb = 0;
    for (const v of vehicles) {
      const near = v === playerVehicle || (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2 < NEAR * NEAR;
      v.mesh.visible = near;
      if (near) continue;
      const bus = v.spec.height > 2.4;
      const mesh = bus ? this.buses : this.cars;
      const i = bus ? nb : nc;
      if (i >= (bus ? 64 : MAX)) continue;
      this.e.set(v.pitch || 0, v.heading, 0);
      this.m.compose(this.p.set(v.x, v.y || 0, v.z), this.q.setFromEuler(this.e), this.s.set(v.spec.width, v.spec.height, v.spec.length));
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, this.c.set(v.lodColor ?? 0x888888));
      if (bus) nb++;
      else nc++;
    }
    this.cars.count = nc;
    this.buses.count = nb;
    for (const m of [this.cars, this.buses]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

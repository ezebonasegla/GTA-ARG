// Arcade vehicle physics: kinematic bicycle model with lateral grip (drifts with
// the handbrake) and circle-based collision against the city.
import * as THREE from 'three';
import { createVehicleMesh, VEHICLE_TYPES } from './models.js';

let nextId = 1;

export class Vehicle {
  constructor(type, x, z, heading, color) {
    this.id = nextId++;
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    color ??= this.spec.colors[Math.floor(Math.random() * this.spec.colors.length)];
    this.mesh = createVehicleMesh(type, color);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.steer = 0;
    this.wheelSpin = 0;
    this.health = 100;
    this.driver = null; // 'player' | 'npc' | 'police' | null
    this.braking = false;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  get speed() {
    return Math.sin(this.heading) * this.vx + Math.cos(this.heading) * this.vz;
  }

  get radius() {
    return this.spec.width / 2 + 0.05;
  }

  // Centers of the two collision circles (front / rear).
  circles() {
    const off = this.spec.length / 2 - this.spec.width / 2;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const n = this.type === 'bus' ? 3 : 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 2 ? (i ? -1 : 1) : 1 - i;
      out.push([this.x + fx * off * t, this.z + fz * off * t]);
    }
    return out;
  }

  // input: { throttle 0..1, brake 0..1, steer -1..1, handbrake bool }
  update(dt, input, collision) {
    const spec = this.spec;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let vF = fx * this.vx + fz * this.vz;
    const speedAbs = Math.abs(vF);

    // steering: less lock at speed
    const maxSteer = THREE.MathUtils.lerp(0.62, 0.14, Math.min(1, speedAbs / spec.maxSpeed));
    const target = input.steer * maxSteer;
    this.steer += (target - this.steer) * Math.min(1, dt * 8);
    const wheelbase = spec.length * 0.62;
    let yaw = (vF / wheelbase) * Math.tan(this.steer);
    if (input.handbrake && speedAbs > 4) yaw *= 1.35;
    this.heading += yaw * dt;

    // re-project world velocity into the new frame
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const rx = nfz, rz = -nfx;
    vF = nfx * this.vx + nfz * this.vz;
    let vL = rx * this.vx + rz * this.vz;

    this.braking = false;
    if (input.throttle > 0) {
      const a = spec.accel * input.throttle * (1 - Math.max(0, vF) / spec.maxSpeed);
      vF += (vF < -0.5 ? spec.accel * 2 : a) * dt;
    }
    if (input.brake > 0) {
      if (vF > 0.5) {
        vF -= 16 * input.brake * dt;
        this.braking = true;
      } else if (vF > -spec.maxSpeed * 0.3) {
        vF -= spec.accel * 0.6 * input.brake * dt;
      }
    }
    if (input.handbrake) {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), 6 * dt);
      this.braking = true;
    }
    // rolling + aero drag
    vF -= vF * (0.12 + Math.abs(vF) * 0.004) * dt;
    if (!input.throttle && !input.brake && Math.abs(vF) < 0.3) vF = 0;
    const grip = input.handbrake ? 1.6 : 11;
    vL *= Math.exp(-grip * dt);

    this.vx = nfx * vF + rx * vL;
    this.vz = nfz * vF + rz * vL;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    let impact = 0;
    if (collision) {
      for (let pass = 0; pass < 2; pass++) {
        for (const [cx, cz] of this.circles()) {
          const res = collision.resolve(cx, cz, this.radius);
          if (!res.hit) continue;
          this.x += res.x - cx;
          this.z += res.z - cz;
          const vn = this.vx * res.nx + this.vz * res.nz;
          if (vn < 0) {
            impact = Math.max(impact, -vn);
            this.vx -= 1.3 * vn * res.nx;
            this.vz -= 1.3 * vn * res.nz;
            this.vx *= 0.8;
            this.vz *= 0.8;
          }
        }
      }
    }
    if (impact > 6) this.health = Math.max(0, this.health - (impact - 6) * 2);

    this.wheelSpin += (vF * dt) / 0.34;
    this.sync();
    return impact;
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels || [];
    wheels.forEach((w, i) => {
      w.rotation.x = this.wheelSpin;
      if (i < 2) w.rotation.y = this.steer;
    });
    // subtle body roll/pitch
    if (this.mesh.userData.tail) this.mesh.userData.tail.emissiveIntensity = this.braking ? 2.5 : 0.35;
  }
}

// Push two vehicles apart and exchange momentum (very simplified).
export function collideVehicles(a, b) {
  let hit = 0;
  for (const [ax, az] of a.circles()) {
    for (const [bx, bz] of b.circles()) {
      const dx = ax - bx, dz = az - bz;
      const d = Math.hypot(dx, dz);
      const min = a.radius + b.radius;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      const pen = min - d;
      const ma = a.spec.mass, mb = b.spec.mass;
      const wa = mb / (ma + mb), wb = ma / (ma + mb);
      a.x += nx * pen * wa;
      a.z += nz * pen * wa;
      b.x -= nx * pen * wb;
      b.z -= nz * pen * wb;
      const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rel < 0) {
        const j = -1.4 * rel;
        a.vx += nx * j * wa;
        a.vz += nz * j * wa;
        b.vx -= nx * j * wb;
        b.vz -= nz * j * wb;
        hit = Math.max(hit, -rel);
      }
    }
  }
  if (hit) {
    a.sync();
    b.sync();
  }
  return hit;
}

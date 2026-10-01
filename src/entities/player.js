// Player on foot: movement, jump, shove, getting in/out of cars and falling down.
import { GROUND_ONLY } from '../world/corridors.js';
import { createPersonMesh, animatePerson } from './person.js';

const TAU = Math.PI * 2;
const wrap = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const smooth = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};

// Door position of a vehicle. side 1 = driver (left), -1 = passenger (right).
export function doorPoint(v, side = 1, out = 0.55) {
  const h = v.heading;
  const lx = Math.cos(h), lz = -Math.sin(h);
  const fx = Math.sin(h), fz = Math.cos(h);
  const along = v.type === 'bus' ? v.spec.length / 2 - 1.6 : v.spec.length * 0.06;
  const d = (v.spec.width / 2 + out) * side;
  return { x: v.x + lx * d + fx * along, z: v.z + lz * d + fz * along, lx: lx * side, lz: lz * side };
}

export class Player {
  constructor(scene, x, z, heading) {
    this.mesh = createPersonMesh({
      full: true, age: 'adult', skin: 0xd9a47e, hair: 'short', hairColor: 0x2e1f14,
      pattern: 'arg', pants: 0x1f2a44, shoes: 0xf2f2f2, sole: 0xf5f5f5, build: 1.02, scale: 1,
    });
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = heading;
    this.health = 100;
    this.vehicle = null;
    this.speed = 0;
    this.pushT = -1;
    this.transition = null; // getting in/out of a car
    this.dead = null; // WASTED ragdoll-ish fall
    this.grounded = true;
  }

  update(dt, input, camYaw, collision) {
    let fx = 0, fz = 0;
    if (input.down('KeyW', 'ArrowUp')) fz += 1;
    if (input.down('KeyS', 'ArrowDown')) fz -= 1;
    if (input.down('KeyA', 'ArrowLeft')) fx += 1;
    if (input.down('KeyD', 'ArrowRight')) fx -= 1;
    const run = input.down('ShiftLeft', 'ShiftRight');
    let moving = fx || fz;
    const pushing = this.pushT >= 0 && this.pushT < 0.3;
    const target = moving ? (run ? 6.5 : 2.6) * (pushing ? 0.3 : 1) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    if (moving) {
      // camera-relative movement: camera looks along (sin yaw, cos yaw)
      const fwdX = Math.sin(camYaw), fwdZ = Math.cos(camYaw);
      const rightX = fwdZ, rightZ = -fwdX;
      const dx = fwdX * fz + rightX * fx, dz = fwdZ * fz + rightZ * fx;
      const want = Math.atan2(dx, dz);
      this.heading += wrap(want - this.heading) * Math.min(1, dt * 12);
    }
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    const r = collision.resolve(this.x, this.z, 0.35, Math.abs(this.y) > 1 ? GROUND_ONLY : 'platform');
    this.x = r.x;
    this.z = r.z;
    const floor = collision.floorAt(this.x, this.z, this.y);
    if (input.hit('Space') && this.y <= floor + 0.01) this.vy = 5.2;
    this.vy -= 18 * dt;
    this.y += this.vy * dt;
    this.grounded = false;
    if (this.y <= floor) {
      this.y = floor; // steps up onto platforms
      this.vy = 0;
      this.grounded = true;
    }
    if (this.pushT >= 0) this.pushT += dt;
    animatePerson(this.mesh, dt, { speed: this.speed, air: this.y > floor + 0.08, vy: this.vy, push: this.pushT });
    this.sync();
  }

  push() {
    if (this.pushT < 0 || this.pushT > 0.45) this.pushT = 0;
  }

  // --------------------------------------------------------- car transitions
  // Walk to the nearest door, then climb in (~0.7 s). hooks.onDoor fires at the door.
  startEnter(v, hooks = {}) {
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
    const side = (this.x - v.x) * lx + (this.z - v.z) * lz >= 0 || v.type === 'bus' ? 1 : -1;
    this.transition = { kind: 'enter', v, side, stage: 0, t: 0, hooks, sit: 0 };
    this.speed = 0;
    this.pushT = -1;
  }

  startExit(v) {
    const d = doorPoint(v, 1, 0.7);
    this.transition = { kind: 'exit', v, side: 1, stage: 0, t: 0, sit: 1, door: d };
    this.mesh.visible = true;
    this.heading = v.heading;
    this.speed = 0;
    this.vy = 0;
    this.y = 0;
  }

  // Returns 'entered' / 'exited' when done, otherwise null.
  updateTransition(dt, input, collision) {
    const tr = this.transition;
    const v = tr.v;
    tr.t += dt;
    // the car rolls to a stop meanwhile
    if (Math.abs(v.speed) > 0.05) v.update(dt, { throttle: 0, brake: 1, steer: 0, handbrake: true }, collision);
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
    let speed = 0, done = null;
    if (tr.kind === 'enter') {
      const door = doorPoint(v, tr.side, 0.5);
      if (tr.stage === 0) {
        // hurry to the door, sliding around the car body
        const dx = door.x - this.x, dz = door.z - this.z;
        const d = Math.hypot(dx, dz);
        speed = d > 1.4 ? 6.2 : 3.8;
        const step = Math.min(d, speed * dt);
        if (d > 1e-3) {
          this.x += (dx / d) * step;
          this.z += (dz / d) * step;
          this.heading += wrap(Math.atan2(dx, dz) - this.heading) * Math.min(1, dt * 14);
        }
        for (const [cx, cz] of v.circles()) {
          const ox = this.x - cx, oz = this.z - cz;
          const od = Math.hypot(ox, oz), min = v.radius + 0.3;
          if (od < min && od > 1e-4) {
            this.x = cx + (ox / od) * min;
            this.z = cz + (oz / od) * min;
          }
        }
        if (d < 0.12 || tr.t > 1.1) {
          tr.stage = 1;
          tr.t = 0;
          tr.from = { x: this.x, z: this.z, h: this.heading };
          tr.hooks.onDoor?.();
        }
      } else {
        // open up, turn towards the seat and slide in
        const k = tr.t / 0.42;
        const seatX = v.x + lx * 0.38 * tr.side, seatZ = v.z + lz * 0.38 * tr.side;
        const faceCar = Math.atan2(-door.lx, -door.lz);
        const tIn = smooth((k - 0.25) / 0.75);
        this.heading = tr.from.h + wrap(faceCar - tr.from.h) * smooth(k / 0.3);
        this.heading += wrap(v.heading - this.heading) * tIn;
        this.x = door.x + (seatX - door.x) * tIn;
        this.z = door.z + (seatZ - door.z) * tIn;
        this.y = (v.y || 0) + 0.05 * tIn;
        tr.sit = smooth((k - 0.2) / 0.7);
        if (k >= 1) done = 'entered';
      }
    } else {
      // exit: from the seat, stand up while stepping out through the door
      const k = tr.t / 0.38;
      const seatX = v.x + lx * 0.38, seatZ = v.z + lz * 0.38;
      const door = tr.door;
      const r = collision.resolve(door.x, door.z, 0.35);
      const tOut = smooth(k);
      this.x = seatX + (r.x - seatX) * tOut;
      this.z = seatZ + (r.z - seatZ) * tOut;
      tr.sit = 1 - smooth((k - 0.15) / 0.8);
      this.y = v.y || 0;
      this.heading = v.heading + wrap(Math.atan2(door.lx, door.lz) - v.heading) * 0.5 * Math.sin(Math.min(1, k) * Math.PI);
      if (k >= 1) {
        // settle; any movement key ends the animation right away
        const moveKey = input.down('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight');
        if (tr.t > 0.55 || moveKey) done = 'exited';
      }
    }
    animatePerson(this.mesh, dt, { speed, sit: tr.sit });
    this.sync();
    if (done) {
      this.transition = null;
      this.y = tr.v.y || 0;
      if (done === 'entered') this.mesh.visible = false;
      animatePerson(this.mesh, 0, { speed: 0, sit: 0 });
    }
    return done;
  }

  // Abort a transition (death, busted). Returns the vehicle involved.
  cancelTransition() {
    const tr = this.transition;
    if (!tr) return null;
    this.transition = null;
    this.mesh.visible = true;
    this.y = tr.v.y || 0;
    if (tr.kind === 'enter' && tr.v.driver === 'player') tr.v.driver = null;
    return tr.v;
  }

  // ---------------------------------------------------------------- death
  die(vx = 0, vz = 0) {
    const sp = Math.hypot(vx, vz);
    // fall away from whatever hit us (face it, then go over backwards)
    if (sp > 0.5) this.heading = Math.atan2(-vx, -vz);
    this.dead = { vx: vx * 0.6, vz: vz * 0.6, vy: sp > 0.5 ? 2 + sp * 0.25 : 0.5, back: sp > 0.5 || Math.random() < 0.5, spin: 0 };
    this.mesh.visible = true;
  }

  updateDead(dt, collision) {
    const d = this.dead;
    if (!d) return;
    d.vy -= 20 * dt;
    this.y = Math.max(0, this.y + d.vy * dt);
    this.x += d.vx * dt;
    this.z += d.vz * dt;
    const drag = this.y > 0 ? 0.3 : 5;
    d.vx -= d.vx * Math.min(1, drag * dt);
    d.vz -= d.vz * Math.min(1, drag * dt);
    const r = collision.resolve(this.x, this.z, 0.3);
    this.x = r.x;
    this.z = r.z;
    const air = this.y > 0.02;
    const lie = d.back ? -Math.PI / 2 : Math.PI / 2;
    d.spin += (lie - d.spin) * Math.min(1, dt * (air ? 4 : 8));
    animatePerson(this.mesh, dt, { down: true, downAir: air });
    this.mesh.position.set(this.x, this.y + 0.13 * Math.abs(Math.sin(d.spin)), this.z);
    this.mesh.rotation.set(d.spin, this.heading, 0);
  }

  revive() {
    this.dead = null;
    this.transition = null;
    this.y = 0;
    this.vy = 0;
    this.speed = 0;
    this.mesh.visible = !this.vehicle;
    this.mesh.rotation.set(0, this.heading, 0);
    animatePerson(this.mesh, 1, { speed: 0 });
  }

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(0, this.heading, 0);
  }
}

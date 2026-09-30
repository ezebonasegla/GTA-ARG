// Player on foot.
import { createPersonMesh, animatePerson } from './models.js';

export class Player {
  constructor(scene, x, z, heading) {
    this.mesh = createPersonMesh({ shirt: 0x75aadb, pants: 0x1f2a44, stripes: true });
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = heading;
    this.phase = 0;
    this.health = 100;
    this.vehicle = null;
    this.speed = 0;
  }

  update(dt, input, camYaw, collision) {
    let fx = 0, fz = 0;
    if (input.down('KeyW', 'ArrowUp')) fz += 1;
    if (input.down('KeyS', 'ArrowDown')) fz -= 1;
    if (input.down('KeyA', 'ArrowLeft')) fx += 1;
    if (input.down('KeyD', 'ArrowRight')) fx -= 1;
    const run = input.down('ShiftLeft', 'ShiftRight');
    let moving = fx || fz;
    const target = moving ? (run ? 6.5 : 2.6) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    if (moving) {
      // camera-relative movement: camera looks along (sin yaw, cos yaw)
      const fwdX = Math.sin(camYaw), fwdZ = Math.cos(camYaw);
      const rightX = fwdZ, rightZ = -fwdX;
      const dx = fwdX * fz + rightX * fx, dz = fwdZ * fz + rightZ * fx;
      const want = Math.atan2(dx, dz);
      let dh = want - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
    }
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    const r = collision.resolve(this.x, this.z, 0.35, 'platform');
    this.x = r.x;
    this.z = r.z;
    const floor = collision.floorAt(this.x, this.z);
    if (input.hit('Space') && this.y <= floor + 0.01) this.vy = 5.2;
    this.vy -= 18 * dt;
    this.y += this.vy * dt;
    if (this.y <= floor) {
      this.y = floor; // steps up onto platforms
      this.vy = 0;
    }
    this.phase += dt * this.speed * 2.8;
    animatePerson(this.mesh, this.phase, Math.min(1.3, this.speed / 2.5));
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(0, this.heading, 0);
  }
}

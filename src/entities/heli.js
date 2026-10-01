// Helicopter the player can call (Shift+Y), board (E) and fly: W/S forward/back,
// A/D yaw, Space up, Shift down. The rotor has to spool up before it lifts, it tilts
// into its movement, lands on the ground or on rooftops and can't fly through walls.
import * as THREE from 'three';

const MAX_SPEED = 38, ACCEL = 9, CLIMB = 7, YAW = 1.3;

export class Helicopter {
  constructor(scene, x, z, heading) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.heading = heading;
    this.vx = this.vz = this.vy = 0;
    this.spin = 0; // rotor speed 0..1
    this.pitch = this.roll = 0;
    this.mesh = buildMesh();
    scene.add(this.mesh);
    this.sync();
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  // input: { forward, turn, lift } in -1..1 while piloted, or null when empty
  update(dt, input, collision) {
    this.spin += ((input ? 1 : 0) - this.spin) * Math.min(1, dt * (input ? 0.6 : 0.25));
    const power = Math.max(0, (this.spin - 0.55) / 0.45); // lift only once the rotor is up to speed
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const floor = collision.heightAt(this.x, this.z);
    const grounded = this.y <= floor + 0.05;
    if (input && power > 0) {
      if (!grounded || input.lift > 0) this.heading += input.turn * YAW * dt * power;
      const f = grounded ? 0 : input.forward;
      this.vx += fx * f * ACCEL * dt * power;
      this.vz += fz * f * ACCEL * dt * power;
      this.vy += (input.lift * CLIMB - this.vy) * Math.min(1, dt * 2) * power;
    }
    // gravity wins without power; air drag keeps speeds sane
    this.vy -= 9.8 * dt * (1 - power);
    const drag = Math.min(1, dt * (input ? 0.6 : 1.5));
    this.vx -= this.vx * drag;
    this.vz -= this.vz * drag;
    const sp = this.speed;
    if (sp > MAX_SPEED) {
      this.vx *= MAX_SPEED / sp;
      this.vz *= MAX_SPEED / sp;
    }
    // horizontal: blocked by anything taller than the helicopter's belly
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    if (collision.heightAt(nx, nz) > this.y + 0.3) {
      this.vx *= -0.2;
      this.vz *= -0.2;
    } else {
      this.x = nx;
      this.z = nz;
    }
    this.y = Math.min(260, this.y + this.vy * dt);
    const ground = collision.heightAt(this.x, this.z);
    if (this.y < ground) {
      this.y = ground;
      if (this.vy < 0) this.vy = 0;
      this.vx *= 1 - Math.min(1, dt * 6);
      this.vz *= 1 - Math.min(1, dt * 6);
    }
    // nose down when going forward, bank into turns
    const fwd = this.vx * fx + this.vz * fz;
    this.pitch += (THREE.MathUtils.clamp(fwd / MAX_SPEED, -1, 1) * 0.28 - this.pitch) * Math.min(1, dt * 3);
    this.roll += ((input ? -input.turn * 0.18 * Math.min(1, sp / 10) : 0) - this.roll) * Math.min(1, dt * 3);
    this.sync(dt);
  }

  sync(dt = 0) {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
    const { rotor, tail } = this.mesh.userData;
    rotor.rotation.y += this.spin * 28 * dt;
    tail.rotation.x += this.spin * 40 * dt;
  }

  // standing spot next to the door (right-hand side)
  doorPoint() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    return { x: this.x - fz * 2.4, z: this.z + fx * 2.4 };
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}

function buildMesh() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35, metalness: 0.3 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x1d4fa0, roughness: 0.4, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2833, roughness: 0.05, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.6, metalness: 0.5 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  // fuselage and bubble canopy (front is +z)
  add(new THREE.SphereGeometry(1, 20, 14).scale(1.05, 1.0, 1.9), paint, 0, 1.45, 0);
  add(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(0.98, 0.95, 1.4).rotateX(Math.PI / 2.6), glass, 0, 1.55, 0.75);
  add(new THREE.BoxGeometry(2.12, 0.28, 2.6), stripe, 0, 1.1, -0.2);
  // tail boom, fin and stabilizer
  add(new THREE.CylinderGeometry(0.16, 0.34, 5.2, 10).rotateX(Math.PI / 2), paint, 0, 1.7, -3.9);
  add(new THREE.BoxGeometry(0.1, 1.2, 0.8), stripe, 0, 2.2, -6.3);
  add(new THREE.BoxGeometry(1.6, 0.08, 0.45), paint, 0, 1.75, -5.6);
  // mast and skids
  add(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 8), dark, 0, 2.7, 0);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8).rotateX(Math.PI / 2), dark, s * 0.95, 0.05, 0.1);
    for (const zz of [-0.7, 0.9]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6).rotateZ(s * 0.25), dark, s * 0.85, 0.42, zz);
  }
  // main rotor (4 blades) and tail rotor, spun in sync()
  const rotor = new THREE.Group();
  rotor.position.set(0, 3.02, 0);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 5.2).translate(0, 0, 2.6), dark);
    blade.rotation.y = (i * Math.PI) / 2;
    blade.castShadow = true;
    rotor.add(blade);
  }
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), dark));
  g.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(0.18, 2.1, -6.3);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 0.12), dark);
    b.rotation.x = (i * Math.PI) / 2;
    tail.add(b);
  }
  g.add(tail);
  g.userData = { rotor, tail };
  return g;
}

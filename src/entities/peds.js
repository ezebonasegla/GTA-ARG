// Pedestrians walking along the sidewalks of the road graph.
import * as THREE from 'three';
import { createPersonMesh, animatePerson } from './models.js';

const MAX_PEDS = 42;
const SPAWN_MIN = 40, SPAWN_MAX = 160, DESPAWN = 200;

export class Peds {
  constructor(scene, graph, collision, rng) {
    this.scene = scene;
    this.graph = graph;
    this.collision = collision;
    this.rng = rng;
    this.list = [];
  }

  sideOffset(from, to, side) {
    const road = from.links.get(to);
    const w = road ? road.w : 10;
    const ped = road && (road.kind === 'pedestrian' || road.kind === 'footway');
    const dx = to.x - from.x, dz = to.z - from.z;
    const l = Math.hypot(dx, dz) || 1;
    const off = ped ? w * 0.3 : w / 2 + 1.7;
    return [(-dz / l) * off * side, (dx / l) * off * side];
  }

  spawn(px, pz, minD, maxD) {
    const nodes = this.graph.nodes;
    for (let tries = 0; tries < 20; tries++) {
      const a = nodes[Math.floor(this.rng() * nodes.length)];
      if (!a.neighbors.size) continue;
      const nb = [...a.neighbors];
      const b = nb[Math.floor(this.rng() * nb.length)];
      const t = this.rng();
      const side = this.rng() < 0.5 ? -1 : 1;
      const [ox, oz] = this.sideOffset(a, b, side);
      const x = a.x + (b.x - a.x) * t + ox, z = a.z + (b.z - a.z) * t + oz;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      if (this.collision.isBlocked(x, z, 0.4)) continue;
      const mesh = createPersonMesh({ stripes: this.rng() < 0.08 });
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const p = {
        mesh, x, z, heading: 0, from: a, to: b, side,
        speed: 1.1 + this.rng() * 0.5, phase: this.rng() * 6, state: 'walk', timer: 0,
        vy: 0, y: 0, vx: 0, vz: 0, dead: false,
      };
      this.list.push(p);
      return p;
    }
    return null;
  }

  addFleeing(x, z, fromX, fromZ) {
    const mesh = createPersonMesh();
    this.scene.add(mesh);
    const node = this.graph.nearestNode(x, z) || this.graph.nodes[0];
    const to = [...node.neighbors][0] || node;
    const p = { mesh, x, z, heading: 0, from: node, to, side: 1, speed: 1.3, phase: 0, state: 'flee', timer: 6, fx: fromX, fz: fromZ, vy: 0, y: 0, vx: 0, vz: 0, dead: false };
    this.list.push(p);
    return p;
  }

  remove(p) {
    this.scene.remove(p.mesh);
    this.list.splice(this.list.indexOf(p), 1);
  }

  scare(x, z, radius) {
    for (const p of this.list) {
      if (p.dead) continue;
      if (Math.hypot(p.x - x, p.z - z) < radius) {
        p.state = 'flee';
        p.timer = 5 + this.rng() * 3;
        p.fx = x;
        p.fz = z;
      }
    }
  }

  knockDown(p, vx, vz, up = 4) {
    p.dead = true;
    p.state = 'down';
    p.timer = 30;
    p.vx = vx;
    p.vz = vz;
    p.vy = up;
  }

  // ctx: { px, pz, vehicles, playerVehicle, onCrime, initial }
  update(dt, ctx) {
    const { px, pz } = ctx;
    for (const p of [...this.list]) {
      if (Math.hypot(p.x - px, p.z - pz) > DESPAWN || (p.dead && (p.timer -= dt) < 0)) this.remove(p);
    }
    let alive = this.list.filter((p) => !p.dead).length;
    for (let k = 0; k < 4 && alive < MAX_PEDS; k++) if (this.spawn(px, pz, ctx.initial ? 6 : SPAWN_MIN, SPAWN_MAX)) alive++;

    for (const p of this.list) {
      if (p.state === 'down') {
        // simple ballistic tumble, then lie on the ground
        p.vy -= 20 * dt;
        p.y = Math.max(0, p.y + p.vy * dt);
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const drag = p.y > 0 ? 0.3 : 4;
        p.vx -= p.vx * Math.min(1, drag * dt);
        p.vz -= p.vz * Math.min(1, drag * dt);
        const r = this.collision.resolve(p.x, p.z, 0.3);
        p.x = r.x;
        p.z = r.z;
        p.mesh.position.set(p.x, p.y + 0.15, p.z);
        p.mesh.rotation.x = THREE.MathUtils.lerp(p.mesh.rotation.x, -Math.PI / 2, Math.min(1, dt * 6));
        continue;
      }
      let tx, tz, speed = p.speed;
      if (p.state === 'flee') {
        p.timer -= dt;
        const dx = p.x - p.fx, dz = p.z - p.fz;
        const l = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / l) * 5;
        tz = p.z + (dz / l) * 5;
        speed = 4.2;
        if (p.timer <= 0) {
          p.state = 'walk';
          const n = this.graph.nearestNode(p.x, p.z);
          if (n && n.neighbors.size) {
            p.from = n;
            p.to = [...n.neighbors][Math.floor(this.rng() * n.neighbors.size)];
          }
        }
      } else {
        const [ox, oz] = this.sideOffset(p.from, p.to, p.side);
        tx = p.to.x + ox;
        tz = p.to.z + oz;
        if (Math.hypot(tx - p.x, tz - p.z) < 1.2) {
          const opts = [...p.to.neighbors].filter((n) => n !== p.from);
          const next = opts.length ? opts[Math.floor(this.rng() * opts.length)] : p.from;
          p.from = p.to;
          p.to = next;
          if (this.rng() < 0.1) p.side = -p.side; // crosses the street
        }
      }
      const dx = tx - p.x, dz = tz - p.z;
      const l = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += dh * Math.min(1, dt * 6);
      p.x += (dx / l) * speed * dt;
      p.z += (dz / l) * speed * dt;
      const r = this.collision.resolve(p.x, p.z, 0.3);
      p.x = r.x;
      p.z = r.z;
      p.phase += dt * speed * 3.2;
      animatePerson(p.mesh, p.phase, Math.min(1, speed / 1.5));
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }

    // vehicle impacts
    for (const v of ctx.vehicles) {
      const sp = Math.abs(v.speed);
      if (sp < 2.5) continue;
      for (const p of this.list) {
        if (p.dead) continue;
        if (Math.abs(p.x - v.x) > 8 || Math.abs(p.z - v.z) > 8) continue;
        for (const [cx, cz] of v.circles()) {
          if (Math.hypot(p.x - cx, p.z - cz) < v.radius + 0.35) {
            this.knockDown(p, v.vx * 0.9, v.vz * 0.9, 2 + sp * 0.3);
            if (v === ctx.playerVehicle) ctx.onCrime?.('atropello', 1);
            this.scare(p.x, p.z, 25);
            break;
          }
        }
      }
    }
  }
}

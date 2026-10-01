// Pedestrians walking along the sidewalks of the road graph.
import { createPersonMesh, animatePerson, disposePerson } from './person.js';

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

  // Where to walk for the leg from -> to: the sidewalk next to `to`, on `side` if that
  // spot is free (corner buildings often cover it), else the other sidewalk, or a few
  // meters back along the block.
  legTarget(p) {
    const { from, to } = p;
    const dx = to.x - from.x, dz = to.z - from.z, l = Math.hypot(dx, dz) || 1;
    for (const back of [0, 3, 6, 10]) {
      for (const side of [p.side, -p.side]) {
        const [ox, oz] = this.sideOffset(from, to, side);
        const x = to.x - (dx / l) * Math.min(back, l / 2) + ox, z = to.z - (dz / l) * Math.min(back, l / 2) + oz;
        if (!this.collision.isBlocked(x, z, 0.35)) {
          p.side = side;
          p.tx = x;
          p.tz = z;
          return;
        }
      }
    }
    [p.tx, p.tz] = [to.x, to.z]; // nothing free: walk on the street itself
  }

  spawn(px, pz, minD, maxD) {
    // only consider street segments around the player (the city can be huge)
    const segs = [...this.graph.segIndex.query(px - maxD, pz - maxD, px + maxD, pz + maxD)];
    if (!segs.length) return null;
    for (let tries = 0; tries < 20; tries++) {
      const seg = segs[Math.floor(this.rng() * segs.length)];
      const [a, b] = this.rng() < 0.5 ? [seg.a, seg.b] : [seg.b, seg.a];
      const t = this.rng();
      const side = this.rng() < 0.5 ? -1 : 1;
      const [ox, oz] = this.sideOffset(a, b, side);
      const x = a.x + (b.x - a.x) * t + ox, z = a.z + (b.z - a.z) * t + oz;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      if (this.collision.isBlocked(x, z, 0.4)) continue;
      const mesh = createPersonMesh({ rng: this.rng });
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const look = mesh.userData.look;
      const p = {
        mesh, x, z, heading: 0, from: a, to: b, side,
        speed: (look.age === 'elder' ? 0.8 : 1.1) + this.rng() * (look.age === 'kid' ? 0.8 : 0.45), state: 'walk', timer: 0,
        vy: 0, y: 0, vx: 0, vz: 0, dead: false, panic: this.rng() < 0.3, spin: 0, spinV: 0, back: true,
      };
      this.legTarget(p);
      this.list.push(p);
      return p;
    }
    return null;
  }

  addFleeing(x, z, fromX, fromZ) {
    const mesh = createPersonMesh({ rng: this.rng, age: 'adult' });
    this.scene.add(mesh);
    const node = this.graph.nearestNode(x, z) || this.graph.nodes[0];
    const to = [...node.neighbors][0] || node;
    const p = {
      mesh, x, z, heading: Math.atan2(x - fromX, z - fromZ), from: node, to, side: 1, speed: 1.3, state: 'flee', timer: 6, fx: fromX, fz: fromZ,
      vy: 0, y: 0, vx: 0, vz: 0, dead: false, panic: true, spin: 0, spinV: 0, back: true,
    };
    this.list.push(p);
    return p;
  }

  remove(p) {
    this.scene.remove(p.mesh);
    disposePerson(p.mesh);
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
    // face the impact and go over backwards (or get spun round and land face down)
    const sp = Math.hypot(vx, vz);
    if (sp > 0.3) p.heading = Math.atan2(-vx, -vz);
    p.back = this.rng() < 0.75;
    p.spinV = -(3 + sp * 0.6) * (p.back ? 1 : -1);
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
        // tumble while airborne, then settle flat on the back (or face down)
        const air = p.y > 0.02;
        const lie = p.back ? -Math.PI / 2 : Math.PI / 2;
        if (air && p.vy > -2) p.spin += p.spinV * dt;
        else p.spin += (lie - p.spin) * Math.min(1, dt * 8);
        p.spin = Math.max(-Math.PI * 0.7, Math.min(Math.PI * 0.7, p.spin));
        animatePerson(p.mesh, dt, { down: true, downAir: air });
        p.mesh.position.set(p.x, p.y + 0.13 * Math.abs(Math.sin(p.spin)), p.z);
        p.mesh.rotation.set(p.spin, p.heading, 0);
        continue;
      }
      if (p.state === 'idle') {
        // standing around (chatting, drinking mate...)
        p.timer -= dt;
        if (p.timer <= 0) p.state = 'walk';
        animatePerson(p.mesh, dt, { speed: 0 });
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
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
            p.side ||= 1;
            this.legTarget(p);
          }
        }
      } else {
        if (p.tx === undefined) this.legTarget(p);
        tx = p.tx;
        tz = p.tz;
        if (Math.hypot(tx - p.x, tz - p.z) < 1.2) {
          const opts = [...p.to.neighbors].filter((n) => n !== p.from);
          const next = opts.length ? opts[Math.floor(this.rng() * opts.length)] : p.from;
          p.from = p.to;
          p.to = next;
          if (this.rng() < 0.1) p.side = -p.side; // crosses the street
          else if (this.rng() < 0.18) {
            p.state = 'idle';
            p.timer = 2 + this.rng() * 6;
          }
          this.legTarget(p);
        }
        // not getting anywhere (pressed against a wall): turn back, then give up
        p.watch = (p.watch || 0) + dt;
        if (p.watch > 2) {
          const moved = Math.hypot(p.x - (p.wx ?? p.x + 9), p.z - (p.wz ?? p.z));
          p.watch = 0;
          p.wx = p.x;
          p.wz = p.z;
          if (moved < 0.5) {
            p.stuck = (p.stuck || 0) + 1;
            if (p.stuck >= 3 && Math.hypot(p.x - px, p.z - pz) > 40) {
              p.dead = true; // removed next frame (timer 0)
              p.timer = 0;
              p.mesh.visible = false;
              continue;
            }
            if (p.stuck >= 3) {
              p.x = p.tx;
              p.z = p.tz;
            }
            [p.from, p.to] = [p.to, p.from];
            p.side = -p.side;
            this.legTarget(p);
          } else p.stuck = 0;
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
      animatePerson(p.mesh, dt, { speed, panic: p.state === 'flee' && p.panic });
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

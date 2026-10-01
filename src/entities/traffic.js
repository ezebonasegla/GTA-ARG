// Traffic: NPC drivers following the road graph (respecting one-way streets and
// driving on the right), parked cars along the curbs, and police chasing the player.
import * as THREE from 'three';
import { Vehicle, collideVehicles } from './vehicle.js';
import { disposeVehicleMesh } from './models.js';
import { carLaneOffset } from '../world/metrobus.js';

const TYPE_WEIGHTS = [['sedan', 40], ['hatch', 28], ['pickup', 11], ['taxi', 15]]; // colectivos come from buses.js
const MAX_MOVING = 38;
const MAX_PARKED = 34;
const SPAWN_MIN = 90, SPAWN_MAX = 260, DESPAWN = 330;

function pickType(rng) {
  const total = TYPE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [t, w] of TYPE_WEIGHTS) if ((r -= w) < 0) return t;
  return 'sedan';
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// parked cars sit at PARK_OFF from the centerline; the lane keeps a car's width
// plus a margin away from them so traffic slips past instead of queueing behind them
const parkOffset = (road) => road.w / 2 - 1.0;
function laneOffset(road) {
  if (road.metro) return carLaneOffset(road); // Calchaquí: the center belongs to the metrobus
  const ideal = road.oneway ? road.w * 0.18 : road.w * 0.25;
  return Math.min(ideal, Math.max(road.oneway ? 0 : 0.4, parkOffset(road) - 2.1));
}

function speedLimit(road) {
  if (road.kind === 'pedestrian') return 4;
  if (road.motorway) return 27;
  if (road.ramp) return 14;
  if (road.kind === 'primary' || road.kind === 'trunk') return 15;
  if (road.kind === 'secondary') return 13;
  return 10;
}

export class Traffic {
  constructor(scene, graph, collision, rng) {
    this.scene = scene;
    this.graph = graph;
    this.collision = collision;
    this.rng = rng;
    this.vehicles = []; // every Vehicle in the world (incl. player's)
    this.npc = new Map(); // vehicle -> controller
    this.policeTimer = 0;
  }

  add(vehicle) {
    this.vehicles.push(vehicle);
    this.scene.add(vehicle.mesh);
    return vehicle;
  }

  remove(vehicle) {
    this.vehicles.splice(this.vehicles.indexOf(vehicle), 1);
    this.npc.delete(vehicle);
    this.scene.remove(vehicle.mesh);
    disposeVehicleMesh(vehicle.mesh);
  }

  lanePoint(edge, s) {
    const off = laneOffset(edge.road);
    return [edge.a.x + edge.dx * s - edge.dz * off, edge.a.z + edge.dz * s + edge.dx * off];
  }

  nextEdge(edge, prefer) {
    let outs = edge.b.out.filter((e) => e.b !== edge.a);
    const streets = outs.filter((e) => e.road.kind !== 'service');
    if (streets.length) outs = streets; // avoid driveways and parking aisles
    if (!outs.length) return edge.b.out[0] || null;
    if (prefer) {
      let best = outs[0], bestScore = -Infinity;
      for (const e of outs) {
        const score = -Math.hypot(e.b.x - prefer[0], e.b.z - prefer[1]);
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
      return best;
    }
    // prefer going straight a bit
    const weights = outs.map((e) => 1 + Math.max(0, e.dx * edge.dx + e.dz * edge.dz) * 2);
    let r = this.rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < outs.length; i++) if ((r -= weights[i]) < 0) return outs[i];
    return outs[0];
  }

  spawnMoving(px, pz, minD, maxD) {
    const edge = this.graph.randomEdgeNear(px, pz, 270, this.rng, (e) => {
      const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
      const d = Math.hypot(mx - px, mz - pz);
      return d > minD && d < maxD && e.road.kind !== 'pedestrian' && e.road.kind !== 'service';
    });
    if (!edge) return null;
    const s = this.rng() * edge.len * 0.8;
    const [x, z] = this.lanePoint(edge, s);
    if (this.vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 12)) return null;
    if (this.collision.isBlocked(x, z, 1.5)) return null;
    let type = pickType(this.rng);
    if (type === 'bus' && edge.road.w < 9) type = 'sedan';
    const v = this.add(new Vehicle(type, x, z, Math.atan2(edge.dx, edge.dz)));
    v.driver = 'npc';
    const speed = speedLimit(edge.road) * 0.7;
    v.vx = edge.dx * speed;
    v.vz = edge.dz * speed;
    this.npc.set(v, { path: [edge], stuck: 0, reverse: 0, fails: 0, cruise: 0.8 + this.rng() * 0.35 });
    return v;
  }

  spawnParked(px, pz, minD, maxD) {
    const edge = this.graph.randomEdgeNear(px, pz, 270, this.rng, (e) => {
      const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
      const d = Math.hypot(mx - px, mz - pz);
      return d > minD && d < maxD && e.road.w <= 12 && e.road.kind !== 'pedestrian' && e.road.kind !== 'service';
    });
    if (!edge || edge.len < 30) return null;
    const s = 12 + this.rng() * (edge.len - 24);
    const off = parkOffset(edge.road);
    const x = edge.a.x + edge.dx * s - edge.dz * off;
    const z = edge.a.z + edge.dz * s + edge.dx * off;
    if (this.vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 6)) return null;
    if (this.collision.isBlocked(x, z, 1.2)) return null;
    const type = this.rng() < 0.2 ? 'pickup' : this.rng() < 0.5 ? 'hatch' : 'sedan';
    const v = this.add(new Vehicle(type, x, z, Math.atan2(edge.dx, edge.dz)));
    v.parked = true;
    return v;
  }

  spawnPolice(px, pz) {
    const edge = this.graph.randomEdgeNear(px, pz, 270, this.rng, (e) => {
      const d = Math.hypot(e.a.x - px, e.a.z - pz);
      return d > 110 && d < 220;
    });
    if (!edge) return null;
    const [x, z] = this.lanePoint(edge, Math.min(5, edge.len / 2));
    if (this.vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 8)) return null;
    const v = this.add(new Vehicle('police', x, z, Math.atan2(edge.dx, edge.dz)));
    v.driver = 'police';
    this.npc.set(v, { police: true, path: null, repath: 0, stuck: 0, reverse: 0 });
    return v;
  }

  // ctx: { player: {x,z}, playerVehicle, peds, wanted, dt, time }
  update(dt, ctx) {
    const { px, pz } = ctx;
    let moving = 0, parked = 0, police = 0;
    for (const v of [...this.vehicles]) {
      if (v === ctx.playerVehicle || v.managed) continue; // buses.js manages its own colectivos
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d > DESPAWN && !(v.driver === 'police' && ctx.wanted > 0 && d < DESPAWN * 1.5)) {
        this.remove(v);
        continue;
      }
      if (v.driver === 'police') police++;
      else if (v.parked || !v.driver) parked++;
      else moving++;
    }
    if (!ctx.fast) for (let k = 0; k < 3 && moving < MAX_MOVING; k++) if (this.spawnMoving(px, pz, ctx.initial ? 25 : SPAWN_MIN, SPAWN_MAX)) moving++;
    if (!ctx.fast) for (let k = 0; k < 3 && parked < MAX_PARKED; k++) if (this.spawnParked(px, pz, ctx.initial ? 10 : SPAWN_MIN, SPAWN_MAX)) parked++;

    this.policeTimer -= dt;
    const wantCops = Math.min(5, ctx.wanted);
    if (police < wantCops && this.policeTimer <= 0) {
      this.spawnPolice(px, pz);
      this.policeTimer = 4;
    }
    if (ctx.wanted === 0) {
      for (const v of this.vehicles) {
        const c = this.npc.get(v);
        if (c?.police) {
          // cops go back to patrolling as regular traffic
          c.police = false;
          c.path = null;
        }
      }
    }

    for (const [v, c] of this.npc) {
      if (v.driver === 'player') continue;
      if (c.police) this.drivePolice(v, c, dt, ctx);
      else this.driveNpc(v, c, dt, ctx);
    }

    // vehicle-vehicle contacts (only near the player to save time)
    const near = this.vehicles.filter((v) => Math.abs(v.x - px) < 120 && Math.abs(v.z - pz) < 120);
    let playerHit = 0;
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i], b = near[j];
        if (Math.abs(a.x - b.x) > 14 || Math.abs(a.z - b.z) > 14) continue;
        const h = collideVehicles(a, b);
        if (h && (a === ctx.playerVehicle || b === ctx.playerVehicle)) {
          playerHit = Math.max(playerHit, h);
          const other = a === ctx.playerVehicle ? b : a;
          if (other.driver === 'police' && h > 3) ctx.onCrime?.('choque a patrullero', 1);
        }
      }
    }
    return playerHit;
  }

  obstacleAhead(v, ctx, range) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let nearest = Infinity;
    const check = (x, z, halfW, base = 1.6) => {
      const rx = x - v.x, rz = z - v.z;
      const along = rx * fx + rz * fz;
      if (along <= 0 || along > range) return;
      const lat = Math.abs(rx * fz - rz * fx);
      if (lat < base + halfW) nearest = Math.min(nearest, along);
    };
    for (const o of this.vehicles) {
      if (o === v) continue;
      if (Math.abs(o.x - v.x) > range + 6 || Math.abs(o.z - v.z) > range + 6) continue;
      // a parked car only blocks if the two bodies would actually touch
      if (o.parked) for (const [cx, cz] of o.circles()) check(cx, cz, o.spec.width / 2, v.spec.width / 2 + 0.1);
      else for (const [cx, cz] of o.circles()) check(cx, cz, o.radius * 0.6);
    }
    if (!ctx.playerVehicle) check(ctx.px, ctx.pz, 0.3);
    for (const t of ctx.trainBoxes || []) {
      if (Math.abs(t.x - v.x) > range + 20 || Math.abs(t.z - v.z) > range + 20) continue;
      for (const k of [-1, 0, 1]) check(t.x + t.dx * t.hl * k, t.z + t.dz * t.hl * k, t.hw + 1);
    }
    for (const p of ctx.peds) if (!p.dead && Math.abs(p.x - v.x) < range && Math.abs(p.z - v.z) < range) check(p.x, p.z, 0.3);
    return nearest;
  }

  driveNpc(v, c, dt, ctx) {
    if (v.health <= 0 || !v.driver) {
      v.update(dt, { throttle: 0, brake: 1, steer: 0 }, this.collision);
      return;
    }
    if (!c.path || !c.path.length) {
      const e = this.graph.nearestEdge(v.x, v.z, 40);
      if (!e) {
        v.driver = null;
        return;
      }
      c.path = [e];
    }
    while (c.path.length < 3) {
      const n = this.nextEdge(c.path[c.path.length - 1]);
      if (!n) break;
      c.path.push(n);
    }
    let e = c.path[0];
    let s = (v.x - e.a.x) * e.dx + (v.z - e.a.z) * e.dz;
    if (s > e.len - 0.5 && c.path.length > 1) {
      c.path.shift();
      e = c.path[0];
      s = (v.x - e.a.x) * e.dx + (v.z - e.a.z) * e.dz;
    }
    // pure pursuit target
    const speed = Math.max(0, v.speed);
    let look = 5 + speed * 0.55 + v.spec.length * 0.3;
    let tx, tz;
    let si = Math.max(0, s);
    for (let i = 0; i < c.path.length; i++) {
      const pe = c.path[i];
      const rem = pe.len - si;
      if (look <= rem || i === c.path.length - 1) {
        [tx, tz] = this.lanePoint(pe, Math.min(pe.len, si + look));
        break;
      }
      look -= rem;
      si = 0;
    }
    const desired = Math.atan2(tx - v.x, tz - v.z);
    const diff = wrapAngle(desired - v.heading);
    const steer = THREE.MathUtils.clamp(diff * 2.2, -1, 1);

    let target = speedLimit(e.road) * c.cruise;
    const next = c.path[1];
    if (next) {
      const turn = Math.acos(THREE.MathUtils.clamp(e.dx * next.dx + e.dz * next.dz, -1, 1));
      const toEnd = e.len - s;
      if (turn > 0.4 && toEnd < 30) target = Math.min(target, THREE.MathUtils.lerp(4.5, target, toEnd / 30));
    }
    const obst = this.obstacleAhead(v, ctx, 6 + speed * 1.4 + v.spec.length / 2);
    if (obst < Infinity) target = Math.min(target, Math.max(0, (obst - v.spec.length / 2 - 3) * 0.7));
    // barrera down ahead (and not already on the crossing): wait for the train
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    if (this.closedAt?.(v.x + fx * 14, v.z + fz * 14) && !this.closedAt(v.x, v.z)) target = 0;
    const err = target - speed;
    const input = {
      throttle: err > 0.3 ? Math.min(1, err * 0.35) : 0,
      brake: err < -0.5 ? Math.min(1, -err * 0.25) : 0,
      steer,
    };
    if (ctx.horn && Math.hypot(ctx.px - v.x, ctx.pz - v.z) < 25 && obst < 20) input.throttle *= 0.3;
    // wedged against a wall: back out with opposite lock, then give up and re-place
    if (c.reverse > 0) {
      c.reverse -= dt;
      Object.assign(input, { throttle: 0, brake: 1, steer: -steer });
    } else if (target > 2 && speed < 0.4 && obst === Infinity) {
      c.stuck += dt;
      if (c.stuck > 2.5) {
        c.stuck = 0;
        c.reverse = 1.6;
        c.fails = (c.fails || 0) + 1;
        if (c.fails >= 3) {
          c.fails = 0;
          if (Math.hypot(ctx.px - v.x, ctx.pz - v.z) > 60) {
            this.remove(v);
            return;
          }
          const [x, z] = this.lanePoint(e, Math.min(e.len, Math.max(0, s) + 6));
          if (!this.collision.isBlocked(x, z, v.radius)) {
            v.x = x;
            v.z = z;
            v.heading = Math.atan2(e.dx, e.dz);
            v.vx = v.vz = 0;
            c.reverse = 0;
          }
        }
      }
    } else {
      c.stuck = Math.max(0, c.stuck - dt);
      if (speed > 3) c.fails = 0;
    }
    // jammed behind something that never moves (a deadlock on a narrow street, a car
    // left in the lane): lose patience, back up and take another way
    if (obst < Infinity && speed < 0.4 && c.reverse <= 0) c.blocked = (c.blocked || 0) + dt;
    else c.blocked = 0;
    if (c.blocked > 12) {
      c.blocked = 0;
      if (Math.hypot(ctx.px - v.x, ctx.pz - v.z) > 120) {
        this.remove(v);
        return;
      }
      c.reverse = 1.8;
      c.path = null;
    }
    v.update(dt, input, this.collision);

    // last resort, whatever the reason: no real progress in 20 s
    if (!c.anchor || Math.hypot(v.x - c.anchor[0], v.z - c.anchor[1]) > 3) {
      c.anchor = [v.x, v.z];
      c.idle = 0;
    } else if ((c.idle += dt) > 20) {
      c.idle = 0;
      if (Math.hypot(ctx.px - v.x, ctx.pz - v.z) > 60) {
        this.remove(v);
        return;
      }
      const [x, z] = this.lanePoint(e, Math.min(e.len, Math.max(0, s) + 8));
      if (!this.collision.isBlocked(x, z, v.radius)) {
        v.x = x;
        v.z = z;
        v.heading = Math.atan2(e.dx, e.dz);
        v.vx = v.vz = 0;
      }
    }

    // got pushed off its route -> re-acquire
    const dev = Math.abs((v.x - e.a.x) * -e.dz + (v.z - e.a.z) * e.dx - laneOffset(e.road));
    if (dev > 14) c.path = null;
  }

  drivePolice(v, c, dt, ctx) {
    const lights = v.mesh.userData.siren;
    if (lights) {
      const on = Math.floor(ctx.time * 6) % 2 === 0;
      lights.red.emissiveIntensity = on ? 3 : 0.2;
      lights.blu.emissiveIntensity = on ? 0.2 : 3;
    }
    const dist = Math.hypot(ctx.px - v.x, ctx.pz - v.z);
    c.repath -= dt;
    if ((c.repath <= 0 || !c.path) && dist > 35) {
      const from = this.graph.nearestNode(v.x, v.z);
      const to = this.graph.nearestNode(ctx.px, ctx.pz);
      c.path = this.graph.path(from, to);
      c.prev = null;
      c.repath = 1.5;
    }
    let tx = ctx.px, tz = ctx.pz;
    if (dist > 35 && c.path && c.path.length) {
      // advance past nodes the car has already passed
      while (c.path.length > 1) {
        const [a, b] = c.path;
        if ((b.x - a.x) * (v.x - a.x) + (b.z - a.z) * (v.z - a.z) <= 0) break;
        c.prev = c.path.shift();
      }
      // pure pursuit along the road centerlines (keeps the car on the street)
      const pts = c.prev ? [c.prev, ...c.path] : c.path;
      if (pts.length < 2) {
        // already at the node closest to the player: go straight for them
        if (Math.hypot(pts[0].x - v.x, pts[0].z - v.z) > 12) {
          tx = pts[0].x;
          tz = pts[0].z;
        }
      } else {
        let remaining = 7 + Math.abs(v.speed) * 0.5;
        const a0 = pts[0], b0 = pts[1];
        const l0 = Math.hypot(b0.x - a0.x, b0.z - a0.z) || 1;
        let s = THREE.MathUtils.clamp(((v.x - a0.x) * (b0.x - a0.x) + (v.z - a0.z) * (b0.z - a0.z)) / l0, 0, l0);
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          if (s + remaining > L && i === pts.length - 2) break; // past the last node: chase the player
          if (s + remaining <= L) {
            const u = (s + remaining) / L;
            tx = a.x + (b.x - a.x) * u;
            tz = a.z + (b.z - a.z) * u;
            break;
          }
          remaining -= L - s;
          s = 0;
        }
      }
    }
    const desired = Math.atan2(tx - v.x, tz - v.z);
    let diff = wrapAngle(desired - v.heading);
    const speed = v.speed;
    let throttle = 1, brake = 0, steer = THREE.MathUtils.clamp(diff * 2.5, -1, 1);
    const targetSpeed = dist < 12 ? Math.max(0, (dist - 6) * 1.2) : Math.abs(diff) > 0.8 ? 9 : 30;
    if (speed > targetSpeed) {
      throttle = 0;
      brake = 1;
    }
    // unstick: reverse for a moment when blocked
    if (Math.abs(speed) < 1 && dist > 12) c.stuck += dt;
    else c.stuck = Math.max(0, c.stuck - dt);
    if (c.stuck > 1.5) {
      c.reverse = 1.2;
      c.stuck = 0;
    }
    if (c.reverse > 0) {
      c.reverse -= dt;
      throttle = 0;
      brake = 1;
      steer = -steer;
    }
    v.update(dt, { throttle, brake, steer }, this.collision);
  }
}

import * as THREE from 'three';
import { generateQuilmes } from './world/procedural.js';
import { buildWorld } from './world/builder.js';
import { mulberry32 } from './world/geo.js';
import { Environment } from './environment.js';
import { Input } from './input.js';
import { TouchControls, isTouchDevice } from './touch.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { Player } from './entities/player.js';
import { Vehicle } from './entities/vehicle.js';
import { Traffic } from './entities/traffic.js';
import { Peds } from './entities/peds.js';
import { Trains, trainHit } from './entities/train.js';
import { Buses } from './entities/buses.js';
import { headlightMaterial } from './entities/models.js';

const loadingText = document.getElementById('loading-text');
const setLoading = (t) => (loadingText.textContent = t);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function loadCityData() {
  const params = new URLSearchParams(location.search);
  if (params.get('mapa') !== 'procedural') {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/quilmes.json`);
      if (res.ok && res.headers.get('content-type')?.includes('json')) {
        const data = await res.json();
        if (data?.roads?.length) return data;
      }
    } catch {
      /* fall back to procedural */
    }
  }
  return generateQuilmes();
}

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const mobile = isTouchDevice();
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 1200);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  setLoading('Cargando datos de Quilmes…');
  await nextFrame();
  const data = await loadCityData();
  setLoading(`Construyendo ${data.buildings.length.toLocaleString('es-AR')} edificios y ${data.roads.length.toLocaleString('es-AR')} calles…`);
  await nextFrame();
  const t0 = performance.now();
  const world = buildWorld(data, renderer, scene);
  console.info(`Ciudad construida en ${Math.round(performance.now() - t0)} ms`);
  const env = new Environment(scene, renderer);
  world.waterMaterial.envMap = env.bakeEnvMap(12);
  world.waterMaterial.envMapIntensity = 0.9;
  const input = new Input(renderer.domElement);
  const touch = mobile ? new TouchControls(input) : null;
  if (mobile) env.sun.shadow.mapSize.set(1024, 1024); // lighter on phones
  const hud = new Hud(data);
  const audio = new Audio();
  const rng = mulberry32(Date.now() & 0xffff);
  const traffic = new Traffic(scene, world.graph, world.collision, rng);
  const peds = new Peds(scene, world.graph, world.collision, rng);
  const trains = new Trains(scene, data);
  // real colectivo lines (only for the real map: same coordinates)
  let buses = null;
  if (data.source !== 'procedural') {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/buses.json`);
      if (res.ok && res.headers.get('content-type')?.includes('json')) buses = new Buses(scene, await res.json(), { collision: world.collision, traffic, graph: world.graph });
    } catch {
      /* no bus data: the game runs without colectivos */
    }
  }
  document.getElementById('source').textContent =
    data.source !== 'procedural'
      ? `Mapa: ${data.attribution || '© colaboradores de OpenStreetMap'} · ${data.buildings.length.toLocaleString('es-AR')} edificios`
      : 'Mapa: aproximación procedural de Quilmes centro (ejecutá "npm run fetch-osm" para el mapa real)';

  // ------------------------------------------------------------- player
  const [sx, sz] = data.spawn;
  const spawnHeading = data.spawnHeading ?? 0;
  const player = new Player(scene, sx, sz, spawnHeading);
  const respawn = () => {
    player.x = sx;
    player.z = sz;
    player.health = 100;
    player.sync();
  };
  // a car waiting for the player on the nearest street
  {
    const edge = world.graph.nearestEdge(sx, sz, 80);
    if (edge) {
      const s = Math.max(12, Math.min(edge.len - 12, (sx - edge.a.x) * edge.dx + (sz - edge.a.z) * edge.dz));
      const off = edge.road.w / 2 - 1.1;
      const car = traffic.add(new Vehicle('sedan', edge.a.x + edge.dx * s - edge.dz * off, edge.a.z + edge.dz * s + edge.dx * off, Math.atan2(edge.dx, edge.dz), 0x1f5fa8));
      car.parked = true;
    }
  }

  let hours = 17.2; // golden hour
  let timeScale = 1 / 45; // game hours per real second (1 day = 18 min)
  let wanted = 0;
  let evadeTimer = 0;
  let bustedTimer = 0;
  let totalTime = 0;
  let deadTimer = 0;
  const crimeCooldown = new Map();
  const onCrime = (what, amount) => {
    const last = crimeCooldown.get(what) || -10;
    if (totalTime - last < 1.5) return;
    crimeCooldown.set(what, totalTime);
    wanted = Math.min(5, wanted + amount);
    evadeTimer = 0;
    hud.toast(`★ ${what}`);
  };

  const cam = { yaw: spawnHeading, pitch: 0.28, dist: 5.5, idle: 0, mode: 0 };
  const camModes = [1, 1.6, 0.6];

  // headlight for the player's car at night
  const headlight = new THREE.SpotLight(0xfff1d0, 0, 60, 0.6, 0.5, 1.2);
  scene.add(headlight, headlight.target);

  hud.setWanted(0);
  // Pre-populate traffic and pedestrians around the spawn.
  for (let i = 0; i < 30; i++) {
    traffic.update(0, { px: sx, pz: sz, playerVehicle: null, peds: peds.list, wanted: 0, time: 0, initial: true });
    peds.update(0, { px: sx, pz: sz, vehicles: [], initial: true });
  }

  document.getElementById('loading').classList.add('hidden');
  const startOverlay = document.getElementById('start');
  startOverlay.classList.remove('hidden');
  if (mobile) startOverlay.querySelector('.cta').textContent = 'TOCÁ PARA JUGAR';
  const start = () => {
    startOverlay.classList.add('hidden');
    audio.start();
    if (mobile) {
      // full screen and landscape where the browser allows it
      document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
    } else renderer.domElement.requestPointerLock?.();
  };
  startOverlay.addEventListener('click', start);

  const helpEl = document.getElementById('help');
  const clock = new THREE.Clock();

  function tryEnterVehicle() {
    let best = null, bestD = 4.5;
    for (const v of traffic.vehicles) {
      const d = Math.min(...v.circles().map(([x, z]) => Math.hypot(x - player.x, z - player.z)));
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return;
    if (best.driver === 'npc' || best.driver === 'police') {
      const lx = Math.cos(best.heading), lz = -Math.sin(best.heading);
      peds.addFleeing(best.x + lx * 2, best.z + lz * 2, player.x, player.z);
      if (best.driver === 'police') onCrime('robo de patrullero', 2);
      else if (traffic.vehicles.some((v) => v.driver === 'police' && Math.hypot(v.x - player.x, v.z - player.z) < 80)) onCrime('robo de auto', 1);
      hud.toast('¡Auto robado!');
    }
    traffic.npc.delete(best);
    best.driver = 'player';
    best.parked = false;
    player.vehicle = best;
    player.mesh.visible = false;
    cam.yaw = best.heading;
  }

  function exitVehicle() {
    const v = player.vehicle;
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading); // driver side (left)
    const r = world.collision.resolve(v.x + lx * (v.spec.width / 2 + 0.7), v.z + lz * (v.spec.width / 2 + 0.7), 0.35);
    player.x = r.x;
    player.z = r.z;
    player.heading = v.heading;
    player.vehicle = null;
    player.mesh.visible = true;
    v.driver = null;
    player.sync();
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    totalTime += dt;
    hours = (hours + dt * timeScale) % 24;

    if (input.hit('Tab')) helpEl.classList.toggle('hidden');
    if (input.hit('KeyT')) hours = (hours + 1) % 24;
    if (input.hit('KeyC')) cam.mode = (cam.mode + 1) % camModes.length;
    if (input.hit('KeyP')) timeScale = timeScale ? 0 : 1 / 45;

    // camera orbit
    const sens = 0.0024;
    cam.yaw -= input.mouseDX * sens;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + input.mouseDY * sens, -0.35, 1.2);
    if (input.mouseDX || input.mouseDY) cam.idle = 0;
    else cam.idle += dt;
    if (input.down('KeyQ')) cam.yaw += dt * 2;

    const inCar = !!player.vehicle;
    touch?.update(inCar);
    const horn = inCar && input.down('KeyH');
    let throttle = 0;

    if (deadTimer > 0) {
      deadTimer -= dt;
      if (deadTimer <= 0) respawn();
    } else if (inCar) {
      const v = player.vehicle;
      throttle = input.down('KeyW', 'ArrowUp') ? 1 : 0;
      const alive = v.health > 0;
      const impact = v.update(dt, {
        throttle: alive ? throttle : 0,
        brake: input.down('KeyS', 'ArrowDown') ? 1 : 0,
        steer: (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0),
        handbrake: input.down('Space'),
      }, world.collision);
      if (impact > 4) audio.thump(impact);
      if (!alive && Math.abs(v.speed) < 0.5 && !v.warned) {
        v.warned = true;
        hud.toast('El auto no arranca más. Bajate con E.');
      }
      player.x = v.x;
      player.z = v.z;
      player.heading = v.heading;
      if (input.hit('KeyE') && Math.abs(v.speed) < 8) exitVehicle();
      if (horn) peds.scare(v.x, v.z, 18);
      // auto-center camera behind the car
      if (cam.idle > 1.2 && Math.abs(v.speed) > 2) {
        const behind = v.speed >= 0 ? v.heading : v.heading + Math.PI;
        let d = behind - cam.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        cam.yaw += d * Math.min(1, dt * 2.5);
        cam.pitch += (0.22 - cam.pitch) * Math.min(1, dt * 2);
      }
    } else {
      player.update(dt, input, cam.yaw, world.collision);
      if (input.hit('KeyE')) tryEnterVehicle();
      if (input.hit('KeyF')) {
        // empujón
        for (const p of peds.list) {
          if (p.dead) continue;
          const dx = p.x - player.x, dz = p.z - player.z;
          if (Math.hypot(dx, dz) < 1.6 && dx * Math.sin(player.heading) + dz * Math.cos(player.heading) > 0) {
            peds.knockDown(p, dx * 3, dz * 3, 2);
            peds.scare(p.x, p.z, 20);
            onCrime('agresión', 1);
          }
        }
      }
      // hit by a car
      for (const v of traffic.vehicles) {
        const sp = Math.abs(v.speed);
        if (sp < 3) continue;
        for (const [cx, cz] of v.circles()) {
          if (Math.hypot(player.x - cx, player.z - cz) < v.radius + 0.35) {
            player.health -= sp * 5;
            player.x += v.vx * 0.15;
            player.z += v.vz * 0.15;
            audio.thump(sp);
            break;
          }
        }
      }
      if (player.health <= 0 && deadTimer <= 0) {
        hud.message('WASTED', '#c0392b', 4);
        wanted = 0;
        deadTimer = 4;
      }
    }

    // trains: move, then push/hurt whatever is on the tracks
    const trainBoxes = trains.update(dt);
    for (const box of trainBoxes) {
      const moving = Math.hypot(box.vx, box.vz) > 1;
      if (!player.vehicle && deadTimer <= 0) {
        const h = trainHit(box, player.x, player.z, 0.35);
        if (h) {
          player.x += h.nx * h.push;
          player.z += h.nz * h.push;
          if (moving) {
            player.health = 0;
            audio.thump(20);
          }
        }
      }
      for (const v of traffic.vehicles) {
        if (Math.abs(v.x - box.x) > 25 || Math.abs(v.z - box.z) > 25) continue;
        for (const [cx, cz] of v.circles()) {
          const h = trainHit(box, cx, cz, v.radius);
          if (!h) continue;
          v.x += h.nx * h.push;
          v.z += h.nz * h.push;
          if (moving) {
            v.vx = box.vx * 1.2 + h.nx * 6;
            v.vz = box.vz * 1.2 + h.nz * 6;
            v.health = Math.max(0, v.health - 40);
            if (v === player.vehicle) audio.thump(25);
          }
          v.sync();
          break;
        }
      }
      for (const p of peds.list) {
        if (!p.dead && moving && trainHit(box, p.x, p.z, 0.3)) peds.knockDown(p, box.vx, box.vz, 5);
      }
    }
    if (player.health <= 0 && deadTimer <= 0) {
      hud.message('WASTED', '#c0392b', 4);
      wanted = 0;
      deadTimer = 4;
    }

    const px = player.x, pz = player.z;
    const ctx = { px, pz, playerVehicle: player.vehicle, peds: peds.list, wanted, time: totalTime, horn, onCrime, trainBoxes };
    const carHit = traffic.update(dt, ctx);
    buses?.update(dt, ctx, rng);
    if (carHit > 3) audio.thump(carHit);
    peds.update(dt, { px, pz, vehicles: traffic.vehicles, playerVehicle: player.vehicle, onCrime });

    // wanted level: evade the cops to lose stars, stop next to them to get busted
    let nearestCop = Infinity;
    for (const v of traffic.vehicles) if (v.driver === 'police') nearestCop = Math.min(nearestCop, Math.hypot(v.x - px, v.z - pz));
    if (wanted > 0) {
      if (nearestCop > 90) evadeTimer += dt;
      else evadeTimer = Math.max(0, evadeTimer - dt * 0.5);
      if (evadeTimer > 12 + wanted * 4) {
        wanted--;
        evadeTimer = 0;
        if (!wanted) hud.toast('Perdiste a la policía');
      }
      const slow = !player.vehicle || Math.abs(player.vehicle.speed) < 2.5;
      if (nearestCop < 7 && slow) bustedTimer += dt;
      else bustedTimer = Math.max(0, bustedTimer - dt);
      if (bustedTimer > 2) {
        bustedTimer = 0;
        wanted = 0;
        if (player.vehicle) exitVehicle();
        hud.message('BUSTED', '#2e86de', 4);
        respawn();
      }
    }
    hud.setWanted(evadeTimer > 0 && wanted > 0 && Math.floor(totalTime * 3) % 2 ? 0 : wanted);

    // ------------------------------------------------------------- camera
    const focusY = inCar ? 1.6 : 1.5 + player.y;
    const baseDist = inCar ? 5 + player.vehicle.spec.length * 0.9 : 4.2;
    const dist = baseDist * camModes[cam.mode];
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const dirX = Math.sin(cam.yaw) * cp, dirZ = Math.cos(cam.yaw) * cp;
    let d = dist;
    for (let i = 1; i <= 10; i++) {
      const t = (dist * i) / 10;
      const x = px - dirX * t, z = pz - dirZ * t, y = focusY + sp * t;
      if (world.collision.heightAt(x, z) > y - 0.3) {
        d = Math.max(1.2, t - dist / 10);
        break;
      }
    }
    if (!window.__game?.freeCam) {
      camera.position.set(px - dirX * d, Math.max(0.4, focusY + sp * d), pz - dirZ * d);
      camera.lookAt(px, focusY, pz);
    }

    // ------------------------------------------------------------- environment
    const night = env.update(hours, { x: px, z: pz });
    world.setNight(night);
    world.waterMaterial.normalMap.offset.set(totalTime * 0.01, totalTime * 0.006);
    world.waterMaterial.envMapIntensity = 0.15 + 0.75 * (1 - night);
    headlightMaterial.emissiveIntensity = 0.3 + night * 3;
    if (inCar && night > 0.3) {
      const v = player.vehicle;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      headlight.intensity = 60 * night;
      headlight.position.set(v.x + fx * v.spec.length / 2, 0.9, v.z + fz * v.spec.length / 2);
      headlight.target.position.set(v.x + fx * 20, 0, v.z + fz * 20);
    } else headlight.intensity = 0;

    // ------------------------------------------------------------- HUD
    const near = world.graph.nearest(px, pz, 30);
    hud.setStreet(near?.seg.road.name || '');
    hud.setSpeed(inCar ? Math.abs(player.vehicle.speed) * 3.6 : null);
    hud.setClock(hours);
    hud.setHealth(inCar ? player.vehicle.health : player.health);
    let hint = '';
    if (!inCar && deadTimer <= 0) {
      const v = traffic.vehicles.find((v) => Math.min(...v.circles().map(([x, z]) => Math.hypot(x - px, z - pz))) < 4.5);
      if (v) hint = v.driver === 'npc' ? 'E: robar el auto' : v.driver === 'police' ? 'E: robar el patrullero' : 'E: subir al auto';
    }
    if (!hint && !inCar && buses) {
      const st = buses.nearestStop(px, pz, 6);
      if (st) hint = `Parada ${st.name} · Líneas ${st.lines.join(', ')}`;
    }
    hud.hint(hint);
    const blips = [];
    for (const t of trainBoxes) blips.push({ x: t.x, z: t.z, color: '#1d4fa0', r: 3 });
    for (const v of traffic.vehicles) if (v.driver === 'police') blips.push({ x: v.x, z: v.z, color: Math.floor(totalTime * 4) % 2 ? '#e74c3c' : '#3498db', r: 4 });
    hud.drawMinimap(px, pz, player.heading, cam.yaw, blips);
    hud.update(dt);
    audio.update({ inCar, speed: inCar ? player.vehicle.speed : 0, throttle, horn, sirenDist: nearestCop, time: totalTime });

    renderer.render(scene, camera);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  window.__game = { buses, trains, hud, scene, camera, renderer, player, traffic, peds, world, data, get hours() { return hours; }, set hours(h) { hours = h; } };
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  setLoading(`Error: ${err.message}`);
});

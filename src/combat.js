// Weapons: the real armerías of Quilmes sell a knife, a pistol, a shotgun and a
// submachine gun; the inventory (I) equips them, the right mouse button aims over the
// shoulder and the left one fires. Bullets are projectiles (muzzle speed, drop),
// shotguns fire pellets; hits knock people over, wreck cars and leave sparks, dust
// and blood. The police get out of their cars and shoot back as the stars go up.
import * as THREE from 'three';
import { createPersonMesh, animatePerson, disposePerson } from './entities/person.js';

export const WEAPONS = {
  knife: { name: 'Cuchillo', price: 9000, melee: true, dmg: 55, rate: 0.45, range: 1.9 },
  pistol: { name: 'Pistola 9 mm', price: 95000, dmg: 34, rate: 0.28, speed: 360, spread: 0.012, mag: 15, ammoPrice: 6000, ammoPack: 30, kick: 0.025, sound: 'pistol' },
  shotgun: { name: 'Escopeta', price: 190000, dmg: 16, pellets: 9, rate: 0.95, speed: 300, spread: 0.075, mag: 6, ammoPrice: 9000, ammoPack: 12, kick: 0.09, sound: 'shotgun' },
  smg: { name: 'Ametralladora', price: 380000, dmg: 20, rate: 0.085, auto: true, speed: 380, spread: 0.03, mag: 30, ammoPrice: 15000, ammoPack: 90, kick: 0.012, sound: 'smg' },
};
const ORDER = ['knife', 'pistol', 'shotgun', 'smg'];
const RELOAD = 1.5;
const GRAVITY = 9.8;
const MAX_COPS = 6;

// Real armerías (addresses from Cylex / all.biz, placed with the game's own geocoder).
export const GUN_SHOPS = [
  { name: 'Armería La Perdiz', kind: 'weapons', x: -432, z: 462, address: 'Hipólito Yrigoyen 646' },
  { name: 'Pointer', kind: 'weapons', x: -531, z: 469, address: 'Leandro N. Alem 11' },
  { name: 'Guns y Friends', kind: 'weapons', x: 413, z: -563, address: 'Av. Cevallos 440' },
];

const money = (n) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

// ------------------------------------------------------------------ meshes
function weaponMesh(type) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.45, metalness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9cdd0, roughness: 0.25, metalness: 0.9 });
  const box = (w, h, d, x, y, z, m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
  };
  // built with the barrel along +z and the grip down (-y), the hand at the origin
  if (type === 'knife') {
    box(0.025, 0.03, 0.11, 0, 0, 0.0, wood);
    box(0.006, 0.028, 0.2, 0, 0.004, 0.155, steel);
  } else if (type === 'pistol') {
    box(0.03, 0.035, 0.19, 0, 0.035, 0.07, dark);
    box(0.028, 0.1, 0.04, 0, -0.02, 0.0, dark);
  } else if (type === 'shotgun') {
    box(0.035, 0.05, 0.42, 0, 0.03, 0.2, dark);
    box(0.022, 0.022, 0.5, 0, 0.06, 0.45, steel);
    box(0.04, 0.09, 0.3, 0, -0.01, -0.18, wood);
    box(0.03, 0.04, 0.16, 0, 0.02, 0.36, wood);
  } else if (type === 'smg') {
    box(0.04, 0.07, 0.32, 0, 0.03, 0.12, dark);
    box(0.016, 0.016, 0.16, 0, 0.045, 0.36, steel);
    box(0.03, 0.13, 0.045, 0, -0.06, 0.16, dark); // magazine
    box(0.028, 0.08, 0.04, 0, -0.02, 0.0, dark);
    box(0.03, 0.04, 0.2, 0, 0.03, -0.12, dark);
  }
  // onto the forearm bone: its -y runs down to the hand
  const pivot = new THREE.Group();
  g.rotation.x = Math.PI / 2;
  g.position.set(0, -0.3, 0.02);
  pivot.add(g);
  return pivot;
}

// Arms raised to aim (after animatePerson). pitch: aim elevation (rad, + up).
function aimPose(mesh, type, pitch, k = 1) {
  const r = mesh.userData.rig;
  if (!r || !type) return;
  const lerp = (a, b) => a + (b - a) * k;
  if (type === 'knife') {
    r.shR.rotation.x = lerp(r.shR.rotation.x, -0.9);
    r.elR.rotation.x = lerp(r.elR.rotation.x, -0.9);
    return;
  }
  const up = -Math.PI / 2 - pitch;
  r.shR.rotation.set(lerp(r.shR.rotation.x, up), lerp(r.shR.rotation.y, 0.12), lerp(r.shR.rotation.z, 0.05));
  r.elR.rotation.x = lerp(r.elR.rotation.x, -0.05);
  if (type !== 'pistol') {
    // two-handed: the left hand under the barrel
    r.shL.rotation.set(lerp(r.shL.rotation.x, up + 0.15), lerp(r.shL.rotation.y, -0.55), lerp(r.shL.rotation.z, -0.25));
    r.elL.rotation.x = lerp(r.elL.rotation.x, -0.55);
  }
  r.spine.rotation.y = lerp(r.spine.rotation.y, type === 'pistol' ? 0 : 0.25);
}

// ------------------------------------------------------------------ module
export class Combat {
  constructor({ scene, world, player, peds, traffic, hud, audio, onCrime, getWanted }) {
    Object.assign(this, { scene, world, player, peds, traffic, hud, audio, onCrime, getWanted });
    this.collision = world.collision;
    this.money = 700000; // enough to try everything; killing people drops cash
    this.owned = {}; // type -> { mag, reserve }
    this.current = null; // null = bare hands
    this.cooldown = 0;
    this.reloading = 0;
    this.bullets = [];
    this.cops = [];
    this.aiming = false;
    this.menu = null; // 'shop' | 'inventory'
    this.held = null;
    this.flashT = 0;
    this.buildEffects();
    this.buildUi();
    this.placeShops();
  }

  // ---------------------------------------------------------------- shops
  placeShops() {
    // the door: from the business point out towards the nearest street, first free spot
    this.shops = GUN_SHOPS.map((s) => {
      const n = this.world.graph.nearest(s.x, s.z, 80);
      let door = { x: s.x, z: s.z };
      if (n) {
        const dx = n.x - s.x, dz = n.z - s.z, l = Math.hypot(dx, dz) || 1;
        for (let t = 0; t < l; t += 0.5) {
          const x = s.x + (dx / l) * t, z = s.z + (dz / l) * t;
          if (!this.collision.isBlocked(x, z, 0.45)) {
            door = { x, z };
            break;
          }
        }
      }
      return { ...s, door };
    });
    // a red ring with a floating pistol over each door
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.75, depthWrite: false }));
    this.markers = this.shops.map((s) => {
      const g = new THREE.Group();
      const r = ring.clone();
      r.position.y = 0.08;
      const icon = weaponMesh('pistol');
      icon.scale.setScalar(3);
      icon.position.y = 1.6;
      g.add(r, icon);
      g.position.set(s.door.x, 0, s.door.z);
      this.scene.add(g);
      return g;
    });
  }

  shopNear(x, z) {
    return this.shops.find((s) => Math.hypot(s.door.x - x, s.door.z - z) < 2.6) || null;
  }

  // E next to an armería: returns true when it opened
  tryShop() {
    const s = this.shopNear(this.player.x, this.player.z);
    if (!s) return false;
    if (this.getWanted() > 0) {
      this.hud.toast('Con la policía atrás el armero no te atiende.');
      return true;
    }
    this.openMenu('shop', s);
    return true;
  }

  // ---------------------------------------------------------------- UI
  buildUi() {
    const css = document.createElement('style');
    css.textContent = `
      #crosshair { position: fixed; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; pointer-events: none; display: none; z-index: 6; }
      #crosshair::before, #crosshair::after { content: ''; position: absolute; background: #fff; box-shadow: 0 0 2px #000; }
      #crosshair::before { left: 10px; top: 0; width: 2px; height: 22px; }
      #crosshair::after { top: 10px; left: 0; height: 2px; width: 22px; }
      #weapon { position: absolute; right: 26px; bottom: 96px; text-align: right; font-weight: 900; text-shadow: 2px 2px 0 #000; font-size: 20px; }
      #weapon small { display: block; font-size: 30px; font-family: monospace; }
      #money { font: 900 22px monospace; color: #7ee081; text-shadow: 2px 2px 0 #000; }
      #hurt { position: fixed; inset: 0; pointer-events: none; box-shadow: inset 0 0 160px rgba(200, 0, 0, 0.85); opacity: 0; transition: opacity 0.35s; z-index: 5; }
      #armory { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.55); z-index: 20; }
      #armory[hidden] { display: none; }
      #armory .panel { background: #15181c; border: 2px solid #ff3b30; border-radius: 10px; padding: 18px 22px; min-width: min(560px, 92vw); max-width: 92vw; color: #fff; font: 15px system-ui, sans-serif; }
      #armory h2 { margin: 0 0 4px; color: #ff6b5f; }
      #armory .sub { opacity: 0.75; margin-bottom: 12px; }
      #armory .row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-top: 1px solid #2a2f35; }
      #armory .row .n { flex: 1; font-weight: 700; }
      #armory .row .n span { display: block; font-weight: 400; opacity: 0.7; font-size: 13px; }
      #armory button { background: #ff3b30; color: #fff; border: 0; border-radius: 6px; padding: 8px 12px; font-weight: 700; cursor: pointer; }
      #armory button.alt { background: #2f6fb3; }
      #armory button:disabled { background: #444; cursor: default; }
      #armory .eq { outline: 2px solid #7ee081; border-radius: 6px; }
      #armory .foot { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
      body.touch #weapon { bottom: auto; top: 100px; font-size: 14px; }
      body.touch #weapon small { font-size: 20px; }`;
    document.head.appendChild(css);
    const hudEl = document.getElementById('hud') || document.body;
    this.ui = {
      cross: Object.assign(document.createElement('div'), { id: 'crosshair' }),
      weapon: Object.assign(document.createElement('div'), { id: 'weapon' }),
      money: Object.assign(document.createElement('div'), { id: 'money' }),
      hurt: Object.assign(document.createElement('div'), { id: 'hurt' }),
      menu: Object.assign(document.createElement('div'), { id: 'armory', hidden: true }),
    };
    document.body.append(this.ui.cross, this.ui.hurt, this.ui.menu);
    hudEl.appendChild(this.ui.weapon);
    (document.getElementById('topright') || hudEl).appendChild(this.ui.money);
    this.ui.menu.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) {
        if (e.target === this.ui.menu) this.closeMenu();
        return;
      }
      const { act, type } = b.dataset;
      if (act === 'buy') this.buy(type);
      else if (act === 'ammo') this.buyAmmo(type);
      else if (act === 'equip') this.equip(type || null);
      else if (act === 'close') return this.closeMenu();
      this.renderMenu();
    });
    this.refreshHud();
  }

  openMenu(kind, shop = null) {
    this.menu = kind;
    this.menuShop = shop;
    document.exitPointerLock?.();
    this.ui.menu.hidden = false;
    this.renderMenu();
  }

  closeMenu() {
    this.menu = null;
    this.ui.menu.hidden = true;
  }

  renderMenu() {
    const shop = this.menu === 'shop';
    const rows = ORDER.map((t) => {
      const w = WEAPONS[t], o = this.owned[t];
      const stats = w.melee ? 'cuerpo a cuerpo' : `${w.pellets ? `${w.pellets} perdigones` : `${w.dmg} de daño`} · cargador ${w.mag}${w.auto ? ' · automática' : ''}`;
      const have = o ? (w.melee ? 'la tenés' : `${o.mag} + ${o.reserve} balas`) : '';
      let btns = '';
      if (shop) {
        btns = o ? '' : `<button data-act="buy" data-type="${t}" ${this.money < w.price ? 'disabled' : ''}>Comprar ${money(w.price)}</button>`;
        if (!w.melee) btns += ` <button class="alt" data-act="ammo" data-type="${t}" ${!o || this.money < w.ammoPrice ? 'disabled' : ''}>${w.ammoPack} balas ${money(w.ammoPrice)}</button>`;
      } else if (o) btns = `<button class="alt" data-act="equip" data-type="${t}">${this.current === t ? 'Equipada' : 'Equipar'}</button>`;
      if (!shop && !o) return '';
      return `<div class="row ${this.current === t ? 'eq' : ''}"><div class="n">${ORDER.indexOf(t) + 1}. ${w.name}<span>${stats}${have ? ` · ${have}` : ''}</span></div>${btns}</div>`;
    }).join('');
    const title = shop ? this.menuShop.name : 'Inventario';
    const sub = shop ? `${this.menuShop.address}, Quilmes` : 'Elegí qué llevar en la mano (1-4, 0: manos libres, rueda del mouse: cambiar)';
    this.ui.menu.innerHTML = `<div class="panel"><h2>${title}</h2><div class="sub">${sub}</div>
      ${rows || '<div class="row"><div class="n">No tenés armas. Compralas en una armería (buscá "Armería" en el mapa, M).</div></div>'}
      <div class="foot"><span>Tenés <b style="color:#7ee081">${money(this.money)}</b></span>
      <span>${shop ? '' : `<button class="alt" data-act="equip" data-type="">Manos libres</button> `}<button data-act="close">Cerrar (Esc)</button></span></div></div>`;
  }

  buy(t) {
    const w = WEAPONS[t];
    if (this.owned[t] || this.money < w.price) return;
    this.money -= w.price;
    this.owned[t] = { mag: w.mag || 0, reserve: w.melee ? 0 : w.mag * 2 };
    this.equip(t);
    this.hud.toast(`Compraste: ${w.name}`);
    this.refreshHud();
  }

  buyAmmo(t) {
    const w = WEAPONS[t];
    if (!this.owned[t] || this.money < w.ammoPrice) return;
    this.money -= w.ammoPrice;
    this.owned[t].reserve += w.ammoPack;
    this.refreshHud();
  }

  equip(t) {
    if (t && !this.owned[t]) return;
    this.current = t;
    this.reloading = 0;
    const elR = this.player.mesh.userData.rig?.elR;
    if (this.held) {
      this.held.parent?.remove(this.held);
      this.held = null;
    }
    if (t && elR) {
      this.held = weaponMesh(t);
      elR.add(this.held);
    }
    this.refreshHud();
  }

  // death keeps the guns (and most of the money); getting busted takes them away
  onBusted() {
    this.owned = {};
    this.equip(null);
    this.money = Math.max(0, this.money - 20000);
    this.hud.toast('Te sacaron las armas en la comisaría.', 5);
    this.clearCops();
  }

  onWasted() {
    this.money = Math.round(this.money * 0.9);
    this.clearCops();
    this.refreshHud();
  }

  refreshHud() {
    this.ui.money.textContent = money(this.money);
    const w = this.current && WEAPONS[this.current];
    const o = this.current && this.owned[this.current];
    this.ui.weapon.innerHTML = w ? `${w.name}${w.melee ? '' : `<small>${this.reloading > 0 ? 'recargando…' : `${o.mag} / ${o.reserve}`}</small>`}` : '';
  }

  // ---------------------------------------------------------------- player
  // On foot, every frame. cam: { yaw, pitch }; camera: the THREE camera (last frame).
  updatePlayer(dt, input, cam, camera, touch) {
    const p = this.player;
    if (input.hit('KeyI')) {
      if (this.menu) this.closeMenu();
      else this.openMenu('inventory');
    }
    if (this.menu) {
      if (input.hit('Escape')) this.closeMenu();
      this.aiming = false;
      this.ui.cross.style.display = 'none';
      return;
    }
    for (let i = 0; i < ORDER.length; i++) if (input.hit(`Digit${i + 1}`) && this.owned[ORDER[i]]) this.equip(ORDER[i]);
    if (input.hit('Digit0')) this.equip(null);
    if (input.wheel) {
      const list = [null, ...ORDER.filter((t) => this.owned[t])];
      const i = list.indexOf(this.current);
      this.equip(list[(i + Math.sign(input.wheel) + list.length) % list.length]);
    }
    const w = this.current && WEAPONS[this.current];
    const o = this.current && this.owned[this.current];
    this.cooldown -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const n = Math.min(w.mag - o.mag, o.reserve);
        o.mag += n;
        o.reserve -= n;
        this.refreshHud();
      }
    }
    const firing = input.down('Mouse0');
    this.aiming = !!w && !w.melee && (input.down('Mouse2') || firing || (touch && firing));
    this.ui.cross.style.display = this.aiming && !touch ? 'block' : 'none';
    if (!w) return;
    if (this.aiming || (w.melee && firing)) p.heading = cam.yaw; // face where the camera looks
    if (input.hit('KeyX') && !w.melee && o.mag < w.mag && o.reserve > 0 && this.reloading <= 0) this.startReload();
    const trigger = w.auto ? firing : input.hit('Mouse0');
    if (!trigger || this.cooldown > 0 || this.reloading > 0) return;
    this.cooldown = w.rate;
    if (w.melee) return this.stab();
    if (o.mag <= 0) {
      if (o.reserve > 0) this.startReload();
      else this.hud.toast('Sin balas: comprá en una armería.');
      return;
    }
    o.mag--;
    // muzzle: right hand, in front of the chest; aim: what's under the crosshair
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading), rx = -fz, rz = fx;
    const muzzle = new THREE.Vector3(p.x + fx * 0.6 - rx * 0.18, p.y + 1.38, p.z + fz * 0.6 - rz * 0.18);
    let aim;
    if (touch) aim = this.autoAim(muzzle, fx, fz);
    if (!aim) {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      aim = this.rayHit(camera.position, dir, 150, 'player');
    }
    const dir = aim.clone().sub(muzzle).normalize();
    const moving = Math.hypot(p.vx || 0, p.vz || 0) > 0.5 || p.speed > 0.5;
    const spread = w.spread * (moving ? 1.8 : 1) * (input.down('Mouse2') || touch ? 1 : 1.6);
    this.fire(muzzle, dir, w, 'player', spread);
    cam.pitch -= w.kick; // recoil
    cam.yaw += (Math.random() - 0.5) * w.kick * 0.6;
    if (o.mag === 0 && o.reserve > 0) this.startReload();
    this.refreshHud();
    // gunshots: people run, cops near enough hear it
    this.peds.scare(p.x, p.z, 45);
    const copNear = this.cops.some((c) => !c.dead && Math.hypot(c.x - p.x, c.z - p.z) < 70) ||
      this.traffic.vehicles.some((v) => v.driver === 'police' && Math.hypot(v.x - p.x, v.z - p.z) < 70);
    if (copNear) this.onCrime('disparos', 1);
  }

  startReload() {
    this.reloading = RELOAD * (this.current === 'shotgun' ? 1.4 : 1);
    this.refreshHud();
  }

  stab() {
    const p = this.player;
    p.push();
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const targets = [...this.peds.list.filter((q) => !q.dead), ...this.cops.filter((c) => !c.dead)];
    for (const t of targets) {
      const dx = t.x - p.x, dz = t.z - p.z;
      if (Math.hypot(dx, dz) < WEAPONS.knife.range && dx * fx + dz * fz > 0.2) {
        this.damagePerson(t, WEAPONS.knife.dmg, fx * 2, fz * 2, new THREE.Vector3(t.x, 1.2, t.z), 'player');
        this.audio.thump?.(4);
        break;
      }
    }
  }

  // nearest person / cop in front (phones: no crosshair)
  autoAim(from, fx, fz) {
    let best = null, bestScore = Infinity;
    const cands = [...this.cops.filter((c) => !c.dead), ...this.peds.list.filter((q) => !q.dead)];
    for (const t of cands) {
      const dx = t.x - from.x, dz = t.z - from.z, d = Math.hypot(dx, dz);
      if (d > 40 || d < 0.5) continue;
      const cos = (dx * fx + dz * fz) / d;
      if (cos < 0.9) continue;
      const score = d * (2 - cos) * (t.isCop ? 0.5 : 1);
      if (score < bestScore) [best, bestScore] = [t, score];
    }
    return best ? new THREE.Vector3(best.x, (best.lev || 0) + 1.25, best.z) : null;
  }

  // ---------------------------------------------------------------- bullets
  fire(from, dir, w, owner, spread) {
    const n = w.pellets || 1;
    for (let i = 0; i < n; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * 2 * spread;
      d.y += (Math.random() - 0.5) * 2 * spread * 0.7;
      d.z += (Math.random() - 0.5) * 2 * spread;
      d.normalize().multiplyScalar(w.speed * (0.95 + Math.random() * 0.1));
      this.bullets.push({ p: from.clone(), v: d, dmg: w.dmg, owner, life: 0.9, start: from.clone() });
    }
    this.flash(from, dir);
    this.audio.gunshot?.(w.sound, owner === 'player' ? 1 : Math.max(0.15, 1 - from.distanceTo(new THREE.Vector3(this.player.x, 1, this.player.z)) / 120));
  }

  // first thing hit along a ray (for the crosshair): world, people, cars
  rayHit(origin, dir, max, owner) {
    const end = origin.clone().addScaledVector(dir, max);
    const h = this.segmentHit(origin, end, owner);
    return h ? h.point : end;
  }

  // Closest hit on the segment a -> b: { point, t, target?, kind }
  segmentHit(a, b, owner) {
    const d = b.clone().sub(a), len = d.length();
    if (len < 1e-4) return null;
    let best = null;
    const consider = (t, kind, target) => {
      if (t >= 0 && t <= 1 && (!best || t < best.t)) best = { t, kind, target };
    };
    // people and cars: vertical cylinders
    const cyl = (x, z, r, y0, y1, kind, target) => {
      const ax = a.x - x, az = a.z - z;
      const A = d.x * d.x + d.z * d.z, B = 2 * (ax * d.x + az * d.z), C = ax * ax + az * az - r * r;
      if (A < 1e-9) return;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      const tt = t < 0 && C < 0 ? 0 : t; // starting inside
      const y = a.y + d.y * tt;
      if (y >= y0 && y <= y1) consider(tt, kind, target);
    };
    const minX = Math.min(a.x, b.x) - 3, maxX = Math.max(a.x, b.x) + 3, minZ = Math.min(a.z, b.z) - 3, maxZ = Math.max(a.z, b.z) + 3;
    const inBox = (x, z) => x > minX && x < maxX && z > minZ && z < maxZ;
    for (const q of this.peds.list) if (!q.dead && inBox(q.x, q.z)) cyl(q.x, q.z, 0.32, (q.lev || 0), (q.lev || 0) + 1.8, 'ped', q);
    for (const c of this.cops) if (!c.dead && owner !== 'cop' && inBox(c.x, c.z)) cyl(c.x, c.z, 0.33, 0, 1.85, 'cop', c);
    for (const v of this.traffic.vehicles) {
      if (owner === 'player' && v === this.player.vehicle) continue;
      if (!inBox(v.x, v.z)) continue;
      for (const [cx, cz] of v.circles()) cyl(cx, cz, v.radius, v.y || 0, (v.y || 0) + v.spec.height, 'car', v);
    }
    const pl = this.player;
    if (owner === 'cop' && !pl.vehicle && pl.mesh.visible && inBox(pl.x, pl.z)) cyl(pl.x, pl.z, 0.35, pl.y, pl.y + 1.85, 'player', pl);
    // the city: march along the segment
    const steps = Math.ceil(len / 0.8);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (best && t > best.t) break;
      const x = a.x + d.x * t, y = a.y + d.y * t, z = a.z + d.z * t;
      const floor = this.collision.levelAt(x, z, null, null, y) ?? 0;
      if (y < floor) {
        consider(t, 'ground');
        break;
      }
      if (this.collision.heightAt(x, z) > y) {
        consider(t, 'wall');
        break;
      }
      if (y < 3.5 && this.collision.isBlocked(x, z, 0)) {
        consider(t, 'wall');
        break;
      }
    }
    if (!best) return null;
    best.point = a.clone().addScaledVector(d, best.t);
    return best;
  }

  updateBullets(dt) {
    const tr = this.tracer.geometry.attributes.position.array;
    let nt = 0;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const a = b.p.clone();
      b.v.y -= GRAVITY * dt;
      b.p.addScaledVector(b.v, dt);
      b.life -= dt;
      const hit = this.segmentHit(a, b.p, b.owner);
      const tip = hit ? hit.point : b.p;
      // tracer: a short streak behind the bullet
      if (nt < 64) {
        const back = tip.clone().addScaledVector(b.v, -0.012);
        if (back.distanceToSquared(b.start) > tip.distanceToSquared(b.start)) back.copy(b.start);
        tr.set([back.x, back.y, back.z, tip.x, tip.y, tip.z], nt * 6);
        nt++;
      }
      if (hit) {
        this.impact(hit, b);
        this.bullets.splice(i, 1);
      } else if (b.life <= 0) this.bullets.splice(i, 1);
    }
    this.tracer.geometry.setDrawRange(0, nt * 2);
    this.tracer.geometry.attributes.position.needsUpdate = nt > 0;
    this.tracer.visible = nt > 0;
  }

  impact(hit, b) {
    const dir = b.v.clone().normalize();
    const push = (b.dmg / 30) * 2.2;
    if (hit.kind === 'ped' || hit.kind === 'cop' || hit.kind === 'player') {
      this.particles(hit.point, 7, [0.55, 0.03, 0.03], 2.2, dir);
      if (hit.kind === 'player') {
        const pl = this.player;
        pl.health -= b.dmg * 0.55;
        pl.lastHit = [dir.x * 4, dir.z * 4];
        this.ui.hurt.style.opacity = 1;
        clearTimeout(this.hurtT);
        this.hurtT = setTimeout(() => (this.ui.hurt.style.opacity = 0), 160);
      } else this.damagePerson(hit.target, b.dmg, dir.x * push, dir.z * push, hit.point, b.owner);
    } else if (hit.kind === 'car') {
      this.particles(hit.point, 6, [1, 0.85, 0.4], 4, dir.clone().negate());
      const v = hit.target;
      v.health = Math.max(0, v.health - b.dmg * 0.45);
      if (b.owner === 'player') {
        if (v.driver === 'police') this.onCrime('disparo a patrullero', 1);
        // a shot-at driver floors it
        const c = this.traffic.npc.get(v);
        if (c) c.cruise = 1.5;
      }
      if (v.health <= 0 && !v.wrecked) this.wreck(v);
    } else {
      // concrete dust or dirt
      this.particles(hit.point, 6, hit.kind === 'ground' ? [0.45, 0.4, 0.33] : [0.75, 0.73, 0.68], 2.5, dir.clone().negate());
      this.particles(hit.point, 2, [1, 0.8, 0.3], 5, dir.clone().negate());
    }
  }

  damagePerson(t, dmg, vx, vz, point, owner) {
    t.hp = (t.hp ?? (t.isCop ? 100 : 55)) - dmg;
    this.particles(point, 10, [0.5, 0.02, 0.02], 2, new THREE.Vector3(vx, 0.5, vz).normalize());
    if (t.hp > 0) {
      if (!t.isCop) this.peds.scare(t.x, t.z, 25);
      return;
    }
    this.blood(t.x, t.z);
    if (t.isCop) {
      t.dead = true;
      t.down = 0;
      t.vx = vx;
      t.vz = vz;
      if (owner === 'player') this.onCrime('mataste a un policía', 2);
    } else {
      this.peds.knockDown(t, vx, vz, 1.5);
      if (owner === 'player') {
        const cash = 300 + Math.floor(Math.random() * 4000);
        this.money += cash;
        this.hud.toast(`+${money(cash)}`);
        this.refreshHud();
        this.onCrime('homicidio', 1);
      }
    }
  }

  // a car shot to pieces: it dies, darkens and smokes
  wreck(v) {
    v.wrecked = true;
    if (v.driver === 'npc' || v.driver === 'bus') {
      v.driver = null;
      this.traffic.npc.delete(v);
    }
    v.mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.material = [].concat(o.material).map((m) => {
        const c = m.clone();
        c.color?.multiplyScalar(0.25);
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    v.smoke = 12;
    this.audio.thump?.(18);
    this.particles(new THREE.Vector3(v.x, 1, v.z), 30, [1, 0.55, 0.15], 6, new THREE.Vector3(0, 1, 0));
  }

  // ---------------------------------------------------------------- effects
  buildEffects() {
    // tracers
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    this.tracer = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracer.frustumCulled = false;
    this.scene.add(this.tracer);
    // particles: sparks, dust, blood, smoke
    const N = (this.pN = 700);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.pv = new Float32Array(N * 3);
    this.pl = new Float32Array(N);
    this.pi = 0;
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    // muzzle flash: one light that is always there (toggling lights recompiles shaders)
    this.light = new THREE.PointLight(0xffc56b, 0, 9, 2);
    this.scene.add(this.light);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd27a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flashSprite.scale.setScalar(0.45);
    this.flashSprite.visible = false;
    this.scene.add(this.flashSprite);
    // blood pools on the ground
    this.pools = new THREE.InstancedMesh(new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5a0606, transparent: true, opacity: 0.85, depthWrite: false }), 40);
    this.pools.count = 0;
    this.pools.renderOrder = -4;
    this.pools.frustumCulled = false;
    this.poolI = 0;
    this.scene.add(this.pools);
  }

  flash(at, dir) {
    this.light.position.copy(at).addScaledVector(dir, 0.3);
    this.light.intensity = 25;
    this.flashSprite.position.copy(this.light.position);
    this.flashSprite.visible = true;
    this.flashT = 0.05;
  }

  particles(at, n, col, speed, dir) {
    const pos = this.points.geometry.attributes.position.array, c = this.points.geometry.attributes.color.array;
    for (let k = 0; k < n; k++) {
      const i = this.pi;
      this.pi = (this.pi + 1) % this.pN;
      pos.set([at.x, at.y, at.z], i * 3);
      const r = () => (Math.random() - 0.5) * 2;
      this.pv.set([(dir.x + r() * 0.7) * speed * Math.random(), (dir.y + 0.4 + r() * 0.5) * speed * Math.random(), (dir.z + r() * 0.7) * speed * Math.random()], i * 3);
      const k2 = 0.8 + Math.random() * 0.4;
      c.set([col[0] * k2, col[1] * k2, col[2] * k2], i * 3);
      this.pl[i] = 0.4 + Math.random() * 0.5;
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  blood(x, z) {
    const m = new THREE.Matrix4().makeRotationY(Math.random() * 6).scale(new THREE.Vector3(0.6 + Math.random() * 0.8, 1, 0.6 + Math.random() * 0.8));
    m.setPosition(x, 0.075, z);
    this.pools.setMatrixAt(this.poolI, m);
    this.poolI = (this.poolI + 1) % 40;
    this.pools.count = Math.max(this.pools.count, this.poolI || 40);
    this.pools.instanceMatrix.needsUpdate = true;
  }

  updateEffects(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.light.intensity = 0;
        this.flashSprite.visible = false;
      }
    }
    const pos = this.points.geometry.attributes.position.array;
    let alive = false;
    for (let i = 0; i < this.pN; i++) {
      if (this.pl[i] <= 0) continue;
      alive = true;
      this.pl[i] -= dt;
      this.pv[i * 3 + 1] -= GRAVITY * dt;
      pos[i * 3] += this.pv[i * 3] * dt;
      pos[i * 3 + 1] = Math.max(0.05, pos[i * 3 + 1] + this.pv[i * 3 + 1] * dt);
      pos[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
      if (this.pl[i] <= 0) pos[i * 3 + 1] = -100; // gone
    }
    if (alive) this.points.geometry.attributes.position.needsUpdate = true;
    // wrecked cars smoke for a while
    for (const v of this.traffic.vehicles) {
      if (!(v.smoke > 0)) continue;
      v.smoke -= dt;
      if (Math.random() < dt * 25) this.particles(new THREE.Vector3(v.x, (v.y || 0) + 1.3, v.z), 1, [0.2, 0.2, 0.2], 1.5, new THREE.Vector3(0, 1.2, 0));
    }
  }

  // ---------------------------------------------------------------- police on foot
  // Officers step out of a patrol car that stops near the player on foot; with 2+
  // stars they shoot (pistol, shotgun at 3, submachine gun from 4).
  updateCops(dt, ctx) {
    const wanted = this.getWanted();
    const pl = this.player;
    const onFoot = !pl.vehicle && pl.mesh.visible;
    if (wanted > 0 && onFoot && this.cops.filter((c) => !c.dead).length < MAX_COPS) {
      for (const v of this.traffic.vehicles) {
        // stopped near enough (they can't always park right next to you): out on foot
        if (v.driver !== 'police' || v.copsOut || Math.abs(v.speed) > 3) continue;
        if (Math.hypot(v.x - pl.x, v.z - pl.z) > 65) continue;
        v.copsOut = true;
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
        for (const s of [-1, 1]) this.spawnCop(v.x - fz * s * 1.4, v.z + fx * s * 1.4, wanted);
      }
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = Math.hypot(pl.x - c.x, pl.z - c.z);
      if (c.dead) {
        c.down = Math.min(1, (c.down || 0) + dt * 3);
        c.x += c.vx * dt * (1 - c.down);
        c.z += c.vz * dt * (1 - c.down);
        animatePerson(c.mesh, dt, { down: true, downAir: c.down < 0.6 });
        c.mesh.position.set(c.x, 0.1 * c.down, c.z);
        c.mesh.rotation.set(-Math.PI / 2 * c.down * 0.95, c.heading, 0);
        if ((c.gone = (c.gone || 0) + dt) > 30 || d > 220) this.removeCop(i);
        continue;
      }
      if (d > 220 || (wanted === 0 && d > 50)) {
        this.removeCop(i);
        continue;
      }
      let speed = 0;
      const want = Math.atan2(pl.x - c.x, pl.z - c.z);
      const w = WEAPONS[c.weapon];
      const shoot = wanted >= 2 && onFoot && d < (c.weapon === 'shotgun' ? 26 : 55) && ctx.alive;
      const see = shoot && this.lineOfSight(c, pl);
      if (wanted > 0 && (!see || d > (c.weapon === 'shotgun' ? 12 : 18))) {
        // run after the player (straight, sliding along walls)
        speed = wanted >= 2 ? 4.2 : 3.4;
        c.heading += wrap(want - c.heading) * Math.min(1, dt * 6);
        c.x += Math.sin(c.heading) * speed * dt;
        c.z += Math.cos(c.heading) * speed * dt;
        const r = this.collision.resolve(c.x, c.z, 0.33, 'platform');
        c.x = r.x;
        c.z = r.z;
      } else c.heading += wrap(want - c.heading) * Math.min(1, dt * 8);
      // keep the officers apart
      for (const o of this.cops) {
        if (o === c || o.dead) continue;
        const dx = c.x - o.x, dz = c.z - o.z, l = Math.hypot(dx, dz);
        if (l < 0.8 && l > 1e-3) {
          c.x += (dx / l) * (0.8 - l) * 0.5;
          c.z += (dz / l) * (0.8 - l) * 0.5;
        }
      }
      // at arm's length with 1 star: handcuffs (main.js counts it as busted)
      c.close = wanted === 1 && d < 2.2;
      c.cool -= dt;
      if (see && c.cool <= 0) {
        c.cool = w.rate * (c.weapon === 'smg' ? 1.6 : 2.4) + Math.random() * 0.6;
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        const muzzle = new THREE.Vector3(c.x + fx * 0.6, 1.38, c.z + fz * 0.6);
        // they lead a moving target badly and miss more from afar
        const target = new THREE.Vector3(pl.x, pl.y + 1.1 + (Math.random() - 0.5) * 0.6, pl.z);
        const dir = target.sub(muzzle).normalize();
        this.fire(muzzle, dir, w, 'cop', w.spread * 1.5 + d * 0.0016);
        c.burst = c.weapon === 'smg' ? 3 : 0;
      }
      animatePerson(c.mesh, dt, { speed });
      if (see) aimPose(c.mesh, c.weapon, 0, 1);
      c.mesh.position.set(c.x, c.lev || 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
  }

  lineOfSight(c, pl) {
    const a = new THREE.Vector3(c.x, 1.45, c.z), b = new THREE.Vector3(pl.x, pl.y + 1.3, pl.z);
    const d = b.clone().sub(a), len = d.length(), steps = Math.ceil(len / 1.5);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.collision.heightAt(a.x + d.x * t, a.z + d.z * t) > a.y + d.y * t) return false;
    }
    return true;
  }

  spawnCop(x, z, wanted) {
    const r = this.collision.resolve(x, z, 0.35);
    const mesh = createPersonMesh({
      age: 'adult', fem: Math.random() < 0.25, shirt: 0x8fb8d8, pants: 0x1b2a4a, longSleeves: true, pattern: null,
      hair: 'cap', capColor: 0x16233d, backpack: false, bag: false, mate: false, shorts: false, shoes: 0x111111, sole: 0x111111, beard: false, glasses: false,
    });
    const weapon = wanted >= 4 ? 'smg' : wanted >= 3 ? 'shotgun' : 'pistol';
    mesh.userData.rig.elR.add(weaponMesh(weapon));
    this.scene.add(mesh);
    this.cops.push({ isCop: true, mesh, x: r.x, z: r.z, heading: 0, weapon, cool: 1 + Math.random(), hp: 100 });
  }

  removeCop(i) {
    const c = this.cops[i];
    this.scene.remove(c.mesh);
    disposePerson(c.mesh);
    this.cops.splice(i, 1);
  }

  clearCops() {
    for (let i = this.cops.length - 1; i >= 0; i--) this.removeCop(i);
    for (const v of this.traffic.vehicles) v.copsOut = false;
  }

  // a cop at arm's length (with one star): main.js turns it into BUSTED
  get arresting() {
    return this.cops.some((c) => !c.dead && c.close);
  }

  // ---------------------------------------------------------------- per frame
  // ctx: { onFoot, alive }
  update(dt, ctx) {
    this.updateBullets(dt);
    this.updateEffects(dt);
    this.updateCops(dt, ctx);
    for (const m of this.markers) m.children[1].rotation.y += dt * 1.6;
    // the weapon in hand: hidden in vehicles, arms up while aiming
    if (this.held) this.held.visible = ctx.onFoot;
    if (ctx.onFoot && this.current) {
      const w = WEAPONS[this.current];
      aimPose(this.player.mesh, this.current, -(ctx.camPitch - 0.28) * 0.8, this.aiming || (w.melee && this.cooldown > 0) ? 1 : w.melee ? 0 : 0.35);
    }
  }
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

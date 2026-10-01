// Storefront design kit: gastronomy styles (from the business name) with their own
// facade, 3D street furniture and blade signs, plus blade-sign icons for other rubros.
import * as THREE from 'three';
import { mulberry32 } from './geo.js';
import { GeoBuf, instancedChunks, mergeSimple, stripeTexture } from './builder.js';

// ------------------------------------------------ gastronomy styles
const SUB_RULES = [
  ['sushi', /sushi|nikkei|meishi|japon|ramen|wok/],
  ['heladeria', /helad|grido|gelat|freddo|ice roll/],
  ['parrilla', /parrill|asador|brasas|gaucho|estancia|kamado|campo|chorip|costill/],
  ['pizzeria', /pizz|napolitan|horneria|focacc|empanad|la masa/],
  ['italiano', /ristorante|pasta|tavola|trattor|tanita|cappott|fiore|italian|bini/],
  ['cerveceria', /cervec|brewing|beer|birr|antares|garage|jard[ií]n|lupulo/],
  ['burger', /burger|hamburg|papas|mostrador/],
  ['cafe', /caf[eé]|bakery|boulanger|chocolat|crepe|panader|confiter|medialun|tea\b/],
  ['bodegon', /bodeg|cantina|taberna|gallegos|almac[eé]n|carlitos|del viejo|club|colonial|abuel/],
  ['bar', /\bbar\b|wine|vinsanto|barric|pub|mexican|lupita|tapas/],
];
const SUB_BY_KIND = { cafe: 'cafe', ice_cream: 'heladeria', fast_food: 'burger', pub: 'cerveceria', biergarten: 'cerveceria', bar: 'bar', bakery: 'cafe', pastry: 'cafe', confectionery: 'cafe' };
export function foodSub(shop) {
  const s = shop.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const [sub, re] of SUB_RULES) if (re.test(s)) return sub;
  return SUB_BY_KIND[shop.kind] || 'resto';
}

// sign color, awning/canopy, and which props each style gets
export const FOOD = {
  parrilla: { label: 'Parrilla', sign: '#5a2e17', canopy: 0x3b2416, props: ['chimney', 'wallLamps', 'barrels'], icon: 'flame' },
  bodegon: { label: 'Bodegón', sign: '#6b1f1f', canopy: 0x2a1d14, props: ['wallLamps', 'chalkboard'], icon: 'fork' },
  pizzeria: { label: 'Pizzería', sign: '#b3261e', awning: ['#b3261e'], props: ['tables', 'chalkboard'], icon: 'pizza' },
  italiano: { label: 'Cocina italiana', sign: '#1e5e33', awning: 'italia', props: ['planters', 'tables'], icon: 'pasta' },
  cerveceria: { label: 'Cervecería', sign: '#2b1d12', canopy: 0x1a1a1a, props: ['barrels', 'bulbs'], icon: 'beer' },
  sushi: { label: 'Sushi', sign: '#1a1a1a', canopy: 0x1a1a1a, props: ['lanterns', 'noren', 'planters'], icon: 'sushi' },
  burger: { label: 'Hamburguesería', sign: '#d9901a', canopy: 0x111111, props: [], icon: 'burger' },
  cafe: { label: 'Café', sign: '#6b4a2f', awning: ['#2f4f3a', '#1f5f9e', '#6b4a2f'], props: ['umbrellas', 'planters'], icon: 'cup' },
  heladeria: { label: 'Heladería', sign: '#c2477a', awning: ['#c2477a', '#3aa7a3'], props: ['umbrellas'], icon: 'cone' },
  bar: { label: 'Bar', sign: '#151515', canopy: 0x151515, props: ['bulbs', 'tables'], icon: 'wine' },
  resto: { label: 'Restaurante', sign: '#7a2b1f', awning: ['#7a1f1f', '#2f4f3a', '#b3261e', '#1f5f9e'], props: ['tables', 'chalkboard'], icon: 'fork' },
};
// blade-sign icons for the other rubros (farmacia keeps its green cross)
export const RUBRO_ICON = { kiosco: 'candy', ferreteria: 'hammer', ropa: 'hanger', tecno: 'phone', almacen: 'cart', banco: 'coin', taller: 'wrench', hotel: 'bed', hogar: 'sofa', flores: 'flower', libreria: 'book', boliche: 'disco', super: 'cart' };
// extra street furniture for non-food rubros
const RUBRO_EXTRA = { hotel: { canopy: 0x1b1b1b, props: ['planters'] }, flores: { props: ['flowers'] }, boliche: { canopy: 0x0b0b0b, props: ['vallas'] } };

// ------------------------------------------------ facades (256 px tile = 4 m x 3.8 m)
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
function bricks(ctx, x, y, w, h, base, rng) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let r = 0, yy = y; yy < y + h; yy += 9, r++) {
    ctx.fillRect(x, yy, w, 1.5);
    for (let xx = x + (r % 2) * 10; xx < x + w; xx += 20) ctx.fillRect(xx, yy, 1.5, 9);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '255,220,190' : '60,20,10'},0.12)`;
    ctx.fillRect(x + rng() * w, y + rng() * h, 18, 7);
  }
}
function tiles(ctx, x, y, w, h, a, b) {
  for (let yy = y, r = 0; yy < y + h; yy += 12, r++) for (let xx = x, c = 0; xx < x + w; xx += 12, c++) {
    ctx.fillStyle = (r + c) % 2 ? a : b;
    ctx.fillRect(xx, yy, 12, 12);
  }
}
function win(ctx, ectx, x, y, w, h, tint, lit) {
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ectx.fillStyle = lit;
  ectx.fillRect(x, y, w, h);
}
function glare(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w * 0.35, y);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.25, y + h);
  ctx.fill();
}
function frameRect(ctx, x, y, w, h, color, t = 5) {
  ctx.fillStyle = color;
  ctx.fillRect(x - t, y - t, w + t * 2, t);
  ctx.fillRect(x - t, y + h, w + t * 2, t);
  ctx.fillRect(x - t, y, t, h);
  ctx.fillRect(x + w, y, t, h);
}
function table(ctx, x, y, cloth) {
  ctx.fillStyle = cloth;
  ctx.fillRect(x, y, 36, 7);
  ctx.fillStyle = 'rgba(30,15,5,0.7)';
  ctx.fillRect(x + 16, y + 7, 4, 28);
  ctx.beginPath();
  ctx.arc(x + 4, y - 16, 8, 0, Math.PI * 2);
  ctx.arc(x + 32, y - 14, 8, 0, Math.PI * 2);
  ctx.fill();
}
function bottles(ctx, x, y, w, rows, rng, colors) {
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(90,60,30,0.9)';
    ctx.fillRect(x, y + r * 24 + 20, w, 3);
    for (let xx = x + 3; xx < x + w - 6; xx += 7) {
      ctx.fillStyle = pick(rng, colors);
      ctx.fillRect(xx, y + r * 24 + 4, 5, 16);
      ctx.fillRect(xx + 1.5, y + r * 24, 2, 5);
    }
  }
}
// Shared layout: fascia on top, window left, door right, zócalo under the window.
function front(ctx, ectx, x, S, o) {
  if (o.brick) bricks(ctx, x, 0, S, S, o.wall, o.rng);
  else {
    ctx.fillStyle = o.wall;
    ctx.fillRect(x, 0, S, S);
  }
  ctx.fillStyle = o.fascia;
  ctx.fillRect(x, 0, S, 54);
  win(ctx, ectx, x + 14, 72, 146, 128, o.tint, o.lit);
  o.interior?.(ctx, ectx, x + 14, 72, 146, 128);
  glare(ctx, x + 14, 72, 146, 128);
  frameRect(ctx, x + 14, 72, 146, 128, o.frame);
  if (o.zocalo) o.zocalo(ctx, x + 9, 205, 156, 51);
  else {
    ctx.fillStyle = o.frame;
    ctx.fillRect(x + 9, 205, 156, 51);
  }
  win(ctx, ectx, x + 180, 76, 62, 180, o.tint, o.lit);
  glare(ctx, x + 180, 76, 62, 180);
  frameRect(ctx, x + 180, 76, 62, 180, o.door || o.frame, 6);
  ctx.fillStyle = '#c9b27a';
  ctx.fillRect(x + 232, 160, 4, 22);
}
const FACADE = {
  parrilla: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, brick: true, wall: pick(rng, ['#8a3b24', '#7a3420', '#9a4a2c']), fascia: '#3b2416', frame: '#3b2416', tint: '#2a140a', lit: '#ff9a3c',
    interior(c, e, x0, y0, w, h) {
      // la parrilla con brasas y la carne
      const g = c.createLinearGradient(0, y0 + h - 40, 0, y0 + h);
      g.addColorStop(0, '#ff7a1a');
      g.addColorStop(1, '#ffd23c');
      c.fillStyle = g;
      c.fillRect(x0 + 10, y0 + h - 40, w - 20, 34);
      e.fillStyle = '#ffb040';
      e.fillRect(x0 + 10, y0 + h - 40, w - 20, 34);
      c.fillStyle = '#222';
      for (let xx = x0 + 12; xx < x0 + w - 12; xx += 8) c.fillRect(xx, y0 + h - 46, 2, 10);
      c.fillRect(x0 + 10, y0 + h - 48, w - 20, 3);
      c.fillStyle = '#6b2a10';
      for (let i = 0; i < 6; i++) c.fillRect(x0 + 18 + i * 21, y0 + h - 56, 16, 9);
    },
    zocalo: (c, x0, y0, w, h) => bricks(c, x0, y0, w, h, '#5c2716', rng),
  }),
  bodegon: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#e8dcc0', '#d9c9a3', '#efe6cf']), fascia: '#6b1f1f', frame: '#4a2a17', tint: '#3a2416', lit: '#ffcf8a',
    interior(c, e, x0, y0, w) {
      bottles(c, x0 + 6, y0 + 6, w - 12, 2, rng, ['#2c4a1e', '#5a1414', '#1f3b2a', '#3a2a10']);
      for (const tx of [x0 + 18, x0 + 88]) table(c, tx, y0 + 98, '#c62828');
    },
    zocalo: (c, x0, y0, w, h) => tiles(c, x0, y0, w, h, '#1d4f8a', '#f4f0e6'),
  }),
  pizzeria: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: '#f4efe6', fascia: '#b3261e', frame: '#2b2b2b', tint: '#3a2418', lit: '#ffb36a',
    interior(c, e, x0, y0, w, h) {
      // horno de barro con el fuego
      c.fillStyle = '#9a4a2c';
      c.beginPath();
      c.arc(x0 + w / 2, y0 + h - 10, 52, Math.PI, 0);
      c.fill();
      c.fillStyle = '#1a0d06';
      c.beginPath();
      c.arc(x0 + w / 2, y0 + h - 10, 26, Math.PI, 0);
      c.fill();
      c.fillStyle = '#ff8a1e';
      c.fillRect(x0 + w / 2 - 18, y0 + h - 24, 36, 12);
      e.fillStyle = '#ff9a2a';
      e.fillRect(x0 + w / 2 - 26, y0 + h - 36, 52, 26);
    },
    zocalo: (c, x0, y0, w, h) => tiles(c, x0, y0, w, h, '#b3261e', '#f4f0e6'),
  }),
  italiano: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#e9dcc4', '#f1e6d0', '#d8c7a8']), fascia: '#1e5e33', frame: '#1e5e33', tint: '#3a2a1c', lit: '#ffd08f',
    interior(c, e, x0, y0, w) {
      for (const tx of [x0 + 16, x0 + 86]) table(c, tx, y0 + 96, '#f4f4f4');
      c.fillStyle = '#3f7a2f';
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(x0 + 16 + i * 28, y0 + 14, 9, 0, Math.PI * 2);
        c.fill();
      }
    },
  }),
  cerveceria: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, brick: rng() < 0.5, wall: pick(rng, ['#2b2b2b', '#4a3626', '#6b3a22']), fascia: '#111', frame: '#111', tint: '#22160c', lit: '#ffc24a',
    interior(c, e, x0, y0, w) {
      // pizarra con las variedades y las canillas
      c.fillStyle = '#1b1f1b';
      c.fillRect(x0 + 10, y0 + 8, w - 20, 44);
      c.fillStyle = '#e8e8d8';
      for (let i = 0; i < 4; i++) c.fillRect(x0 + 18, y0 + 14 + i * 9, 40 + (i * 23) % 60, 3);
      c.fillStyle = '#c0c4c8';
      for (let xx = x0 + 16; xx < x0 + w - 12; xx += 14) c.fillRect(xx, y0 + 62, 5, 18);
      c.fillStyle = '#5a3a1e';
      c.fillRect(x0 + 6, y0 + 80, w - 12, 10);
    },
  }),
  sushi: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#2b2622', '#3a2e24']), fascia: '#111', frame: '#5a3e26', door: '#5a3e26', tint: '#2a1a12', lit: '#ffd9a0',
    interior(c, e, x0, y0, w) {
      c.fillStyle = '#6b4a2f';
      c.fillRect(x0 + 6, y0 + 80, w - 12, 12);
      for (let i = 0; i < 8; i++) {
        c.fillStyle = '#f4f4f4';
        c.beginPath();
        c.arc(x0 + 16 + i * 16, y0 + 74, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#e8613a';
        c.beginPath();
        c.arc(x0 + 16 + i * 16, y0 + 74, 3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#c62828';
      c.beginPath();
      c.arc(x0 + w / 2, y0 + 30, 16, 0, Math.PI * 2);
      c.fill();
    },
    zocalo: (c, x0, y0, w, h) => { c.fillStyle = '#5a3e26'; c.fillRect(x0, y0, w, h); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let xx = x0; xx < x0 + w; xx += 10) c.fillRect(xx, y0, 2, h); },
  }),
  burger: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#151515', '#2b2b2b']), fascia: '#d9901a', frame: '#d9901a', tint: '#2a1a10', lit: '#ffe1a0',
    interior(c, e, x0, y0, w) {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = ['#d9901a', '#c62828', '#f4f4f4'][i];
        c.fillRect(x0 + 10 + i * 46, y0 + 8, 40, 30);
        e.fillStyle = '#fff2c0';
        e.fillRect(x0 + 10 + i * 46, y0 + 8, 40, 30);
      }
      c.fillStyle = '#777';
      c.fillRect(x0 + 6, y0 + 86, w - 12, 10);
    },
  }),
  cafe: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#f4ece0', '#e6efe9', '#f3e1e4', '#efe7d6']), fascia: '#6b4a2f', frame: '#3a2a1c', tint: '#3a2a20', lit: '#ffe4b8',
    interior(c, e, x0, y0, w) {
      // vitrina con medialunas y tortas, la cafetera
      c.fillStyle = '#e8e2d6';
      c.fillRect(x0 + 8, y0 + 78, w - 16, 26);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = pick(rng, ['#c88a3e', '#8a4a20', '#f0d9a8', '#c2477a']);
        c.beginPath();
        c.ellipse(x0 + 18 + i * 14, y0 + 88, 6, 4, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#9aa0a6';
      c.fillRect(x0 + w - 44, y0 + 40, 30, 34);
    },
  }),
  heladeria: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#fde3ee', '#e0f4f2', '#fff4d6']), fascia: '#c2477a', frame: '#f4f4f4', tint: '#e8f0f2', lit: '#ffffff',
    interior(c, e, x0, y0, w) {
      // la vitrina de gustos
      c.fillStyle = '#c9d6dc';
      c.fillRect(x0 + 6, y0 + 74, w - 12, 34);
      for (let i = 0; i < 10; i++) {
        c.fillStyle = pick(rng, ['#f8bbd0', '#5d4037', '#fff59d', '#a5d6a7', '#ffcc80', '#ce93d8', '#ffffff', '#ef9a9a']);
        c.fillRect(x0 + 10 + i * 13, y0 + 80, 11, 14);
      }
    },
  }),
  bar: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#1b1b1b', '#2a1f2b', '#1f2a2b']), fascia: '#000', frame: '#000', tint: '#160f1a', lit: '#ff9ad0',
    interior(c, e, x0, y0, w) {
      bottles(c, x0 + 8, y0 + 8, w - 16, 3, rng, ['#e0a526', '#5ad1e8', '#e85a9a', '#9be85a', '#f4f4f4']);
      e.fillStyle = '#ff7ac0';
      e.fillRect(x0 + 8, y0 + 4, w - 16, 3);
    },
  }),
  resto: (ctx, ectx, x, S, rng) => front(ctx, ectx, x, S, {
    rng, wall: pick(rng, ['#6b4a2f', '#e8dcc2', '#7a2b1f', '#d9d2c4']), fascia: '#2a1d14', frame: '#3a2618', tint: '#4a3326', lit: '#ffc27a',
    interior(c, e, x0, y0) {
      for (const tx of [x0 + 18, x0 + 88]) table(c, tx, y0 + 96, '#f4f4f4');
    },
  }),
};

export function foodFacadeMaterial(sub) {
  const S = 256;
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = e.width = S * 4;
  c.height = e.height = S;
  const ctx = c.getContext('2d'), ectx = e.getContext('2d');
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S * 4, S);
  const rng = mulberry32(sub.length * 131 + 7);
  for (let k = 0; k < 4; k++) FACADE[sub](ctx, ectx, k * S, S, rng);
  const map = new THREE.CanvasTexture(c), emissiveMap = new THREE.CanvasTexture(e);
  map.colorSpace = emissiveMap.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffe2b0, emissiveIntensity: 0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 });
}

// ------------------------------------------------ blade-sign icons
const ICON = {
  flame(c) { c.beginPath(); c.moveTo(64, 18); c.bezierCurveTo(96, 50, 100, 80, 64, 108); c.bezierCurveTo(28, 80, 36, 56, 52, 40); c.bezierCurveTo(54, 60, 62, 64, 64, 18); c.fill(); },
  fork(c) { c.fillRect(40, 20, 6, 88); for (const x of [30, 40, 50]) c.fillRect(x, 20, 4, 26); c.fillRect(30, 44, 24, 6); c.beginPath(); c.ellipse(84, 44, 10, 26, 0, 0, Math.PI * 2); c.fill(); c.fillRect(80, 60, 8, 48); },
  pizza(c) { c.beginPath(); c.moveTo(24, 30); c.lineTo(104, 30); c.lineTo(64, 108); c.fill(); c.fillStyle = 'rgba(0,0,0,0.35)'; for (const [x, y] of [[50, 48], [76, 50], [64, 74]]) { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); } },
  pasta(c) { c.beginPath(); c.arc(64, 70, 38, 0, Math.PI); c.fill(); c.lineWidth = 4; c.strokeStyle = c.fillStyle; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(64, 70, 14 + i * 6, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } },
  beer(c) { c.fillRect(36, 34, 46, 70); c.lineWidth = 8; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(84, 66, 14, -Math.PI / 2, Math.PI / 2); c.stroke(); c.beginPath(); c.arc(46, 32, 12, 0, Math.PI * 2); c.arc(66, 28, 12, 0, Math.PI * 2); c.fill(); },
  sushi(c) { c.beginPath(); c.arc(64, 64, 40, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(64, 64, 30, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e8613a'; c.beginPath(); c.arc(64, 64, 14, 0, Math.PI * 2); c.fill(); },
  burger(c) { c.beginPath(); c.ellipse(64, 46, 40, 20, 0, Math.PI, 0); c.fill(); c.fillRect(24, 54, 80, 10); c.fillRect(22, 68, 84, 12); c.fillRect(26, 84, 76, 14); },
  cup(c) { c.fillRect(32, 50, 50, 46); c.lineWidth = 7; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(84, 70, 12, -Math.PI / 2, Math.PI / 2); c.stroke(); c.fillRect(26, 98, 64, 6); for (const x of [44, 58, 72]) c.fillRect(x, 24, 4, 18); },
  cone(c) { c.beginPath(); c.moveTo(42, 60); c.lineTo(86, 60); c.lineTo(64, 112); c.fill(); for (const [x, y] of [[50, 50], [78, 50], [64, 32]]) { c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.fill(); } },
  wine(c) { c.beginPath(); c.moveTo(38, 22); c.lineTo(90, 22); c.quadraticCurveTo(90, 70, 64, 72); c.quadraticCurveTo(38, 70, 38, 22); c.fill(); c.fillRect(61, 70, 6, 30); c.fillRect(44, 98, 40, 6); },
  candy(c) { c.beginPath(); c.arc(64, 64, 24, 0, Math.PI * 2); c.fill(); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(64 + s * 22, 64); c.lineTo(64 + s * 52, 44); c.lineTo(64 + s * 52, 84); c.fill(); } },
  hammer(c) { c.save(); c.translate(64, 64); c.rotate(-0.6); c.fillRect(-6, -10, 12, 60); c.fillRect(-30, -34, 60, 24); c.restore(); },
  hanger(c) { c.lineWidth = 8; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(16, 92); c.lineTo(64, 56); c.lineTo(112, 92); c.closePath(); c.stroke(); c.beginPath(); c.arc(64, 40, 12, Math.PI, Math.PI * 2.5); c.stroke(); },
  phone(c) { c.fillRect(42, 16, 44, 96); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(48, 26, 32, 70); },
  cart(c) { c.fillRect(26, 40, 70, 36); c.fillRect(14, 30, 18, 6); c.beginPath(); c.arc(40, 92, 9, 0, Math.PI * 2); c.arc(84, 92, 9, 0, Math.PI * 2); c.fill(); },
  coin(c) { c.beginPath(); c.arc(64, 64, 40, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(0,0,0,0.4)'; c.font = 'bold 56px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 64, 66); },
  disco(c) {
    c.beginPath(); c.arc(64, 70, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = -3; i <= 3; i++) { c.fillRect(30, 70 + i * 9, 68, 2); c.fillRect(64 + i * 9, 36, 2, 68); }
    c.fillStyle = '#fff'; c.fillRect(62, 14, 4, 24);
  },
  bed(c) { c.fillRect(18, 62, 92, 22); c.fillRect(18, 84, 8, 22); c.fillRect(102, 84, 8, 22); c.fillRect(18, 40, 8, 30); c.beginPath(); c.ellipse(42, 56, 14, 8, 0, 0, Math.PI * 2); c.fill(); },
  sofa(c) { c.fillRect(22, 58, 84, 30); c.fillRect(14, 50, 16, 40); c.fillRect(98, 50, 16, 40); c.fillRect(22, 40, 84, 20); c.fillRect(22, 88, 8, 12); c.fillRect(98, 88, 8, 12); },
  flower(c) { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.arc(64 + Math.cos(a) * 20, 52 + Math.sin(a) * 20, 13, 0, Math.PI * 2); c.fill(); } c.fillRect(61, 70, 6, 42); c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(64, 52, 10, 0, Math.PI * 2); c.fill(); },
  book(c) { c.beginPath(); c.moveTo(64, 36); c.lineTo(22, 26); c.lineTo(22, 96); c.lineTo(64, 106); c.lineTo(106, 96); c.lineTo(106, 26); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(62, 36, 4, 70); },
  wrench(c) { c.save(); c.translate(64, 64); c.rotate(0.8); c.fillRect(-7, -20, 14, 70); c.beginPath(); c.arc(0, -30, 20, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-6, -52, 12, 24); c.restore(); },
};
function iconMaterial(icon, bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = '#fff';
  ICON[icon](ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 });
}

function canvasMaterial(w, h, draw, extra = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, ...extra });
}

// ------------------------------------------------ 3D street furniture
// placed: shopfronts from shops.js ({ rubro, sub, shop, x, z, ux, uz, ox, oz, w, h, room, roof }).
export function buildShopKit(root, placed, { graph, collision, nightMaterials }) {
  const q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0);
  // items: [x, z, y, yaw, sx]
  const place = (m, [x, z, y, yaw, sx = 1]) => m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(yAxis, yaw), new THREE.Vector3(sx, 1, 1));
  const at = (p, along, out, y = 0) => [p.x + p.ux * along + p.ox * out, p.z + p.uz * along + p.oz * out, y, Math.atan2(p.ox, p.oz)];
  const free = (t, margin = 0.8) => {
    const n = graph.nearest(t[0], t[1], 20);
    return !n || n.dist > n.seg.road.w / 2 + margin;
  };
  const block = (t, r) => collision.addCircle(t[0], t[1], r, 'pole');
  const rng = mulberry32(17);
  const L = { vallas: [], flowers: [], blades: new Map(), awnings: new Map(), canopies: new Map(), tables: [], umbrellas: [], barrels: [], lamps: [], lanterns: [], noren: [], chalk: [], planters: [], bulbs: [], chimneys: [] };
  const push = (map, key, item) => (map.get(key) || map.set(key, []).get(key)).push(item);

  for (const p of placed) {
    const style = p.rubro === 'comida' ? FOOD[p.sub] : RUBRO_EXTRA[p.rubro];
    const icon = style?.icon || RUBRO_ICON[p.rubro];
    const bg = p.signColor;
    // bandera: blade sign at the edge of the storefront, over the sidewalk
    if (icon) push(L.blades, `${icon}|${bg}`, at(p, p.w / 2 - 0.3, 0.55, Math.min(p.h - 1.1, 2.9)));
    if (!style) continue;
    const props = new Set(style.props);
    const awningY = p.h - 0.8;
    if (style.awning) {
      const key = style.awning === 'italia' ? 'italia' : pick(rng, style.awning);
      push(L.awnings, key, [...at(p, 0, 0, awningY), p.w - 0.3]);
    } else if (style.canopy !== undefined) {
      push(L.canopies, style.canopy, [...at(p, 0, 0.5, awningY), p.w - 0.2]);
    }
    if (props.has('chimney') && p.roof) L.chimneys.push(at(p, -p.w / 4, -1.4, p.roof));
    if (props.has('wallLamps')) for (const s of [-1, 1]) L.lamps.push(at(p, s * (p.w / 2 - 0.25), 0.2, 2.3));
    if (props.has('lanterns')) for (const s of [-1, 1]) L.lanterns.push(at(p, s * (p.w / 2 - 0.6), 0.45, Math.min(2.6, awningY - 0.5)));
    if (props.has('noren')) L.noren.push([...at(p, -0.32 * p.w, 0.07, 2.5), 1]);
    if (props.has('bulbs')) for (let j = 0; j < 6; j++) L.bulbs.push(at(p, (j / 5 - 0.5) * (p.w - 0.8), 0.9, awningY - 0.15));
    if (props.has('planters') && p.room > 1.6) {
      for (const s of [-1, 1]) {
        const t = at(p, s * (p.w / 2 - 0.55), 0.3);
        if (free(t)) { L.planters.push(t); block(t, 0.4); }
      }
    }
    if (props.has('vallas') && p.room > 2) {
      // vallas con cordón rojo marking the line at the door
      const t = at(p, 0, 1.3);
      if (free(t)) { L.vallas.push([...t, 1]); block(t, 0.3); }
    }
    if (props.has('flowers') && p.room > 1.8) {
      for (let j = 0; j < 4; j++) {
        const t = at(p, -p.w / 2 + 0.5 + j * 0.55, 0.35);
        if (free(t)) L.flowers.push([...t, 1, j]);
      }
      block(at(p, -p.w / 2 + 1.3, 0.35), 0.7);
    }
    if (props.has('chalkboard') && p.room > 1.8) {
      const t = at(p, -0.32 * p.w + 1.1, 1.0);
      t[3] += 0.4;
      if (free(t)) { L.chalk.push(t); block(t, 0.35); }
    }
    const sidewalk = p.room > 2.6;
    if (sidewalk && (props.has('tables') || props.has('umbrellas') || props.has('barrels'))) {
      for (const along of p.w >= 5 ? [-p.w / 4 + 0.3, p.w / 4] : [0.4]) {
        const t = at(p, along, 1.45);
        if (!free(t)) continue;
        t[3] += rng() * 0.5;
        if (props.has('barrels')) L.barrels.push(t);
        else {
          L.tables.push(t);
          if (props.has('umbrellas')) L.umbrellas.push([...t.slice(0, 4), 1, pick(rng, ['#2f4f3a', '#c62828', '#f4f4f4', '#1f5f9e'])]);
        }
        block(t, 0.6);
      }
    }
  }

  // blades: iron arm + sign box with the icon on both faces
  const iron = new THREE.MeshStandardMaterial({ color: 0x1e2426, roughness: 0.5, metalness: 0.6 });
  const arm = new THREE.BoxGeometry(0.04, 0.04, 0.7).translate(0, 0.36, -0.2);
  const blade = new THREE.BoxGeometry(0.06, 0.62, 0.62);
  const glow = [];
  for (const [key, items] of L.blades) {
    const [icon, bg] = key.split('|');
    const mat = iconMaterial(icon, bg);
    glow.push([mat, 0.9]);
    instancedChunks(root, blade, mat, items, place, { range: 350 });
    instancedChunks(root, arm, iron, items, place, { range: 250 });
  }

  // awnings (striped; tricolor for the Italian ones) and flat canopies
  const awning = new GeoBuf();
  const W = new THREE.Color(1, 1, 1);
  awning.quad([-0.5, 0, 0], [0.5, 0, 0], [0.5, -0.5, 1.2], [-0.5, -0.5, 1.2], [0, 0], [1, 0], [1, 1], [0, 1], W, [0, 1, 0.4]);
  awning.quad([-0.5, -0.5, 1.2], [0.5, -0.5, 1.2], [0.5, -0.75, 1.2], [-0.5, -0.75, 1.2], [0, 0], [1, 0], [1, 1], [0, 1], W, [0, 0, 1]);
  const awningG = awning.geometry();
  for (const [key, items] of L.awnings) {
    const map = key === 'italia' ? tricolorTexture() : stripeTexture(key);
    instancedChunks(root, awningG, new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.9 }), items, place, { cast: true });
  }
  const canopyG = new THREE.BoxGeometry(1, 0.14, 1.1);
  for (const [color, items] of L.canopies) instancedChunks(root, canopyG, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 }), items, place, { cast: true });

  // tables + chairs, café umbrellas, beer barrels used as high tables
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5234, roughness: 0.85 });
  const tableG = mergeSimple([
    new THREE.CylinderGeometry(0.45, 0.45, 0.05, 12).translate(0, 0.74, 0),
    new THREE.CylinderGeometry(0.04, 0.04, 0.72, 5).translate(0, 0.36, 0),
    ...[-0.75, 0.75].flatMap((cx) => [
      new THREE.BoxGeometry(0.42, 0.45, 0.42).translate(cx, 0.225, 0),
      new THREE.BoxGeometry(0.06, 0.45, 0.42).translate(cx + Math.sign(cx) * 0.18, 0.67, 0),
    ]),
  ]);
  instancedChunks(root, tableG, wood, L.tables, place, { cast: true });
  const umbrellaG = mergeSimple([new THREE.CylinderGeometry(0.03, 0.03, 2.3, 5).translate(0, 1.15, 0), new THREE.ConeGeometry(1.3, 0.45, 8).translate(0, 2.35, 0)]);
  instancedChunks(root, umbrellaG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), L.umbrellas, place, { cast: true, color: (it) => new THREE.Color(it[5]) });
  const barrelG = new THREE.LatheGeometry([[0.26, 0], [0.33, 0.25], [0.35, 0.5], [0.33, 0.75], [0.26, 0.98], [0, 0.98]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
  instancedChunks(root, barrelG, canvasMaterial(64, 64, (c) => { c.fillStyle = '#6b4321'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#2a2a2a'; for (const y of [8, 30, 52]) c.fillRect(0, y, 64, 5); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < 64; x += 8) c.fillRect(x, 0, 1, 64); }), L.barrels, place, { cast: true });

  // wall lanterns, red paper lanterns, string lights: lit at night
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffb050, emissiveIntensity: 0 });
  const lampG = new THREE.BoxGeometry(0.18, 0.28, 0.18);
  instancedChunks(root, lampG, lampMat, L.lamps, place);
  instancedChunks(root, new THREE.BoxGeometry(0.03, 0.03, 0.22).translate(0, 0.16, -0.12), iron, L.lamps, place);
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xc62828, emissive: 0xff3a2a, emissiveIntensity: 0.15, roughness: 0.8 });
  instancedChunks(root, new THREE.CylinderGeometry(0.17, 0.17, 0.42, 10), lanternMat, L.lanterns, place);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffb050, emissiveIntensity: 0 });
  instancedChunks(root, new THREE.SphereGeometry(0.07, 6, 4), bulbMat, L.bulbs, place);

  // noren curtain over a sushi door
  const norenMat = canvasMaterial(128, 64, (c) => {
    c.fillStyle = '#1b2a4a';
    c.fillRect(0, 0, 128, 64);
    c.fillStyle = '#0b0f16';
    for (const x of [42, 85]) c.fillRect(x, 18, 2, 46);
    c.fillStyle = '#f4f4f4';
    c.beginPath();
    c.arc(64, 30, 12, 0, Math.PI * 2);
    c.fill();
  }, { side: THREE.DoubleSide });
  instancedChunks(root, new THREE.PlaneGeometry(1.2, 0.55), norenMat, L.noren, place);

  // pizarrón (A-frame chalkboard) with the menú del día
  const chalkMat = canvasMaterial(96, 128, (c) => {
    c.fillStyle = '#6b4a2f';
    c.fillRect(0, 0, 96, 128);
    c.fillStyle = '#1e2a22';
    c.fillRect(6, 6, 84, 116);
    c.fillStyle = '#f4f4e8';
    c.font = 'bold 15px Arial';
    c.textAlign = 'center';
    c.fillText('MENÚ', 48, 28);
    c.fillText('DEL DÍA', 48, 46);
    c.font = '11px Arial';
    for (let i = 0; i < 4; i++) c.fillRect(16, 62 + i * 14, 40 + (i * 17) % 24, 2);
  });
  const panel = (tilt) => new THREE.BoxGeometry(0.55, 0.85, 0.03).translate(0, 0.42, 0).applyMatrix4(new THREE.Matrix4().makeRotationAxis(xAxis, tilt)).translate(0, 0, tilt * 0.6);
  instancedChunks(root, mergeSimpleUV([panel(0.2), panel(-0.2)]), chalkMat, L.chalk, place, { cast: true });

  // maceteros con plantas
  instancedChunks(root, new THREE.BoxGeometry(0.85, 0.45, 0.38).translate(0, 0.225, 0), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 }), L.planters, place, { cast: true });
  instancedChunks(root, new THREE.IcosahedronGeometry(0.36, 0).scale(1.2, 0.8, 0.6).translate(0, 0.72, 0), new THREE.MeshStandardMaterial({ color: 0x3f7a2f, roughness: 0.9, flatShading: true }), L.planters, place, { cast: true });

  // vallas: two chrome posts and the red rope between them, along the facade
  const vallaG = mergeSimpleUV([
    ...[-1.4, 0, 1.4].flatMap((x) => [new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8).translate(x, 0.475, 0), new THREE.CylinderGeometry(0.16, 0.18, 0.05, 10).translate(x, 0.025, 0), new THREE.SphereGeometry(0.06, 8, 6).translate(x, 0.97, 0)]),
  ]);
  instancedChunks(root, vallaG, new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.25 }), L.vallas, (m, [x, z, y, yaw]) => m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(yAxis, yaw), new THREE.Vector3(1, 1, 1)), { cast: true });
  const ropeG = mergeSimpleUV([-0.7, 0.7].map((x) => new THREE.TorusGeometry(0.7, 0.03, 6, 16, Math.PI).rotateZ(Math.PI).scale(1, 0.3, 1).translate(x, 0.92, 0)));
  instancedChunks(root, ropeG, new THREE.MeshStandardMaterial({ color: 0xb3121f, roughness: 0.6 }), L.vallas, (m, [x, z, y, yaw]) => m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(yAxis, yaw), new THREE.Vector3(1, 1, 1)));

  // baldes de flores de la florería
  instancedChunks(root, new THREE.CylinderGeometry(0.2, 0.16, 0.4, 10).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.5, roughness: 0.4 }), L.flowers, place, { cast: true });
  const bloom = ['#e53935', '#f06292', '#fdd835', '#ffffff', '#ab47bc', '#ff7043'];
  instancedChunks(root, new THREE.IcosahedronGeometry(0.26, 0).scale(1, 0.8, 1).translate(0, 0.62, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), L.flowers, place, {
    cast: true, color: (it) => new THREE.Color(bloom[(it[5] * 7 + Math.round(it[0])) % bloom.length]),
  });

  // chimenea de ladrillo de la parrilla, on the roof
  const brickMat = canvasMaterial(64, 128, (c) => {
    c.fillStyle = '#8a3b24';
    c.fillRect(0, 0, 64, 128);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let r = 0, y = 0; y < 128; y += 8, r++) {
      c.fillRect(0, y, 64, 1.5);
      for (let x = (r % 2) * 8; x < 64; x += 16) c.fillRect(x, y, 1.5, 8);
    }
  });
  instancedChunks(root, mergeSimpleUV([new THREE.BoxGeometry(0.8, 1.8, 0.8).translate(0, 0.9, 0), new THREE.BoxGeometry(1, 0.15, 1).translate(0, 1.85, 0)]), brickMat, L.chimneys, place, { cast: true });

  return {
    setNight(n) {
      for (const [m, k] of glow) m.emissiveIntensity = n * k;
      lampMat.emissiveIntensity = n * 3.5;
      bulbMat.emissiveIntensity = n * 4;
      lanternMat.emissiveIntensity = 0.15 + n * 2.5;
    },
  };
}

// mergeSimple drops UVs; textured props need them
function mergeSimpleUV(geoms) {
  const pos = [], nor = [], uv = [];
  for (const g of geoms) {
    const gi = g.index ? g.toNonIndexed() : g;
    pos.push(...gi.attributes.position.array);
    nor.push(...gi.attributes.normal.array);
    uv.push(...gi.attributes.uv.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

function tricolorTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 4;
  const ctx = c.getContext('2d');
  ['#1e7a3a', '#f4efe4', '#c62828'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(i * 32, 0, 32, 4);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

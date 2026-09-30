// Canvas-generated textures. Facades are painted light/neutral so that per-building
// vertex colors can tint them (revoque, ladrillo, hormigón...). Each facade tile covers
// 2 bays x 2 floors (6 m x 6 m); each shopfront tile covers 4 m x 4 m.
import * as THREE from 'three';
import { mulberry32 } from './geo.js';
import { painters, groundFloor, groundTextures, atlasTexture, facadeArray, layerCanvas } from './conurbanoTextures.js';

const S = 256;

function canvas(w = S, h = S) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, renderer, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function noise(ctx, w, h, amount, rng, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rng() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
  }
}

// Facade tile with a 2x2 window layout. `draw(ctx, x, y, w, h)` paints one window
// cell, `lit` controls the emissive twin.
function facade(renderer, { base, drawWall, drawWindow, seed }) {
  const rng = mulberry32(seed);
  const [c, ctx] = canvas();
  const [e, ectx] = canvas();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  if (drawWall) drawWall(ctx, rng);
  noise(ctx, S, S, 2500, rng);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);
  const cell = S / 2;
  for (let fy = 0; fy < 2; fy++) {
    for (let bx = 0; bx < 2; bx++) {
      const lit = rng() < 0.45;
      drawWindow(ctx, bx * cell, fy * cell, cell, cell, rng, false);
      if (lit) drawWindow(ectx, bx * cell, fy * cell, cell, cell, rng, true);
    }
  }
  return { map: toTexture(c, renderer), emissive: toTexture(e, renderer), canvas: c, ecanvas: e };
}

function glowOrGlass(ctx, x, y, w, h, lit, rng) {
  if (lit) {
    const warm = rng() < 0.75;
    ctx.fillStyle = warm ? `hsl(${38 + rng() * 10},90%,${55 + rng() * 15}%)` : `hsl(200,60%,${60 + rng() * 15}%)`;
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#2c3a46');
    g.addColorStop(0.5, '#5d7385');
    g.addColorStop(1, '#27323b');
    ctx.fillStyle = g;
  }
  ctx.fillRect(x, y, w, h);
}

export function makeTextures(renderer) {
  const tex = {};

  // Casa de revoque: ventana con persiana de madera y reja.
  tex.house = facade(renderer, {
    seed: 1,
    base: '#f1ece2',
    drawWall(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, S / 2 - 6, S, 6); // floor cornice
      ctx.fillRect(0, S - 6, S, 6);
    },
    drawWindow(ctx, x, y, w, h, rng, lit) {
      const wx = x + w * 0.22, wy = y + h * 0.22, ww = w * 0.56, wh = h * 0.52;
      if (!lit) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 12);
      }
      const shutter = rng();
      glowOrGlass(ctx, wx, wy, ww, wh, lit, rng);
      if (lit) return;
      if (shutter < 0.45) {
        // persiana de enrollar parcialmente baja
        const down = wh * (0.3 + rng() * 0.7);
        ctx.fillStyle = '#b8b2a4';
        ctx.fillRect(wx, wy, ww, down);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let yy = wy; yy < wy + down; yy += 4) ctx.fillRect(wx, yy, ww, 1);
      }
      // reja
      ctx.strokeStyle = '#1d1d1d';
      ctx.lineWidth = 2;
      for (let xx = wx + 6; xx < wx + ww; xx += 9) {
        ctx.beginPath();
        ctx.moveTo(xx, wy);
        ctx.lineTo(xx, wy + wh);
        ctx.stroke();
      }
      ctx.strokeRect(wx, wy, ww, wh);
    },
  });

  // Ladrillo a la vista.
  tex.brick = facade(renderer, {
    seed: 2,
    base: '#b0643f',
    drawWall(ctx, rng) {
      const bh = 8, bw = 22;
      for (let y = 0; y < S; y += bh) {
        const off = (y / bh) % 2 ? bw / 2 : 0;
        for (let x = -bw; x < S; x += bw) {
          const l = 38 + rng() * 14;
          ctx.fillStyle = `hsl(${16 + rng() * 8},${45 + rng() * 15}%,${l}%)`;
          ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
        }
      }
      ctx.fillStyle = '#d8d2c4';
      ctx.fillRect(0, S / 2 - 8, S, 8); // concrete slab
      ctx.fillRect(0, S - 8, S, 8);
    },
    drawWindow(ctx, x, y, w, h, rng, lit) {
      const wx = x + w * 0.18, wy = y + h * 0.2, ww = w * 0.64, wh = h * 0.55;
      glowOrGlass(ctx, wx, wy, ww, wh, lit, rng);
      if (lit) return;
      ctx.strokeStyle = '#e8e6e0';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();
    },
  });

  // Edificio de departamentos con balcones.
  tex.apartments = facade(renderer, {
    seed: 3,
    base: '#e4e0d8',
    drawWindow(ctx, x, y, w, h, rng, lit) {
      const wx = x + w * 0.1, wy = y + h * 0.12, ww = w * 0.8, wh = h * 0.62;
      glowOrGlass(ctx, wx, wy, ww, wh, lit, rng);
      if (lit) return;
      if (rng() < 0.5) {
        ctx.fillStyle = '#9d9a90';
        ctx.fillRect(wx, wy, ww, wh * (0.2 + rng() * 0.6));
      }
      // balcony slab + railing
      ctx.fillStyle = '#cfcac0';
      ctx.fillRect(x, y + h * 0.74, w, h * 0.06);
      ctx.fillStyle = 'rgba(40,40,40,0.85)';
      ctx.fillRect(x + 2, y + h * 0.55, w - 4, 3);
      for (let xx = x + 4; xx < x + w; xx += 7) ctx.fillRect(xx, y + h * 0.55, 2, h * 0.19);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + h * 0.8, w, h * 0.04);
    },
  });

  // Oficinas / vidriado.
  tex.office = facade(renderer, {
    seed: 4,
    base: '#8a9aa6',
    drawWindow(ctx, x, y, w, h, rng, lit) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      if (lit) {
        ctx.fillStyle = rng() < 0.6 ? `hsl(45,60%,${62 + rng() * 15}%)` : `hsl(205,35%,${70 + rng() * 15}%)`;
        ctx.fillRect(x + 3, y + 3, w - 6, h * 0.8);
        return;
      }
      g.addColorStop(0, '#6e8699');
      g.addColorStop(1, '#2d3d4b');
      ctx.fillStyle = g;
      ctx.fillRect(x + 3, y + 3, w - 6, h * 0.8);
      ctx.fillStyle = '#4b5963';
      ctx.fillRect(x, y + h * 0.84, w, h * 0.16);
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
    },
  });

  // Iglesia / edificio histórico.
  tex.church = facade(renderer, {
    seed: 5,
    base: '#e9e0cc',
    drawWall(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < S; y += 16) ctx.fillRect(0, y, S, 1);
      ctx.fillRect(0, S - 18, S, 18);
    },
    drawWindow(ctx, x, y, w, h, rng, lit) {
      const wx = x + w * 0.32, wy = y + h * 0.18, ww = w * 0.36, wh = h * 0.6;
      ctx.fillStyle = lit ? '#f2c77a' : '#3a4250';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx, wy + ww / 2);
      ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.closePath();
      ctx.fill();
    },
  });

  // Planta baja comercial: vidriera, marquesina con cartel y persiana metálica.
  {
    const rng = mulberry32(6);
    const signs = ['KIOSCO', 'FARMACIA', 'PANADERÍA', 'ROTISERÍA', 'PIZZERÍA', 'FERRETERÍA', 'ALMACÉN', 'VERDULERÍA', 'LIBRERÍA', 'HELADERÍA', 'CARNICERÍA', 'BAR', 'ZAPATERÍA', 'ÓPTICA', 'CERVECERÍA', 'PARRILLA',
      'MAXIKIOSCO', 'DESPENSA', 'FIAMBRERÍA', 'POLLERÍA', 'GOMERÍA', 'CERRAJERÍA', 'PELUQUERÍA', 'DIETÉTICA', 'REGALERÍA', 'AUTOSERVICIO'];
    tex.shopLayers = [];
    for (let k = 0; k < 8; k++) {
      const x = 0;
      const [c, ctx] = canvas();
      const [e, ectx] = canvas();
      ectx.fillStyle = '#000';
      ectx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#d9d4ca';
      ctx.fillRect(x, 0, S, S);
      noise(ctx, S, S, 400, rng);
      const hue = Math.floor(rng() * 360);
      // cartel
      ctx.fillStyle = `hsl(${hue},65%,38%)`;
      ctx.fillRect(x + 6, 10, S - 12, 46);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const sign = signs[Math.floor(rng() * signs.length)];
      ctx.fillText(sign, x + S / 2, 34, S - 24);
      ectx.fillStyle = `hsl(${hue},80%,55%)`;
      ectx.fillRect(x + 6, 10, S - 12, 46);
      ectx.fillStyle = '#fff';
      ectx.font = 'bold 30px Arial, sans-serif';
      ectx.textAlign = 'center';
      ectx.textBaseline = 'middle';
      ectx.fillText(sign, x + S / 2, 34, S - 24);
      // vidriera o persiana metálica
      if (rng() < 0.7) {
        glowOrGlass(ctx, x + 14, 72, S - 28, S - 80, false, rng);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 20, 80, 30, S - 100);
        ctx.fillStyle = '#333';
        ctx.fillRect(x + S * 0.62, 72, 5, S - 80);
        ectx.fillStyle = '#e9d7a8';
        ectx.fillRect(x + 14, 72, S - 28, S - 80);
      } else {
        ctx.fillStyle = '#8f9396';
        ctx.fillRect(x + 14, 72, S - 28, S - 80);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let yy = 72; yy < S - 8; yy += 6) ctx.fillRect(x + 14, yy, S - 28, 2);
        // graffiti
        ctx.strokeStyle = `hsl(${rng() * 360},80%,50%)`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let q = 0; q < 6; q++) ctx.lineTo(x + 40 + rng() * (S - 80), 110 + rng() * 100);
        ctx.stroke();
      }
      tex.shopLayers.push({ canvas: c, ecanvas: e });
    }
  }

  // Techos.
  {
    const rng = mulberry32(7);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#8d8a84';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 5000, rng, 0.12);
    ctx.fillStyle = 'rgba(60,40,30,0.25)';
    for (let i = 0; i < 6; i++) ctx.fillRect(rng() * S, rng() * S, 40 + rng() * 60, 30 + rng() * 60);
    tex.roofFlat = toTexture(c, renderer);
    tex.roofFlatCanvas = c;
  }
  {
    const rng = mulberry32(8);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#9a3f25';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 16) {
      for (let x = 0; x < S; x += 16) {
        ctx.fillStyle = `hsl(${10 + rng() * 10},${55 + rng() * 10}%,${30 + rng() * 10}%)`;
        ctx.beginPath();
        ctx.arc(x + 8, y + 14, 8, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y + 14, S, 2);
    }
    tex.roofTile = toTexture(c, renderer);
    tex.roofTileCanvas = c;
  }

  // Calle: asfalto con línea central discontinua (doble mano) o sin línea (mano única).
  const asphalt = (ctx, rng) => {
    ctx.fillStyle = '#3b3c3e';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 9000, rng, 0.1);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(20,20,20,${0.1 + rng() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(rng() * S, rng() * S, 10 + rng() * 30, 6 + rng() * 20, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  {
    const rng = mulberry32(9);
    const [c, ctx] = canvas();
    asphalt(ctx, rng);
    ctx.fillStyle = '#e8e2c8';
    ctx.fillRect(S / 2 - 3, 0, 6, S * 0.5);
    ctx.fillStyle = 'rgba(230,230,220,0.8)';
    ctx.fillRect(6, 0, 3, S);
    ctx.fillRect(S - 9, 0, 3, S);
    tex.road2 = toTexture(c, renderer);
  }
  {
    const rng = mulberry32(10);
    const [c, ctx] = canvas();
    asphalt(ctx, rng);
    // adoquines insinuados en calles de mano única
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < S; y += 12) ctx.fillRect(0, y, S, 1);
    tex.road1 = toTexture(c, renderer);
  }
  {
    const rng = mulberry32(11);
    const [c, ctx] = canvas();
    asphalt(ctx, rng);
    tex.asphalt = toTexture(c, renderer);
  }
  // Vereda: baldosas vainilla.
  {
    const rng = mulberry32(12);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#bdb6a6';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) {
      for (let x = 0; x < S; x += 32) {
        const l = 66 + rng() * 10;
        ctx.fillStyle = `hsl(40,14%,${l}%)`;
        ctx.fillRect(x + 1, y + 1, 30, 30);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let d = 0; d < 9; d++) ctx.fillRect(x + 5 + (d % 3) * 9, y + 5 + Math.floor(d / 3) * 9, 4, 4);
      }
    }
    noise(ctx, S, S, 2000, rng, 0.12);
    tex.sidewalk = toTexture(c, renderer);
  }
  // Pasto.
  {
    const rng = mulberry32(13);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#5b7a3a';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `hsl(${75 + rng() * 30},${30 + rng() * 25}%,${22 + rng() * 22}%)`;
      ctx.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 2 + rng() * 4);
    }
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = 'rgba(110,90,60,0.25)';
      ctx.beginPath();
      ctx.ellipse(rng() * S, rng() * S, 8 + rng() * 20, 6 + rng() * 14, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.grass = toTexture(c, renderer);
  }
  {
    const rng = mulberry32(14);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 12000, rng, 0.15);
    tex.sand = toTexture(c, renderer);
  }
  {
    const rng = mulberry32(15);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#6d6259';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 14000; i++) {
      const v = 70 + rng() * 90;
      ctx.fillStyle = `rgb(${v},${v * 0.95},${v * 0.9})`;
      ctx.fillRect(rng() * S, rng() * S, 2, 2);
    }
    tex.gravel = toTexture(c, renderer);
  }
  // Plaza: senderos de ladrillo molido.
  {
    const rng = mulberry32(16);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#a4553a';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 9000, rng, 0.14);
    tex.plaza = toTexture(c, renderer);
  }
  {
    const rng = mulberry32(17);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#6b8a3c';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 6000, rng, 0.1);
    tex.pitch = toTexture(c, renderer);
  }
  Object.assign(tex, groundTextures(renderer, toTexture));
  tex.atlas = atlasTexture(renderer);

  // Every facade and roof in one texture array (one material per chunk).
  const layers = [
    { name: 'house', ...tex.house },
    { name: 'brick', ...tex.brick },
    { name: 'apartments', ...tex.apartments },
    { name: 'office', ...tex.office, rough: 0.35, metal: 0.3 },
    { name: 'church', ...tex.church },
    ...tex.shopLayers.map((l, i) => ({ name: `shop${i}`, ...l })),
    ...[0, 1, 2, 3].map((v) => ({ name: `ground${v}`, ...layerCanvas((c, e, r) => groundFloor(c, e, r, v), 50 + v) })),
    ...['medianera', 'medianeraLadrillo', 'hueco', 'villa', 'muro0', 'muro1', 'muro2', 'porton', 'roofMembrana', 'roofBaldosa', 'chapa'].map((name, i) => ({
      name, ...layerCanvas(painters[name], 60 + i), rough: name === 'chapa' ? 0.55 : name === 'porton' ? 0.6 : 0.9, metal: name === 'chapa' ? 0.45 : name === 'porton' ? 0.3 : 0,
    })),
    { name: 'roofFlat', canvas: tex.roofFlatCanvas, rough: 1 },
    { name: 'roofTile', canvas: tex.roofTileCanvas, rough: 0.8 },
  ];
  tex.facades = facadeArray(layers);
  delete tex.shopLayers;
  return tex;
}

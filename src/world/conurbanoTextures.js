// Canvas textures of the conurbano: medianeras, ground floors with doors, rejas and
// portones, ladrillo hueco with exposed concrete columns, self-built villa walls,
// fence walls with pintadas, chapa and membrana roofs, dirt and dry grass, plus an
// alpha atlas (rejas, alambrado, barandas, ropa colgada, pastizal, cortaderas).
// Facades and roofs are packed into one texture array so every building of a
// chunk is drawn with a single material (see facadeMaterial()).
import * as THREE from 'three';
import { mulberry32 } from './geo.js';

const S = 256;

export function canvas(w = S, h = S) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function noise(ctx, w, h, amount, rng, alpha = 0.08, x0 = 0, y0 = 0) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rng() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(x0 + rng() * w, y0 + rng() * h, 1 + rng() * 3, 1 + rng() * 3);
  }
}

function blotch(ctx, rng, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.8), rng() * 3, 0, Math.PI * 2);
  ctx.fill();
}

// Damp stains rising from the ground and dripping from sills.
function stains(ctx, rng, w, h, n = 6) {
  for (let i = 0; i < n; i++) blotch(ctx, rng, rng() * w, h - rng() * 20, 20 + rng() * 40, `rgba(70,60,45,${0.12 + rng() * 0.12})`);
  for (let i = 0; i < n * 2; i++) {
    const x = rng() * w, y = rng() * h, l = 10 + rng() * 40;
    const g = ctx.createLinearGradient(x, y, x, y + l);
    g.addColorStop(0, 'rgba(50,45,35,0.18)');
    g.addColorStop(1, 'rgba(50,45,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2 + rng() * 4, l);
  }
}

function cracks(ctx, rng, w, h, n = 4) {
  ctx.strokeStyle = 'rgba(40,35,30,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = rng() * w, y = rng() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) ctx.lineTo((x += (rng() - 0.5) * 14), (y += 3 + rng() * 8));
    ctx.stroke();
  }
}

// Ladrillo cerámico hueco (33 x 18 cm) with irregular grey mortar.
function hueco(ctx, rng, x0, y0, w, h, bw = 14, bh = 8) {
  ctx.fillStyle = '#9d968a';
  ctx.fillRect(x0, y0, w, h);
  for (let y = y0; y < y0 + h; y += bh) {
    const off = ((y - y0) / bh) % 2 ? bw / 2 : 0;
    for (let x = x0 - bw; x < x0 + w; x += bw) {
      const l = 42 + rng() * 14;
      ctx.fillStyle = `hsl(${13 + rng() * 9},${50 + rng() * 18}%,${l}%)`;
      ctx.fillRect(x + off + 1.2, y + 1.2, bw - 2, bh - 2);
      if (rng() < 0.015) {
        // broken brick showing the holes
        ctx.fillStyle = 'rgba(40,20,10,0.45)';
        for (let k = 0; k < 3; k++) ctx.fillRect(x + off + 2 + k * 4, y + 2.5, 2.5, bh - 5);
      }
    }
  }
  // mortar squeezed out of the joints
  ctx.fillStyle = 'rgba(160,154,142,0.7)';
  for (let i = 0; i < (w * h) / 60; i++) ctx.fillRect(x0 + rng() * w, y0 + Math.floor(rng() * (h / bh)) * bh - 1, 2 + rng() * 5, 2 + rng() * 1.5);
}

function concrete(ctx, rng, x, y, w, h) {
  ctx.fillStyle = `hsl(40,${4 + rng() * 5}%,${58 + rng() * 8}%)`;
  ctx.fillRect(x, y, w, h);
  noise(ctx, w, h, (w * h) / 12, rng, 0.14, x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x, y + h - 2, w, 2);
}

function glass(ctx, x, y, w, h, lit, rng) {
  if (lit) {
    ctx.fillStyle = rng() < 0.8 ? `hsl(${34 + rng() * 12},90%,${52 + rng() * 15}%)` : `hsl(200,55%,${60 + rng() * 15}%)`;
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#26313a');
    g.addColorStop(0.5, '#56697a');
    g.addColorStop(1, '#222b33');
    ctx.fillStyle = g;
  }
  ctx.fillRect(x, y, w, h);
}

function bars(ctx, x, y, w, h, gap = 7, color = '#1b1b1b') {
  ctx.fillStyle = color;
  for (let xx = x + gap / 2; xx < x + w; xx += gap) ctx.fillRect(xx, y, 2, h);
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y + h * 0.45, w, 2);
}

// Window with reja and optional persiana, (x, y) = top-left, ground floor units.
function window_(ctx, ectx, rng, x, y, w, h, opts = {}) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 7);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - 4, y + h + 1, w + 8, 3); // alféizar
  glass(ctx, x, y, w, h, false, rng);
  if (ectx && rng() < 0.5) glass(ectx, x, y, w, h, true, rng);
  if (opts.persiana ?? rng() < 0.6) {
    const down = h * (0.25 + rng() * 0.75);
    ctx.fillStyle = rng() < 0.5 ? '#b9b2a2' : '#7d6a52';
    ctx.fillRect(x, y, w, down);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let yy = y; yy < y + down; yy += 3) ctx.fillRect(x, yy, w, 1);
    if (ectx) {
      ectx.fillStyle = '#000';
      ectx.fillRect(x, y, w, down);
    }
  }
  if (opts.reja ?? true) bars(ctx, x - 1, y - 1, w + 2, h + 2, 6 + rng() * 3);
}

function door(ctx, ectx, rng, x, y, w, h) {
  const kind = rng();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
  if (kind < 0.45) {
    // puerta de madera con tableros
    ctx.fillStyle = `hsl(${22 + rng() * 10},${35 + rng() * 20}%,${22 + rng() * 12}%)`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 6, w - 10, h * 0.4);
    ctx.strokeRect(x + 5, y + h * 0.52, w - 10, h * 0.4);
  } else {
    // puerta de chapa con mirilla enrejada
    ctx.fillStyle = ['#2e3a33', '#262626', '#4a3b2c', '#34404c', '#6b6e70'][Math.floor(rng() * 5)];
    ctx.fillRect(x, y, w, h);
    glass(ctx, x + 6, y + 8, w - 12, h * 0.3, false, rng);
    bars(ctx, x + 6, y + 8, w - 12, h * 0.3, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let yy = y + h * 0.45; yy < y + h; yy += 5) ctx.fillRect(x, yy, w, 1);
  }
  ctx.fillStyle = '#c9b27a';
  ctx.fillRect(x + w - 8, y + h * 0.5, 4, 3); // picaporte
  // light over the door
  ctx.fillStyle = '#ddd';
  ctx.fillRect(x + w / 2 - 3, y - 12, 6, 5);
  if (ectx) {
    ectx.fillStyle = '#ffd890';
    ectx.fillRect(x + w / 2 - 4, y - 13, 8, 7);
  }
}

function porton(ctx, rng, x, y, w, h, rollUp = rng() < 0.4) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
  if (rollUp) {
    ctx.fillStyle = '#8e9296';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let yy = y; yy < y + h; yy += 4) ctx.fillRect(x, yy, w, 1.5);
  } else {
    ctx.fillStyle = ['#3d4b3f', '#2a2a2a', '#5a4632', '#6b6f73', '#3b4a5e', '#7a2e22'][Math.floor(rng() * 6)];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let xx = x + 3; xx < x + w; xx += 6) ctx.fillRect(xx, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
  }
  // rust and dirt at the bottom
  for (let i = 0; i < 6; i++) blotch(ctx, rng, x + rng() * w, y + h - rng() * 12, 6 + rng() * 10, 'rgba(120,70,30,0.3)');
}

function tag(ctx, rng, x, y, w, h) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `hsl(${rng() * 360},${60 + rng() * 30}%,${35 + rng() * 25}%)`;
  ctx.lineWidth = 2 + rng() * 4;
  ctx.beginPath();
  let px = x, py = y + h / 2;
  ctx.moveTo(px, py);
  for (let q = 0; q < 8; q++) {
    px += w / 8;
    ctx.quadraticCurveTo(px - w / 16, y + rng() * h, px, y + rng() * h);
  }
  ctx.stroke();
}

function muro(ctx, rng, graffiti) {
  ctx.fillStyle = '#ece7dc';
  ctx.fillRect(0, 0, S, S);
  noise(ctx, S, S, 4000, rng, 0.06);
  concrete(ctx, rng, 0, 0, S, 10); // coping
  stains(ctx, rng, S, S, 4);
  cracks(ctx, rng, S, S, 3);
  const g = ctx.createLinearGradient(0, S - 40, 0, S);
  g.addColorStop(0, 'rgba(90,75,50,0)');
  g.addColorStop(1, 'rgba(90,75,50,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, S - 40, S, 40);
  if (graffiti >= 1) for (let i = 0; i < 2; i++) tag(ctx, rng, rng() * 180, 110 + rng() * 90, 40 + rng() * 60, 25 + rng() * 25);
  if (graffiti >= 2) {
    ctx.font = `bold ${26 + rng() * 12}px Impact, Arial Black, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `hsl(${rng() < 0.5 ? 210 : rng() * 360},65%,${30 + rng() * 20}%)`;
    ctx.fillText(PINTADAS[Math.floor(rng() * PINTADAS.length)], S / 2 + (rng() - 0.5) * 60, 140 + rng() * 50, S - 30);
  }
}

const PINTADAS = ['QUILMES', 'CERVECERO', 'AGUANTE QAC', 'LA BANDA', 'TE AMO FLOR', 'BARRIO', 'NO TIRAR BASURA', 'VIVA EL BARRIO', 'MATE', 'ARGENTINO'];

// ------------------------------------------------------------ facade layers
// Each painter gets (ctx, ectx, rng) on a 256x256 canvas.
export const painters = {
  // Blank side wall: revoque with damp, cracks and patches.
  medianera(ctx, ectx, rng) {
    ctx.fillStyle = '#e6dfd2';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(${200 + rng() * 40},${190 + rng() * 40},${170 + rng() * 40},0.5)`;
      ctx.fillRect(rng() * S, rng() * S, 30 + rng() * 80, 20 + rng() * 60);
    }
    noise(ctx, S, S, 5000, rng, 0.07);
    stains(ctx, rng, S, S, 4);
    for (let i = 0; i < 2; i++) blotch(ctx, rng, rng() * S, rng() * S * 0.6, 25 + rng() * 30, 'rgba(90,85,70,0.1)');
    cracks(ctx, rng, S, S, 4);
    // plaster fallen off: bricks showing
    const x = 40 + rng() * (S - 100), y = 40 + rng() * (S - 100);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 9; k++) ctx.lineTo(x + (rng() - 0.3) * 40, y + (rng() - 0.3) * 24);
    ctx.closePath();
    ctx.clip();
    hueco(ctx, rng, x - 20, y - 12, 70, 50);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, S, 4);
  },
  // Unplastered side wall: ladrillo hueco between concrete columns and beams.
  medianeraLadrillo(ctx, ectx, rng) {
    hueco(ctx, rng, 0, 0, S, S);
    for (const y of [0, S / 2]) concrete(ctx, rng, 0, y, S, 9);
    for (const x of [0, S / 2]) concrete(ctx, rng, x, 0, 9, S);
    stains(ctx, rng, S, S, 4);
  },
  // Self-built house in raw ladrillo hueco: columns, beams, small openings.
  hueco(ctx, ectx, rng) {
    hueco(ctx, rng, 0, 0, S, S);
    for (const y of [0, S / 2]) concrete(ctx, rng, 0, y, S, 10);
    for (const x of [0, S / 2]) concrete(ctx, rng, x - 1, 0, 10, S);
    for (let fy = 0; fy < 2; fy++) {
      for (let bx = 0; bx < 2; bx++) {
        const x = bx * 128, y = fy * 128;
        const r = rng();
        if (fy === 1 && bx === 0) {
          // chapa door on the ground floor
          ctx.fillStyle = ['#5d6f7c', '#6e5a48', '#3c4c3c', '#7b7f82'][Math.floor(rng() * 4)];
          ctx.fillRect(x + 40, y + 36, 38, 82);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          for (let xx = x + 42; xx < x + 78; xx += 5) ctx.fillRect(xx, y + 36, 1.5, 82);
          blotch(ctx, rng, x + 60, y + 112, 16, 'rgba(120,70,30,0.35)');
          continue;
        }
        if (r < 0.15) continue;
        const wx = x + 34 + rng() * 20, wy = y + 34, ww = 40 + rng() * 14, wh = 36 + rng() * 8;
        concrete(ctx, rng, wx - 4, wy - 5, ww + 8, 5); // dintel
        if (r < 0.3) {
          // opening covered with blue nylon or a blanket
          ctx.fillStyle = rng() < 0.5 ? '#2f5f9e' : `hsl(${rng() * 360},40%,40%)`;
          ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          for (let k = 0; k < 4; k++) ctx.fillRect(wx + rng() * ww, wy, 1.5, wh);
        } else {
          glass(ctx, wx, wy, ww, wh, false, rng);
          if (rng() < 0.45) glass(ectx, wx, wy, ww, wh, true, rng);
          ctx.strokeStyle = r < 0.7 ? '#b8bcbf' : '#2a2a2a';
          ctx.lineWidth = 3;
          ctx.strokeRect(wx, wy, ww, wh);
          ctx.beginPath();
          ctx.moveTo(wx + ww / 2, wy);
          ctx.lineTo(wx + ww / 2, wy + wh);
          ctx.stroke();
          if (rng() < 0.5) bars(ctx, wx, wy, ww, wh, 7);
        }
      }
    }
    stains(ctx, rng, S, S, 4);
  },
  // Self-built house, plastered and painted (tinted with bright colours).
  villa(ctx, ectx, rng) {
    ctx.fillStyle = '#ece8e0';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 6000, rng, 0.1);
    // plaster fallen off
    for (let i = 0; i < 4; i++) {
      const x = rng() * (S - 60), y = rng() * (S - 50), w = 25 + rng() * 45, h = 15 + rng() * 30;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y + h * rng());
      for (let k = 0; k < 7; k++) ctx.lineTo(x + w * rng(), y + h * rng());
      ctx.closePath();
      ctx.clip();
      hueco(ctx, rng, x, y, w, h);
      ctx.restore();
    }
    for (const y of [S / 2 - 8, S - 8]) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y, S, 8);
    }
    for (let fy = 0; fy < 2; fy++) {
      for (let bx = 0; bx < 2; bx++) {
        const x = bx * 128, y = fy * 128;
        if (fy === 1 && bx === 1) {
          ctx.fillStyle = ['#5d6f7c', '#6e5a48', '#2d2d2d', '#8a3a2a'][Math.floor(rng() * 4)];
          ctx.fillRect(x + 44, y + 40, 38, 80);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          for (let yy = y + 44; yy < y + 120; yy += 6) ctx.fillRect(x + 44, yy, 38, 1);
          continue;
        }
        if (rng() < 0.2) continue;
        window_(ctx, ectx, rng, x + 36 + rng() * 20, y + 38, 40 + rng() * 10, 36, { persiana: rng() < 0.3 });
      }
    }
    // mud splashed on the bottom of the wall
    for (const y of [S / 2, S]) {
      const g = ctx.createLinearGradient(0, y - 26, 0, y);
      g.addColorStop(0, 'rgba(90,70,45,0)');
      g.addColorStop(1, 'rgba(90,70,45,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 26, S, 26);
    }
    stains(ctx, rng, S, S, 3);
  },
  // Fence walls (6 m x 3 m, the wall top at the top of the texture): with a
  // pintada, with tags, or just old paint.
  muro0: (ctx, ectx, rng) => muro(ctx, rng, 2),
  muro1: (ctx, ectx, rng) => muro(ctx, rng, 1),
  muro2: (ctx, ectx, rng) => muro(ctx, rng, 0),
  // Sheet metal gate (3 m x 2.2 m), tinted per gate.
  porton(ctx, ectx, rng) {
    ctx.fillStyle = '#9a9a98';
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 10) {
      const g = ctx.createLinearGradient(x, 0, x + 10, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 10, S);
    }
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, S - 8, S - 8);
    ctx.fillRect(S / 2 - 2, 0, 4, S);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(S / 2 - 3, 0, 6, S);
    ctx.fillStyle = '#d8c070';
    ctx.fillRect(S / 2 + 8, S / 2, 10, 5);
    for (let i = 0; i < 8; i++) blotch(ctx, rng, rng() * S, S - rng() * 50, 8 + rng() * 16, 'rgba(120,65,25,0.35)');
    if (rng() < 0.6) tag(ctx, rng, 30 + rng() * 60, 100 + rng() * 60, 100 + rng() * 60, 40);
  },
  roofMembrana(ctx, ectx, rng) {
    ctx.fillStyle = '#b9bbb8';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 43) {
      ctx.fillStyle = `rgba(${200 + rng() * 30},${200 + rng() * 30},${200 + rng() * 30},0.5)`;
      ctx.fillRect(0, y, S, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, y + 40, S, 3);
    }
    noise(ctx, S, S, 6000, rng, 0.1);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(40,40,40,${0.2 + rng() * 0.3})`;
      ctx.fillRect(rng() * S, rng() * S, 15 + rng() * 40, 10 + rng() * 30); // parches de membrana
    }
    for (let i = 0; i < 5; i++) blotch(ctx, rng, rng() * S, rng() * S, 20 + rng() * 30, 'rgba(80,70,50,0.25)');
  },
  roofBaldosa(ctx, ectx, rng) {
    ctx.fillStyle = '#c9b9a8';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) {
      for (let x = 0; x < S; x += 8) {
        ctx.fillStyle = `hsl(${12 + rng() * 8},${45 + rng() * 15}%,${40 + rng() * 10}%)`;
        ctx.fillRect(x + 1, y + 1, 7, 7);
      }
    }
    for (let i = 0; i < 6; i++) blotch(ctx, rng, rng() * S, rng() * S, 20 + rng() * 40, 'rgba(50,50,40,0.25)');
  },
  // Chapa acanalada with rust.
  chapa(ctx, ectx, rng) {
    ctx.fillStyle = '#a7aaac';
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, 0, 1, S);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 2, 0, 1.5, S);
    }
    for (let y = 60; y < S; y += 64 + rng() * 20) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y, S, 2);
    }
    for (let i = 0; i < 10; i++) blotch(ctx, rng, rng() * S, rng() * S, 15 + rng() * 45, `rgba(${130 + rng() * 40},${60 + rng() * 20},20,${0.25 + rng() * 0.3})`);
    for (let i = 0; i < 20; i++) {
      const x = rng() * S, y = rng() * S, l = 20 + rng() * 60;
      const g = ctx.createLinearGradient(x, y, x, y + l);
      g.addColorStop(0, 'rgba(120,60,20,0.4)');
      g.addColorStop(1, 'rgba(120,60,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 2 + rng() * 3, l);
    }
  },
};

// Ground floor of a house facing the street: 6 m x 3 m (drawn in a 256 x 128 space).
export function groundFloor(ctx, ectx, rng, variant) {
  ctx.save();
  ectx.save();
  ctx.scale(1, 2);
  ectx.scale(1, 2);
  ctx.fillStyle = '#efe9dd';
  ctx.fillRect(0, 0, S, 128);
  noise(ctx, S, 128, 3500, rng, 0.08);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(0, 0, S, 5); // cornisa
  // zócalo
  if (variant === 3) {
    for (let x = 0; x < S; x += 16) {
      for (let y = 110; y < 128; y += 6) {
        ctx.fillStyle = `hsl(35,${10 + rng() * 10}%,${45 + rng() * 15}%)`;
        ctx.fillRect(x + ((y / 6) % 2) * 8, y, 15, 5);
      }
    }
  } else {
    ctx.fillStyle = `hsl(40,5%,${45 + rng() * 15}%)`;
    ctx.fillRect(0, 111, S, 17);
  }
  const Y = 111; // floor level
  if (variant === 0) {
    door(ctx, ectx, rng, 18, Y - 88, 38, 88);
    window_(ctx, ectx, rng, 76, 32, 50, 46);
    porton(ctx, rng, 146, Y - 96, 100, 96);
  } else if (variant === 1) {
    window_(ctx, ectx, rng, 22, 32, 52, 46);
    door(ctx, ectx, rng, 108, Y - 88, 38, 88);
    window_(ctx, ectx, rng, 178, 32, 52, 46);
  } else if (variant === 2) {
    porton(ctx, rng, 14, Y - 96, 118, 96, true);
    door(ctx, ectx, rng, 162, Y - 88, 38, 88);
    ctx.fillStyle = '#333';
    ctx.fillRect(214, 50, 22, 14); // medidor
  } else {
    window_(ctx, ectx, rng, 16, 30, 56, 50, { persiana: true });
    door(ctx, ectx, rng, 104, Y - 90, 40, 90);
    window_(ctx, ectx, rng, 170, 30, 56, 50);
  }
  stains(ctx, rng, S, 128, 5);
  ctx.restore();
  ectx.restore();
}

// ------------------------------------------------------------ flat ground
export function groundTextures(renderer, toTexture) {
  const out = {};
  {
    // tierra apisonada de villa
    const rng = mulberry32(31);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#7b6650';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) blotch(ctx, rng, rng() * S, rng() * S, 20 + rng() * 40, rng() < 0.5 ? 'rgba(60,48,36,0.35)' : 'rgba(150,130,100,0.3)');
    for (let i = 0; i < 9000; i++) {
      const v = 70 + rng() * 80;
      ctx.fillStyle = `rgba(${v + 20},${v},${v - 20},0.35)`;
      ctx.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = `hsl(${rng() * 360},${20 + rng() * 30}%,${45 + rng() * 35}%)`;
      ctx.fillRect(rng() * S, rng() * S, 2 + rng() * 2, 1 + rng() * 2); // basura
    }
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(70,90,40,0.5)';
      for (let k = 0; k < 60; k++) ctx.fillRect(rng() * S, rng() * S, 1, 3);
    }
    out.dirt = toTexture(c, renderer);
  }
  {
    // pasto seco de descampado
    const rng = mulberry32(32);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#8f8a55';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 12; i++) blotch(ctx, rng, rng() * S, rng() * S, 25 + rng() * 45, rng() < 0.4 ? 'rgba(120,100,70,0.45)' : 'rgba(90,110,50,0.35)');
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `hsl(${40 + rng() * 35},${25 + rng() * 25}%,${28 + rng() * 30}%)`;
      ctx.fillRect(rng() * S, rng() * S, 1, 2 + rng() * 5);
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `hsl(${rng() * 360},${20 + rng() * 30}%,${50 + rng() * 35}%)`;
      ctx.fillRect(rng() * S, rng() * S, 2 + rng() * 2, 1 + rng() * 2);
    }
    out.dryGrass = toTexture(c, renderer);
  }
  {
    // pasillo: contrapiso de cemento gastado con tierra en los bordes
    const rng = mulberry32(33);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#9d978c';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 7000, rng, 0.14);
    for (let i = 0; i < 6; i++) blotch(ctx, rng, rng() * S, rng() * S, 20 + rng() * 30, 'rgba(90,75,55,0.4)');
    cracks(ctx, rng, S, S, 8);
    for (const x0 of [0, S - 40]) {
      const g = ctx.createLinearGradient(x0, 0, x0 + 40, 0);
      const dark = 'rgba(100,80,58,0.85)', clear = 'rgba(100,80,58,0)';
      g.addColorStop(0, x0 ? clear : dark);
      g.addColorStop(1, x0 ? dark : clear);
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, 40, S);
    }
    ctx.fillStyle = 'rgba(40,50,60,0.35)';
    ctx.fillRect(S / 2 - 3, 0, 6, S); // zanja / caño
    out.pasillo = toTexture(c, renderer);
  }
  {
    // calle de hormigón: losas con juntas cada 4 m, fisuras y parches
    const rng = mulberry32(35);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#8f8d87';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 3) {
      for (const x of [0, S / 2]) {
        ctx.fillStyle = `hsl(40,${3 + rng() * 4}%,${50 + rng() * 8}%)`;
        ctx.fillRect(x + 1, y + 1, S / 2 - 2, S / 3 - 2);
      }
    }
    noise(ctx, S, S, 9000, rng, 0.12);
    for (let i = 0; i < 8; i++) blotch(ctx, rng, rng() * S, rng() * S, 10 + rng() * 25, 'rgba(40,40,40,0.25)');
    cracks(ctx, rng, S, S, 6);
    ctx.fillStyle = 'rgba(30,30,30,0.55)';
    for (let y = 0; y < S; y += S / 3) ctx.fillRect(0, y, S, 2);
    ctx.fillRect(S / 2 - 1, 0, 2, S);
    // cordón cuneta
    ctx.fillStyle = 'rgba(200,198,190,0.6)';
    ctx.fillRect(0, 0, 10, S);
    ctx.fillRect(S - 10, 0, 10, S);
    out.concrete = toTexture(c, renderer);
  }
  {
    // bañado
    const rng = mulberry32(34);
    const [c, ctx] = canvas();
    ctx.fillStyle = '#56603a';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) blotch(ctx, rng, rng() * S, rng() * S, 18 + rng() * 30, 'rgba(70,80,70,0.6)');
    for (let i = 0; i < 10000; i++) {
      ctx.fillStyle = `hsl(${60 + rng() * 40},${25 + rng() * 25}%,${20 + rng() * 25}%)`;
      ctx.fillRect(rng() * S, rng() * S, 1, 2 + rng() * 6);
    }
    out.wetland = toTexture(c, renderer);
  }
  return out;
}

// ------------------------------------------------------------ alpha atlas
// Regions in UV space [u0, v0, u1, v1] (v up).
export const ATLAS = {
  reja: [0, 0.75, 0.5, 1],
  alambre: [0.5, 0.75, 1, 1],
  baranda: [0, 0.625, 0.5, 0.75],
  ropa: [0.5, 0.5, 1, 0.75],
  pasto: [0, 0, 0.5, 0.5],
  cortadera: [0.5, 0, 1, 0.5],
};

export function atlasTexture(renderer) {
  const rng = mulberry32(41);
  const [c, ctx] = canvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  // reja (0,0)-(256,128): barrotes con puntas
  ctx.fillStyle = '#1e1e1e';
  for (let x = 4; x < 256; x += 11) {
    ctx.fillRect(x, 10, 3, 114);
    ctx.beginPath();
    ctx.moveTo(x - 2, 11);
    ctx.lineTo(x + 1.5, 2);
    ctx.lineTo(x + 5, 11);
    ctx.fill();
  }
  ctx.fillRect(0, 14, 256, 4);
  ctx.fillRect(0, 70, 256, 3);
  ctx.fillRect(0, 120, 256, 6);
  // alambrado romboidal (256,0)-(512,128)
  ctx.strokeStyle = 'rgba(150,155,158,0.95)';
  ctx.lineWidth = 1.2;
  for (let k = -128; k < 256; k += 9) {
    ctx.beginPath();
    ctx.moveTo(256 + k, 6);
    ctx.lineTo(256 + k + 122, 128);
    ctx.moveTo(256 + k + 122, 6);
    ctx.lineTo(256 + k, 128);
    ctx.stroke();
  }
  ctx.clearRect(0, 0, 256, 0);
  ctx.fillStyle = '#7d8286';
  ctx.fillRect(256, 4, 256, 3);
  // stray holes in the mesh
  for (let i = 0; i < 3; i++) ctx.clearRect(256 + 30 + rng() * 180, 40 + rng() * 60, 14 + rng() * 20, 10 + rng() * 20);
  // baranda (0,128)-(256,192)
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(0, 130, 256, 6);
  ctx.fillRect(0, 184, 256, 5);
  for (let x = 3; x < 256; x += 14) ctx.fillRect(x, 130, 3, 58);
  // ropa colgada (256,128)-(512,256)
  ctx.fillStyle = '#ddd';
  ctx.fillRect(256, 131, 256, 2);
  let x = 262;
  while (x < 500) {
    const kind = rng();
    const w = kind < 0.35 ? 34 : kind < 0.6 ? 22 : kind < 0.85 ? 46 : 12;
    if (x + w > 508) break;
    ctx.fillStyle = `hsl(${rng() * 360},${25 + rng() * 40}%,${40 + rng() * 40}%)`;
    if (kind < 0.35) {
      // remera
      ctx.fillRect(x + 6, 134, w - 12, 44);
      ctx.fillRect(x, 134, w, 14);
    } else if (kind < 0.6) {
      // pantalón
      ctx.fillRect(x, 134, w, 14);
      ctx.fillRect(x, 134, w / 2 - 1, 64);
      ctx.fillRect(x + w / 2 + 1, 134, w / 2 - 1, 64);
    } else if (kind < 0.85) {
      // sábana / toallón
      ctx.fillRect(x, 134, w, 70 + rng() * 40);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x, 150, w, 4);
    } else ctx.fillRect(x, 134, w, 22); // medias
    ctx.fillStyle = '#c7a26b';
    ctx.fillRect(x + 2, 130, 3, 6);
    x += w + 3 + rng() * 8;
  }
  // pastizal (0,256)-(256,512)
  const tuft = (x0, colors) => {
    for (let i = 0; i < 110; i++) {
      const bx = x0 + 128 + (rng() - 0.5) * 120, h = 90 + rng() * 150;
      const lean = (rng() - 0.5) * 90;
      ctx.strokeStyle = colors[Math.floor(rng() * colors.length)];
      ctx.lineWidth = 1.5 + rng() * 2;
      ctx.beginPath();
      ctx.moveTo(bx, 512);
      ctx.quadraticCurveTo(bx + lean * 0.3, 512 - h * 0.6, bx + lean, 512 - h);
      ctx.stroke();
    }
  };
  tuft(0, ['#a79a5a', '#8c8a4a', '#b8a868', '#6f7a3a', '#9a8a50', '#c2b27a']);
  // cortaderas (256,256)-(512,512)
  tuft(256, ['#5f7040', '#6b7a45', '#7a8450', '#8f8a55']);
  for (let i = 0; i < 9; i++) {
    const bx = 256 + 60 + rng() * 136, top = 270 + rng() * 60;
    ctx.strokeStyle = '#8f8260';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, 512);
    ctx.lineTo(bx + (rng() - 0.5) * 30, top + 40);
    ctx.stroke();
    ctx.fillStyle = 'rgba(236,226,200,0.95)';
    ctx.beginPath();
    ctx.ellipse(bx + (rng() - 0.5) * 20, top + 20, 9 + rng() * 4, 28 + rng() * 10, (rng() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------ texture array
// layers: [{ name, canvas, ecanvas?, rough, metal }] of 256x256 canvases.
export function facadeArray(layers) {
  const n = layers.length;
  const size = S * S * 4;
  const data = new Uint8Array(size * n), edata = new Uint8Array(size * n);
  const flip = (src, dst, off) => {
    const img = src.getContext('2d').getImageData(0, 0, S, S).data;
    for (let y = 0; y < S; y++) dst.set(img.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), off + y * S * 4);
  };
  layers.forEach((l, i) => {
    flip(l.canvas, data, i * size);
    if (l.ecanvas) flip(l.ecanvas, edata, i * size);
  });
  const make = (d) => {
    const t = new THREE.DataArrayTexture(d, S, S, n);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return {
    map: make(data),
    emissive: make(edata),
    layer: Object.fromEntries(layers.map((l, i) => [l.name, i])),
    rough: layers.map((l) => l.rough ?? 0.9),
    metal: layers.map((l) => l.metal ?? 0),
  };
}

// MeshStandardMaterial that reads its map/emissive from the facade texture array
// (per-vertex `layer` attribute) and roughness/metalness per layer.
export function facadeMaterial(facades) {
  const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  dummy.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({
    map: dummy,
    emissiveMap: dummy,
    emissive: new THREE.Color(1, 0.85, 0.6),
    emissiveIntensity: 0,
    vertexColors: true,
  });
  const n = facades.rough.length;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.facadeMap = { value: facades.map };
    sh.uniforms.facadeEmissive = { value: facades.emissive };
    sh.uniforms.layerRough = { value: facades.rough };
    sh.uniforms.layerMetal = { value: facades.metal };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLayer = layer;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform highp sampler2DArray facadeMap;
uniform highp sampler2DArray facadeEmissive;
uniform float layerRough[${n}];
uniform float layerMetal[${n}];
varying float vLayer;`)
      .replace('#include <map_fragment>', 'diffuseColor *= texture( facadeMap, vec3( vMapUv, vLayer ) );')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= texture( facadeEmissive, vec3( vMapUv, vLayer ) ).rgb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = layerRough[ int( vLayer + 0.5 ) ];')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = layerMetal[ int( vLayer + 0.5 ) ];');
  };
  m.customProgramCacheKey = () => `facades${n}`;
  return m;
}

export function layerCanvas(paint, seed) {
  const rng = mulberry32(seed);
  const [c, ctx] = canvas();
  const [e, ectx] = canvas();
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);
  paint(ctx, ectx, rng);
  return { canvas: c, ecanvas: e };
}

// HUD: minimap (pre-rendered city, rotated around the player), speedometer,
// wanted stars, street name, clock and big center messages.
export class Hud {
  constructor(data) {
    this.el = document.getElementById('hud');
    this.mini = document.getElementById('minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.street = document.getElementById('street');
    this.speedEl = document.getElementById('speed');
    this.starsEl = document.getElementById('stars');
    this.clockEl = document.getElementById('clock');
    this.healthEl = document.getElementById('health-bar');
    this.msgEl = document.getElementById('message');
    this.hintEl = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.msgTimer = 0;
    this.toastTimer = 0;
    this.buildMap(data);
    this.lastStreet = '';
  }

  buildMap(data) {
    const b = data.bounds;
    const pad = 200;
    this.scale = 0.9; // px per meter
    this.ox = b.minX - pad;
    this.oz = b.minZ - pad;
    const w = Math.ceil((b.maxX - b.minX + pad * 2) * this.scale);
    const h = Math.ceil((b.maxZ - b.minZ + pad * 2) * this.scale);
    const c = document.createElement('canvas');
    c.width = Math.min(w, 6000);
    c.height = Math.min(h, 6000);
    this.scale = Math.min(c.width / (w / this.scale), c.height / (h / this.scale));
    const ctx = c.getContext('2d');
    const P = ([x, z]) => [(x - this.ox) * this.scale, (z - this.oz) * this.scale];
    ctx.fillStyle = '#9fae8a';
    ctx.fillRect(0, 0, c.width, c.height);
    const colors = { water: '#8b7a58', park: '#7fae63', grass: '#8cb370', plaza: '#b38a6b', sand: '#d9c79b', railway: '#8a8278', pitch: '#6aa04c', parking: '#b0b0b0' };
    for (const a of data.areas) {
      ctx.fillStyle = colors[a.kind] || '#8cb370';
      poly(ctx, a.pts.map(P));
      ctx.fill();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const r of data.roads) {
        ctx.strokeStyle = pass ? (r.kind === 'primary' ? '#f4d27a' : r.kind === 'pedestrian' ? '#e8d9c8' : '#ffffff') : '#7b7b7b';
        ctx.lineWidth = Math.max(2, r.w * this.scale) + (pass ? 0 : 2);
        ctx.beginPath();
        r.pts.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#c9c1b3';
    ctx.strokeStyle = '#a79e8f';
    ctx.lineWidth = 0.5;
    for (const bl of data.buildings) {
      poly(ctx, bl.pts.map(P));
      ctx.fill();
    }
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    for (const r of data.rails || []) {
      ctx.beginPath();
      r.pts.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this.map = c;
    this.landmarks = data.landmarks || [];
  }

  drawMinimap(px, pz, heading, camYaw, blips) {
    const ctx = this.miniCtx;
    const W = this.mini.width, H = this.mini.height;
    const zoom = 2.1; // minimap px per map px
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#6f7d62';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    // rotate so that the camera's forward points up
    ctx.rotate(Math.PI + camYaw);
    ctx.scale(zoom, zoom);
    const mx = (px - this.ox) * this.scale, mz = (pz - this.oz) * this.scale;
    ctx.drawImage(this.map, -mx, -mz);
    for (const b of blips) {
      const bx = (b.x - this.ox) * this.scale - mx, bz = (b.z - this.oz) * this.scale - mz;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(bx, bz, b.r / zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `${10 / zoom}px sans-serif`;
    for (const l of this.landmarks) {
      const bx = (l.pos[0] - this.ox) * this.scale - mx, bz = (l.pos[1] - this.oz) * this.scale - mz;
      ctx.save();
      ctx.translate(bx, bz);
      ctx.rotate(-(Math.PI + camYaw));
      ctx.fillStyle = '#1b2a4a';
      ctx.fillText(l.name, 4 / zoom, 3 / zoom);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-2 / zoom, -2 / zoom, 4 / zoom, 4 / zoom);
      ctx.restore();
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(camYaw - heading);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // north marker
    const na = -Math.PI / 2 + Math.PI + camYaw;
    const nx = W / 2 + Math.cos(na) * (W / 2 - 10), ny = H / 2 + Math.sin(na) * (H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }

  setStreet(name) {
    if (name === this.lastStreet) return;
    this.lastStreet = name;
    this.street.textContent = name ? `${name} · Quilmes` : 'Quilmes';
    this.street.classList.remove('flash');
    void this.street.offsetWidth;
    this.street.classList.add('flash');
  }

  setSpeed(kmh) {
    this.speedEl.style.display = kmh === null ? 'none' : 'block';
    if (kmh !== null) this.speedEl.innerHTML = `${Math.round(kmh)}<small> km/h</small>`;
  }

  setWanted(level) {
    this.starsEl.innerHTML = [0, 1, 2, 3, 4].map((i) => `<span class="${i < level ? 'on' : ''}">★</span>`).join('');
  }

  setClock(hours) {
    const h = Math.floor(hours) % 24, m = Math.floor((hours % 1) * 60);
    this.clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  setHealth(v) {
    this.healthEl.style.width = `${Math.max(0, v)}%`;
  }

  hint(text) {
    // on phones there is no E key: "E: robar el auto" -> "Robar el auto"
    if (text && document.body.classList.contains('touch')) text = text.replace(/^E: (\w)/, (_, c) => c.toUpperCase());
    this.hintEl.textContent = text || '';
    this.hintEl.style.display = text ? 'block' : 'none';
  }

  message(text, color = '#fff', secs = 3) {
    this.msgEl.textContent = text;
    this.msgEl.style.color = color;
    this.msgEl.style.opacity = 1;
    this.msgTimer = secs;
  }

  toast(text, secs = 2.5) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = 1;
    this.toastTimer = secs;
  }

  update(dt) {
    if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.msgEl.style.opacity = 0;
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) this.toastEl.style.opacity = 0;
  }
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

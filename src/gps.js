// GPS: full-screen map (M) to pick a destination by clicking or searching an address
// ("Rivadavia 450"), a real business or a landmark; the route follows the streets
// (one-way aware when driving) and the minimap shows it with the distance left.
import { namesMatch, streetKey } from './world/alturas.js';
import { describeShop } from './world/shops.js';
import { drawLabel } from './hud.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.max(0, Math.round(m / 10) * 10)} m`);

export class Gps {
  constructor(data, graph, hud) {
    this.data = data;
    this.graph = graph;
    this.hud = hud;
    this.dest = null; // { x, z, label }
    this.route = null; // [[x, z], ...] from the player to the destination
    this.remaining = 0;
    this.timer = 0;
    this.open = false;
    this.buildUi();
  }

  // ------------------------------------------------ search
  // "Calle 123" -> point on that block from the corner-sign alturas.
  geocodeAddress(street, number) {
    const posts = this.data.streetSigns || [];
    const key = streetKey(street);
    for (const post of posts) {
      for (const s of post.signs) {
        if (s.from === undefined || !(streetKey(s.name) === key || namesMatch(s.name, street))) continue;
        if (number < Math.min(s.from, s.to) || number > Math.max(s.from, s.to) || s.from === s.to) continue;
        // block length: distance to the next corner of the same street along `dir`
        let len = 100;
        for (const other of posts) {
          if (other === post || !other.signs.some((o) => streetKey(o.name) === streetKey(s.name))) continue;
          const dx = other.x - post.x, dz = other.z - post.z;
          const along = dx * s.dir[0] + dz * s.dir[1], side = Math.abs(dx * s.dir[1] - dz * s.dir[0]);
          if (along > 5 && side < 15 && along < len * 2.5 && (len === 100 || along < len)) len = along;
        }
        const t = (number - s.from) / (s.to - s.from);
        return { x: post.x + s.dir[0] * t * len, z: post.z + s.dir[1] * t * len, label: `${s.name} ${number}` };
      }
    }
    return null;
  }

  search(query) {
    const q = norm(query);
    if (q.length < 2) return [];
    const out = [];
    const m = query.trim().match(/^(.*?)\s+(\d{1,5})$/);
    if (m) {
      const hit = this.geocodeAddress(m[1], +m[2]);
      if (hit) out.push({ ...hit, kind: 'Dirección' });
    }
    for (const l of this.data.landmarks || []) if (norm(l.name).includes(q)) out.push({ x: l.pos[0], z: l.pos[1], label: l.name, kind: 'Lugar' });
    for (const s of this.data.shops || []) if (norm(s.name).includes(q) || norm(describeShop(s)).includes(q)) out.push({ x: s.x, z: s.z, label: s.name, kind: describeShop(s) });
    const streets = new Map();
    for (const r of this.data.roads) {
      if (!r.name || !norm(r.name).includes(q) || streets.has(r.name)) continue;
      const p = r.pts[Math.floor(r.pts.length / 2)];
      streets.set(r.name, { x: p[0], z: p[1], label: r.name, kind: 'Calle' });
    }
    out.push(...streets.values());
    // nearest first when searching a rubro ("farmacia", "parrilla")
    if (this.player) out.sort((a, b) => (a.kind === 'Dirección' ? -1 : 0) - (b.kind === 'Dirección' ? -1 : 0) || Math.hypot(a.x - this.player[0], a.z - this.player[1]) - Math.hypot(b.x - this.player[0], b.z - this.player[1]));
    return out.slice(0, 8);
  }

  // ------------------------------------------------ route
  setDestination(x, z, label) {
    const n = this.graph.nearest(x, z, 200);
    this.dest = n ? { x: n.x, z: n.z, label } : { x, z, label };
    this.route = null;
    this.timer = 0;
    this.hud.toast(`Destino: ${label}`);
    if (this.player) this.update(0, ...this.player, this.driving); // so the open map shows the route now
  }

  clear() {
    this.dest = this.route = null;
    this.hud.setGps(null);
  }

  update(dt, px, pz, driving) {
    this.player = [px, pz];
    this.driving = driving;
    if (!this.dest) return;
    const straight = Math.hypot(this.dest.x - px, this.dest.z - pz);
    if (straight < 18) {
      this.hud.message('LLEGASTE', '#f5c518', 2.5);
      this.hud.toast(`Llegaste a ${this.dest.label}`);
      this.clear();
      return;
    }
    // re-route every second, or right away when off the current route
    this.timer -= dt;
    const off = this.route && Math.min(...this.route.slice(0, 6).map(([x, z]) => Math.hypot(x - px, z - pz))) > 30;
    if (this.timer <= 0 || off || !this.route) {
      this.timer = 1;
      const from = this.graph.nearestNode(px, pz, 300), to = this.graph.nearestNode(this.dest.x, this.dest.z, 300);
      const nodes = (driving && this.graph.path(from, to, 50000, true)) || this.graph.path(from, to, 50000);
      this.route = nodes ? [[px, pz], ...nodes.map((n) => [n.x, n.z]), [this.dest.x, this.dest.z]] : [[px, pz], [this.dest.x, this.dest.z]];
    } else {
      this.route[0] = [px, pz];
    }
    // drop the nodes already passed
    while (this.route.length > 2 && Math.hypot(this.route[1][0] - px, this.route[1][1] - pz) < 12) this.route.splice(1, 1);
    let d = 0;
    for (let i = 1; i < this.route.length; i++) d += Math.hypot(this.route[i][0] - this.route[i - 1][0], this.route[i][1] - this.route[i - 1][1]);
    this.remaining = d;
    this.hud.setGps(this.dest.label, formatDistance(d));
  }

  // ------------------------------------------------ full-screen map
  buildUi() {
    const el = (this.el = document.getElementById('bigmap'));
    this.canvas = el.querySelector('canvas');
    this.input = el.querySelector('input');
    this.results = el.querySelector('.results');
    this.view = { x: 0, z: 0, zoom: 1 }; // map px per canvas px
    let drag = null;
    const toWorld = (cx, cy) => {
      const r = this.canvas.getBoundingClientRect();
      const mx = this.view.x + (cx - r.left - r.width / 2) / this.view.zoom, mz = this.view.z + (cy - r.top - r.height / 2) / this.view.zoom;
      return [mx / this.hud.scale + this.hud.ox, mz / this.hud.scale + this.hud.oz];
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vz: this.view.z, moved: false, touches: 1 };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      this.view.x = drag.vx - dx / this.view.zoom;
      this.view.z = drag.vz - dy / this.view.zoom;
      this.draw();
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved) {
        const [x, z] = toWorld(e.clientX, e.clientY);
        const n = this.graph.nearest(x, z, 120);
        this.setDestination(x, z, n?.seg.road.name ? `${n.seg.road.name}` : 'punto marcado');
        this.draw();
      }
      drag = null;
    });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.25 : 0.8);
    }, { passive: false });
    el.querySelector('.zin').addEventListener('click', () => this.zoomBy(1.4));
    el.querySelector('.zout').addEventListener('click', () => this.zoomBy(1 / 1.4));
    el.querySelector('.clear').addEventListener('click', () => { this.clear(); this.draw(); });
    el.querySelector('.close').addEventListener('click', () => this.toggle(false));
    this.input.addEventListener('input', () => this.showResults());
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.results.querySelector('li')?.click();
      if (e.key === 'Escape') this.toggle(false);
    });
    addEventListener('resize', () => this.open && this.draw());
  }

  showResults() {
    this.results.innerHTML = '';
    for (const r of this.search(this.input.value)) {
      const li = document.createElement('li');
      li.innerHTML = `<b></b><small></small>`;
      li.querySelector('b').textContent = r.label;
      li.querySelector('small').textContent = r.kind;
      li.addEventListener('click', () => {
        this.setDestination(r.x, r.z, r.label);
        this.results.innerHTML = '';
        this.input.value = r.label;
        this.view.x = (r.x - this.hud.ox) * this.hud.scale;
        this.view.z = (r.z - this.hud.oz) * this.hud.scale;
        this.draw();
      });
      this.results.appendChild(li);
    }
    if (this.input.value.trim().length > 1 && !this.results.children.length) this.results.innerHTML = '<li class="none">Sin resultados</li>';
  }

  zoomBy(f) {
    this.view.zoom = Math.min(8, Math.max(0.15, this.view.zoom * f));
    this.draw();
  }

  toggle(on = !this.open, px, pz) {
    this.open = on;
    this.el.classList.toggle('hidden', !on);
    if (!on) return;
    document.exitPointerLock?.();
    if (px !== undefined) {
      this.view.x = (px - this.hud.ox) * this.hud.scale;
      this.view.z = (pz - this.hud.oz) * this.hud.scale;
      this.view.zoom = 1.6;
    }
    this.draw();
    if (!document.body.classList.contains('touch')) this.input.focus();
  }

  draw() {
    const c = this.canvas, ctx = c.getContext('2d');
    const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#6f7d62';
    ctx.fillRect(0, 0, r.width, r.height);
    const { x, z, zoom } = this.view, S = this.hud.scale;
    ctx.save();
    ctx.translate(r.width / 2, r.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -z);
    ctx.imageSmoothingEnabled = zoom < 2;
    ctx.drawImage(this.hud.map, 0, 0);
    const P = (wx, wz) => [(wx - this.hud.ox) * S, (wz - this.hud.oz) * S];
    if (this.route) {
      ctx.strokeStyle = '#b44bff';
      ctx.lineWidth = 5 / zoom;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      this.route.forEach(([wx, wz], i) => ctx[i ? 'lineTo' : 'moveTo'](...P(wx, wz)));
      ctx.stroke();
    }
    ctx.font = `bold ${12 / zoom}px sans-serif`;
    for (const l of this.data.landmarks || []) {
      if (l.minor && zoom < 2.2) continue;
      const [lx, lz] = P(l.pos[0], l.pos[1]);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(lx - 3 / zoom, lz - 3 / zoom, 6 / zoom, 6 / zoom);
      ctx.fillStyle = '#10213d';
      ctx.fillText(l.name, lx + 5 / zoom, lz + 4 / zoom);
    }
    if (this.dest) pin(ctx, ...P(this.dest.x, this.dest.z), zoom);
    ctx.restore();
    // street names in screen space: more of them as you zoom in, never overlapping
    ctx.save();
    ctx.font = `bold ${zoom > 3 ? 14 : 12}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const placed = [];
    const gap = zoom < 0.6 ? 220 : zoom < 1.2 ? 150 : 110;
    for (const l of this.hud.streetLabels) {
      if (!l.major && zoom < 0.9) continue;
      const sx = r.width / 2 + ((l.x - this.hud.ox) * S - x) * zoom, sy = r.height / 2 + ((l.z - this.hud.oz) * S - z) * zoom;
      if (sx < -50 || sy < -20 || sx > r.width + 50 || sy > r.height + 20) continue;
      if (placed.some(([px, py]) => Math.hypot(px - sx, py - sy) < gap)) continue;
      placed.push([sx, sy]);
      drawLabel(ctx, l.name, sx, sy, l.angle, l.major);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(r.width / 2, r.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -z);
    if (this.player) {
      const [ppx, ppz] = P(...this.player);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(ppx, ppz, 7 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function pin(ctx, x, y, zoom) {
  const s = 1 / zoom;
  ctx.fillStyle = '#f5c518';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x, y - 16 * s, 9 * s, Math.PI, 0);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

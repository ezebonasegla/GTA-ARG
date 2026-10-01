#!/usr/bin/env node
// Adds businesses from a CSV export of Google Maps places (columns Name, Category,
// Address, Maps URL with "!3d<lat>!4d<lon>") to public/data/quilmes.json `shops`.
// Only name, kind and position are kept. A place already mapped from OSM (same name
// nearby) is updated in place instead of duplicated.
//   node scripts/import-places.mjs ~/Downloads/places.csv [--kind restaurant]
import fs from 'node:fs';
import { makeProjection, pointInPolygon } from '../src/world/geo.js';

const [csvPath, ...rest] = process.argv.slice(2);
if (!csvPath) throw new Error('uso: node scripts/import-places.mjs archivo.csv [--kind restaurant]');
const kindArg = rest[rest.indexOf('--kind') + 1] && rest.includes('--kind') ? rest[rest.indexOf('--kind') + 1] : 'restaurant';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, '').trim(), (r[i] || '').trim()])));
}

// Places that aren't storefronts: they become searchable map places (data.landmarks).
const PLACE = /parque|plaza|estaci[oó]n de tren|museo|biblioteca|centro cultural|centro art[ií]stico|parroquia|iglesia|urbanizaci[oó]n|complejo de viviendas|condominio|oficinas de administraci|boleter[ií]a/i;
// Google category (Spanish) -> OSM-like kind
const CATEGORY = [
  [/discoteca|boliche|bailable|nightclub/i, 'nightclub'],
  [/hotel|motel|apartamento vacacional|hostel/i, 'hotel'],
  [/colchoner|mueble/i, 'furniture'],
  [/florer|jardiner[ií]a/i, 'florist'],
  [/librer/i, 'books'],
  [/vinoteca/i, 'wine'],
  [/ropa/i, 'clothes'],
  [/telecomunicaci/i, 'mobile_phone'],
  [/alquiler de coches/i, 'car_rental'],
  [/taller de reparaci/i, 'car_repair'],
  [/materiales para la construcci/i, 'building_materials'],
  [/oftalmolog|cl[ií]nica|m[eé]dic/i, 'clinic'],
  [/centro comercial/i, 'mall'],
  [/bingo|sal[oó]n para eventos/i, 'events'],
  [/cervecer/i, 'pub'],
  [/\bbar\b|pub|lounge/i, 'bar'],
  [/restaurante|parrilla|pizza|hamburguesa|comida/i, 'restaurant'],
];

// kind from the category, else from the name (the exported Category column is often
// shifted into the rating); null = not enough to know what it is
function kindOf(name, category) {
  const cat = /^\d,\d\(/.test(category) ? '' : category;
  for (const [re, kind] of CATEGORY) if (re.test(cat)) return kind;
  if (/hotel/i.test(name)) return 'hotel';
  if (!cat && !/^\d,\d\(/.test(category)) return null;
  const s = `${name} ${cat}`.toLowerCase();
  if (/caf[eé]|bakery|boulangerie|chocolat|crepe|ice roll|medialuna/.test(s)) return 'cafe';
  if (/burger|hamburg|papas|mostrador/.test(s)) return 'fast_food';
  if (/cervec|brewing|beer|birr|antares|wine|vinsanto|barric|\bbar\b|taberna|pub/.test(s)) return 'bar';
  return kindArg;
}

const file = new URL('../public/data/quilmes.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file));
const proj = makeProjection(data.origin);
const { minX, minZ, maxX, maxZ } = data.bounds;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
let added = 0, updated = 0, skipped = 0, places = 0, unknown = 0;
data.landmarks ||= [];
for (const r of parseCsv(fs.readFileSync(csvPath, 'utf8'))) {
  const m = (r['Maps URL'] || '').match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
  if (!m || !r.Name) continue;
  const [x, z] = proj.toWorld(+m[1], +m[2]).map((v) => Math.round(v * 10) / 10);
  if (x < minX || x > maxX || z < minZ || z > maxZ || (data.extent && !data.extent.some((poly) => pointInPolygon(x, z, poly)))) { skipped++; continue; }
  const name = r.Name.replace(/\s*[|·-]\s*(quilmes.*)?$/i, '').replace(/^"|"$/g, '').trim() || r.Name;
  if (PLACE.test(r.Category) || /^(plaza|parque|plazoleta)\b/i.test(name)) {
    const near = data.landmarks.some((l) => Math.hypot(l.pos[0] - x, l.pos[1] - z) < 120 && norm(l.name).includes(norm(name).replace(/^(plaza|parque) /, '')));
    if (!near) {
      data.landmarks.push({ name: name.replace(/"/g, ''), pos: [x, z], minor: true });
      places++;
    }
    continue;
  }
  const kind = kindOf(r.Name, r.Category);
  if (!kind) { unknown++; continue; }
  const key = norm(name);
  const same = data.shops.find((s) => Math.hypot(s.x - x, s.z - z) < 80 && (norm(s.name).includes(key) || key.includes(norm(s.name))));
  if (same) {
    Object.assign(same, { x, z, kind: same.kind === 'restaurant' || !same.kind || kind === 'nightclub' ? kind : same.kind });
    updated++;
  } else {
    data.shops.push({ name, kind, x, z });
    added++;
  }
}
fs.writeFileSync(file, JSON.stringify(data));
console.log(`${added} negocios agregados, ${updated} actualizados, ${places} lugares nuevos en el mapa, ${unknown} sin datos suficientes, ${skipped} fuera del mapa`);

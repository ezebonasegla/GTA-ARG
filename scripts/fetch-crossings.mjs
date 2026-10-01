#!/usr/bin/env node
// Adds to public/data/quilmes.json what makes the autopista and the railway closed
// corridors: the autopista's ramps (motorway_link), the bridges and tunnels where
// streets cross them (puentes, pasos bajo nivel) and the level crossings of the tracks.
//
//   node scripts/fetch-crossings.mjs            # Overpass, cached in .cache/crossings-raw.json
//   node scripts/fetch-crossings.mjs --cached   # reuse the cache
//
// Map data © OpenStreetMap contributors, available under the ODbL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUILMES_CENTER, makeProjection, bbox, closestOnSegment } from '../src/world/geo.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataFile = path.join(root, 'public/data/quilmes.json');
const cacheFile = path.join(root, '.cache/crossings-raw.json');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const proj = makeProjection(QUILMES_CENTER);
const ext = bbox(data.extent.flat());
const kx = 111320 * Math.cos((QUILMES_CENTER.lat * Math.PI) / 180), kz = 110540;
const bb = [QUILMES_CENTER.lat - (ext.maxZ + 200) / kz, QUILMES_CENTER.lon + (ext.minX - 200) / kx, QUILMES_CENTER.lat - (ext.minZ - 200) / kz, QUILMES_CENTER.lon + (ext.maxX + 200) / kx]
  .map((v) => v.toFixed(6)).join(',');

async function download() {
  const query = `[out:json][timeout:180];
(
  way["highway"~"^(motorway|motorway_link|trunk_link)$"](${bb});
  way["highway"]["bridge"](${bb});
  way["highway"]["tunnel"](${bb});
  way["railway"~"^(rail|light_rail)$"]["bridge"](${bb});
  node["railway"~"^(level_crossing|crossing)$"](${bb});
);
out geom;`;
  for (const url of ENDPOINTS) {
    try {
      console.log(`Overpass: ${new URL(url).host}…`);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'gta-quilmes/0.1' }, body: 'data=' + encodeURIComponent(query) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(json));
      return json;
    } catch (e) {
      console.warn(`  falló: ${e.message}`);
    }
  }
  throw new Error('Overpass no respondió');
}

const osm = process.argv.includes('--cached') ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : await download();
const r1 = (v) => Math.round(v * 10) / 10;
const toPts = (g) => g.map((p) => proj.toWorld(p.lat, p.lon)).map(([x, z]) => [r1(x), r1(z)]);
const inExt = ([x, z]) => x > ext.minX - 100 && x < ext.maxX + 100 && z > ext.minZ - 100 && z < ext.maxZ + 100;

const ramps = [], decks = [], levelCrossings = [];
for (const el of osm.elements) {
  const t = el.tags || {};
  if (el.type === 'node') {
    const p = proj.toWorld(el.lat, el.lon).map(r1);
    if (inExt(p)) levelCrossings.push({ x: p[0], z: p[1], ped: t.railway === 'crossing' });
    continue;
  }
  if (!el.geometry) continue;
  let pts = toPts(el.geometry);
  if (!pts.some(inExt)) continue;
  const name = t.name || '';
  if (t.bridge && t.bridge !== 'no') decks.push({ type: 'bridge', pts, layer: +(t.layer || 1), rail: !!t.railway, name, highway: t.highway || '' });
  else if (t.tunnel && t.tunnel !== 'no') decks.push({ type: 'tunnel', pts, layer: +(t.layer || -1), name, highway: t.highway || '' });
  if (/_link$/.test(t.highway || '')) {
    if (t.oneway === '-1') pts = pts.reverse();
    const lanes = parseFloat(t.lanes) || 1;
    ramps.push({ pts, w: Math.max(7, lanes * 3.5 + 2), name, kind: 'secondary', oneway: t.oneway !== 'no', ramp: true });
  }
}

// ramps become roads (replacing any from a previous run)
data.roads = data.roads.filter((r) => !r.ramp).concat(ramps);
// the motorway itself, by the OSM tag rather than by its width
const mw = osm.elements.filter((e) => e.tags?.highway === 'motorway' && e.geometry).map((e) => toPts(e.geometry));
const onMw = ([x, z]) => mw.some((m) => m.some((p, i) => i > 0 && closestOnSegment(x, z, m[i - 1][0], m[i - 1][1], p[0], p[1])[3] < 4));
for (const r of data.roads) {
  delete r.motorway;
  if (r.kind === 'primary' && r.oneway && r.pts.every(onMw)) r.motorway = true;
}
data.decks = decks;
data.levelCrossings = levelCrossings;
fs.writeFileSync(dataFile, JSON.stringify(data));
console.log(`rampas ${ramps.length}, autopista ${data.roads.filter((r) => r.motorway).length} tramos, puentes ${decks.filter((d) => d.type === 'bridge').length}, túneles ${decks.filter((d) => d.type === 'tunnel').length}, pasos a nivel ${levelCrossings.length}`);

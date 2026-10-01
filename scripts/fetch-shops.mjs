#!/usr/bin/env node
// Named businesses from OpenStreetMap (Overpass) -> public/data/quilmes.json `shops`:
//   npm run fetch-shops
// Map data © OpenStreetMap contributors, available under the ODbL.
import fs from 'node:fs';
import { makeProjection, pointInPolygon } from '../src/world/geo.js';

const file = new URL('../public/data/quilmes.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file));
const proj = makeProjection(data.origin);
const { minX, minZ, maxX, maxZ } = data.bounds;
const dLat = Math.max(-minZ, maxZ) / 110900, dLon = Math.max(-minX, maxX) / 91500;
const o = data.origin;
const bb = [o.lat - dLat, o.lon - dLon, o.lat + dLat, o.lon + dLon].map((v) => v.toFixed(5)).join(',');
const AMENITY = 'restaurant|cafe|bar|pub|fast_food|ice_cream|pharmacy|bank|biergarten';
const query = `[out:json][timeout:120];(nwr["shop"]["name"](${bb});nwr["amenity"~"^(${AMENITY})$"]["name"](${bb}););out center;`;

let osm;
for (const url of ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
  try {
    const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'gta-quilmes/0.1 (github.com/ezebonasegla/GTA-ARG)' } });
    if (res.ok) { osm = await res.json(); break; }
    console.warn(`${url}: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`${url}: ${e.message}`);
  }
}
if (!osm) throw new Error('Overpass no respondió');

const seen = new Set();
data.shops = [];
for (const el of osm.elements) {
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  const t = el.tags;
  const [x, z] = proj.toWorld(lat, lon);
  if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
  if (data.extent && !data.extent.some((poly) => pointInPolygon(x, z, poly))) continue;
  const key = `${t.name}@${Math.round(x / 10)},${Math.round(z / 10)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  data.shops.push({ name: t.name.trim(), kind: t.amenity || t.shop, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
}
fs.writeFileSync(file, JSON.stringify(data));
console.log(`${data.shops.length} negocios guardados`);

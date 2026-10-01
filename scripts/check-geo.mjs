// node scripts/check-geo.mjs: the game projection must match the 3D Tiles ENU frame.
import assert from 'node:assert/strict';
import { QUILMES_CENTER, makeProjection } from '../src/world/geo.js';

// Reference east/south meters from the WGS84 East-North-Up frame at Plaza San Martín
// (computed with 3d-tiles-renderer's ellipsoid, the frame the real-world map tiles use).
const REF = [
  [-34.7066, -58.2388, 1447.483, -1552.981],
  [-34.755, -58.298, -3973.679, 3817.048],
  [-34.69, -58.2, 5003.058, -3393.259],
  [-34.748, -58.22, 3168.223, 3040.183],
];
const proj = makeProjection(QUILMES_CENTER);
assert.deepEqual(proj.toWorld(QUILMES_CENTER.lat, QUILMES_CENTER.lon).map((v) => Math.abs(v)), [0, 0]);
let worst = 0;
for (const [lat, lon, ex, ez] of REF) {
  const [x, z] = proj.toWorld(lat, lon);
  worst = Math.max(worst, Math.hypot(x - ex, z - ez));
}
assert.ok(worst < 0.01, `projection off by ${worst} m`);
console.log(`geo ok (max error ${(worst * 1000).toFixed(3)} mm)`);

// Every fixed landmark must sit on its real footprint in the baked map.
const { HITOS } = await import('../src/world/landmarks.js');
const fs = await import('node:fs');
const data = JSON.parse(fs.readFileSync(new URL('../public/data/quilmes.json', import.meta.url)));
const specials = [...data.specials, ...data.buildings.filter((b) => b.special).map((b) => b.special)];
for (const [id, h] of Object.entries(HITOS)) {
  if (!h.special) continue;
  const [x, z] = proj.toWorld(h.lat, h.lon);
  const d = Math.min(...specials.filter((s) => s.type === h.special).map((s) => Math.hypot((s.box ?? s).cx - x, (s.box ?? s).cz - z)));
  assert.ok(d < h.tol, `${id} is ${d.toFixed(1)} m from its footprint`);
}
console.log('hitos ok');

// Storefronts go only on the wall that faces the street.
const { frontRoad } = await import('../src/world/builder.js');
const { RoadGraph } = await import('../src/world/roadGraph.js');
const g = new RoadGraph([{ pts: [[-50, 0], [50, 0]], w: 8, kind: 'residential', name: 'Rivadavia' }]);
const lot = [[5, 7], [5, 20], [-5, 20], [-5, 7]]; // positive polygonArea like builder; street wall is -5,7 -> 5,7
const faces = lot.map((p, i) => frontRoad(g, p, lot[(i + 1) % 4]));
assert.deepEqual(faces.map((f) => f?.road.name ?? null), [null, null, null, 'Rivadavia']);
assert.equal(faces[3].room, 3);
console.log('frontRoad ok');

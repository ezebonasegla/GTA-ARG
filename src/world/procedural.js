// Procedural approximation of central Quilmes, used when no OSM export is present
// (public/data/quilmes.json). The street grid, orientation (streets perpendicular
// and parallel to the Río de la Plata), block size, the Roca railway, the plaza,
// the cathedral and the costanera follow the real layout, but positions and street
// assignments are approximate. Run `npm run fetch-osm` for the real geometry.
import { mulberry32, QUILMES_CENTER } from './geo.js';

const PITCH = 100; // distance between street centerlines (manzana ~86 m + calle)

// Streets perpendicular to the river (running SW -> NE), ordered NW -> SE.
const CROSS_STREETS = [
  'Av. Otamendi', 'Garibaldi', 'Humberto Primo', 'Moreno', 'Alvear', 'Mitre',
  'Rivadavia', 'Sarmiento', 'Alsina', 'Brown', 'Lavalle', 'Av. Vicente López',
  'Conesa', 'Paz', 'Olavarría', 'Guido', 'Av. Lamadrid',
];
// Streets parallel to the river (running NW -> SE), ordered inland (SW) -> river (NE).
const LONG_STREETS = [
  'Av. Hipólito Yrigoyen', '(vías del Roca)', 'Av. Gaboto', 'Alberdi', 'San Martín',
  'Belgrano', 'Lugones', 'Colón', 'Pringles', 'Rodolfo López',
  'Av. Cervantes', 'Castelli', 'Primera Junta', 'Posadas', 'Balcarce', 'Avellaneda',
  'Maipú', 'Chacabuco', 'Pellegrini', 'Av. Ramón Franco', 'Laprida', 'Av. Costanera',
];

const I_MIN = -8, I_MAX = 8; // cross-street lines (u = i * PITCH)
const J_MIN = -2, J_MAX = LONG_STREETS.length - 3; // long-street lines (v = j * PITCH)
const RAIL_J = -1;
const PLAZA = { i: -2, j: 1 }; // block whose lower-left line indices are (i, j)
const BEARING = 42; // degrees: the "towards the river" axis points roughly NE

const isAvenue = (name) => name.startsWith('Av.');

export function generateQuilmes() {
  const rng = mulberry32(1666); // Quilmes was founded in 1666
  const a = (BEARING * Math.PI) / 180;
  // v axis (towards river) and u axis (along river, towards SE) in world x/z.
  const vx = Math.sin(a), vz = -Math.cos(a);
  const ux = -vz, uz = vx;
  const W = (u, v) => [u * ux + v * vx, u * uz + v * vz];

  const crossName = (i) => CROSS_STREETS[i - I_MIN];
  const longName = (j) => LONG_STREETS[j - J_MIN];
  const crossWidth = (i) => (isAvenue(crossName(i)) ? 22 : 11);
  const longWidth = (j) => (j === RAIL_J ? 26 : isAvenue(longName(j)) ? 22 : 11);

  const roads = [];
  const buildings = [];
  const areas = [];
  const rails = [];
  const landmarks = [];

  // --- Roads ---------------------------------------------------------------
  for (let i = I_MIN; i <= I_MAX; i++) {
    const name = crossName(i);
    const w = crossWidth(i);
    const avenue = isAvenue(name);
    for (let j = J_MIN; j < J_MAX; j++) {
      // Only avenues (and Rivadavia, next to the station) cross the railway.
      if ((j === RAIL_J || j + 1 === RAIL_J) && !avenue && name !== 'Rivadavia') {
        if (j + 1 === RAIL_J) {
          // dead end before the tracks
          roads.push(road([W(i * PITCH, j * PITCH), W(i * PITCH, (j + 1) * PITCH - 16)], w, name, avenue, i));
        } else {
          roads.push(road([W(i * PITCH, j * PITCH + 16), W(i * PITCH, (j + 1) * PITCH)], w, name, avenue, i));
        }
        continue;
      }
      if (name === 'Rivadavia' && j >= 0 && j < 2) {
        // Peatonal Rivadavia next to the plaza: narrow, still drivable in-game.
        roads.push({ ...road([W(i * PITCH, j * PITCH), W(i * PITCH, (j + 1) * PITCH)], 9, 'Peatonal Rivadavia', false, i), kind: 'pedestrian', oneway: false });
        continue;
      }
      roads.push(road([W(i * PITCH, j * PITCH), W(i * PITCH, (j + 1) * PITCH)], w, name, avenue, i));
    }
  }
  for (let j = J_MIN; j <= J_MAX; j++) {
    if (j === RAIL_J) continue;
    const name = longName(j);
    const w = longWidth(j);
    const avenue = isAvenue(name);
    for (let i = I_MIN; i < I_MAX; i++) {
      roads.push(road([W(i * PITCH, j * PITCH), W((i + 1) * PITCH, j * PITCH)], w, name, avenue, j + 1));
    }
  }

  function road(pts, w, name, avenue, parity) {
    // Argentine grids alternate one-way directions street by street.
    let oneway = !avenue;
    if (oneway && parity % 2 === 0) pts = pts.slice().reverse();
    return { pts, w, name, kind: avenue ? 'primary' : 'residential', oneway };
  }

  // --- Railway (Línea Roca) ------------------------------------------------
  const railV = RAIL_J * PITCH;
  for (const off of [-2.2, 2.2]) {
    rails.push({ pts: [W(I_MIN * PITCH - 200, railV + off), W(I_MAX * PITCH + 200, railV + off)] });
  }
  areas.push({ kind: 'railway', pts: rectW(W, I_MIN * PITCH - 200, railV - 12, I_MAX * PITCH + 200, railV + 12) });

  // --- Costanera and river -------------------------------------------------
  const riverV = J_MAX * PITCH;
  areas.push({ kind: 'park', pts: rectW(W, I_MIN * PITCH - 300, riverV + 12, I_MAX * PITCH + 300, riverV + 110) });
  areas.push({ kind: 'sand', pts: rectW(W, I_MIN * PITCH - 300, riverV + 110, I_MAX * PITCH + 300, riverV + 135) });
  areas.push({ kind: 'water', pts: rectW(W, I_MIN * PITCH - 3000, riverV + 135, I_MAX * PITCH + 3000, riverV + 5000) });
  landmarks.push({ name: 'Costanera de Quilmes', pos: W(0, riverV + 60) });

  // --- Blocks and lots ------------------------------------------------------
  for (let i = I_MIN; i < I_MAX; i++) {
    for (let j = J_MIN; j < J_MAX; j++) {
      const u0 = i * PITCH + crossWidth(i) / 2 + 3;
      const u1 = (i + 1) * PITCH - crossWidth(i + 1) / 2 - 3;
      let v0 = j * PITCH + (j === RAIL_J ? 13 : longWidth(j) / 2 + 3);
      let v1 = (j + 1) * PITCH - (j + 1 === RAIL_J ? 13 : longWidth(j + 1) / 2 + 3);
      const cu = (i + 0.5) * PITCH, cv = (j + 0.5) * PITCH;
      const dist = Math.hypot(cu - (PLAZA.i + 0.5) * PITCH, cv - (PLAZA.j + 0.5) * PITCH);

      if (i === PLAZA.i && j === PLAZA.j) {
        areas.push({ kind: 'plaza', pts: rectW(W, u0 - 3, v0 - 3, u1 + 3, v1 + 3) });
        landmarks.push({ name: 'Plaza San Martín', pos: W(cu, cv) });
        // monument in the middle of the plaza
        buildings.push({ pts: rectW(W, cu - 2, cv - 2, cu + 2, cv + 2), h: 6, style: 'monument' });
        continue;
      }
      if (i === PLAZA.i && j === PLAZA.j + 1) {
        // Catedral de la Inmaculada Concepción facing the plaza
        const cw = 26;
        buildings.push({ pts: rectW(W, cu - cw / 2, v0, cu + cw / 2, v0 + 55), h: 17, style: 'church', roof: 'gable', name: 'Catedral de Quilmes' });
        buildings.push({ pts: rectW(W, cu - 5, v0 - 1, cu + 5, v0 + 9), h: 42, style: 'church', roof: 'spire' });
        landmarks.push({ name: 'Catedral de Quilmes', pos: W(cu, v0 + 20) });
        fillBlock(u0, v0, u1, v1, dist, i, j, { skip: (lu0, lv0, lu1, lv1) => lu1 > cu - cw / 2 - 2 && lu0 < cu + cw / 2 + 2 && lv0 < v0 + 60 });
        continue;
      }
      if (i === PLAZA.i + 1 && j === PLAZA.j) {
        buildings.push({ pts: rectW(W, u0, v0, u0 + 60, v0 + 34), h: 14, style: 'civic', name: 'Municipalidad de Quilmes' });
        landmarks.push({ name: 'Municipalidad', pos: W(u0 + 30, v0 + 17) });
        fillBlock(u0, v0, u1, v1, dist, i, j, { skip: (lu0, lv0) => lu0 < u0 + 62 && lv0 < v0 + 36 });
        continue;
      }
      if (j === RAIL_J && i === PLAZA.i) {
        buildings.push({ pts: rectW(W, u0 + 10, v0, u1 - 10, v0 + 14), h: 9, style: 'station', roof: 'gable', name: 'Estación Quilmes' });
        landmarks.push({ name: 'Estación Quilmes', pos: W(cu, v0 + 7) });
        continue;
      }
      if (j === RAIL_J - 1 && i === PLAZA.i) {
        // big shopping block south of the tracks
        buildings.push({ pts: rectW(W, u0, v0, u1, v1 - 10), h: 12, style: 'mall', name: 'Shopping' });
        continue;
      }
      if ((i === 4 && j === 8) || (i === -6 && j === 12)) {
        areas.push({ kind: 'park', pts: rectW(W, u0 - 3, v0 - 3, u1 + 3, v1 + 3) });
        continue;
      }
      if (i === 2 && j === 5) {
        // stadium-like sports club block
        areas.push({ kind: 'pitch', pts: rectW(W, u0 + 8, v0 + 12, u1 - 8, v1 - 12) });
        buildings.push({ pts: rectW(W, u0, v0, u1, v0 + 10), h: 9, style: 'brick' });
        buildings.push({ pts: rectW(W, u0, v1 - 10, u1, v1), h: 9, style: 'brick' });
        landmarks.push({ name: 'Club (cancha)', pos: W(cu, cv) });
        continue;
      }
      fillBlock(u0, v0, u1, v1, dist, i, j);
    }
  }

  function fillBlock(u0, v0, u1, v1, dist, i, j, opts = {}) {
    const center = dist < 450;
    const mid = dist < 900;
    const commercialStreet = ['Rivadavia', 'Mitre', 'Av. Hipólito Yrigoyen', 'Av. Vicente López', 'Av. Otamendi'];
    const sideIsCommercial = (name) => commercialStreet.includes(name) || isAvenue(name);
    // sides: [start, end, frontCoord, inwardSign, axis, streetName]
    const sides = [
      { axis: 'u', from: u0, to: u1, front: v0, dir: 1, street: j === RAIL_J ? null : longName(j) },
      { axis: 'u', from: u0, to: u1, front: v1, dir: -1, street: j + 1 === RAIL_J ? null : longName(j + 1) },
      { axis: 'v', from: v0 + 26, to: v1 - 26, front: u0, dir: 1, street: crossName(i) },
      { axis: 'v', from: v0 + 26, to: v1 - 26, front: u1, dir: -1, street: crossName(i + 1) },
    ];
    for (const side of sides) {
      let s = side.from;
      while (side.to - s > 5) {
        const r = rng();
        let type, width, floors, depth;
        const tower = center ? r < 0.3 : mid ? r < 0.1 : r < 0.025;
        if (tower) {
          type = rng() < 0.5 ? 'apartments' : rng() < 0.6 ? 'brick' : 'office';
          width = 12 + rng() * 14;
          floors = center ? 7 + Math.floor(rng() * 12) : 4 + Math.floor(rng() * 7);
          depth = 20 + rng() * 6;
        } else {
          const r2 = rng();
          type = r2 < 0.55 ? 'house' : r2 < 0.8 ? 'brick' : 'ph';
          width = 7 + rng() * 4;
          floors = rng() < (center ? 0.6 : 0.3) ? 2 : 1;
          if (rng() < 0.08) floors = 3;
          depth = 14 + rng() * 12;
        }
        width = Math.min(width, side.to - s);
        if (side.to - s - width < 5) width = side.to - s;
        if (rng() < (center ? 0.02 : 0.06)) {
          s += width; // baldío / empty lot
          continue;
        }
        const setback = !center && !tower && type === 'house' && rng() < 0.35 ? 2 + rng() * 3 : 0;
        const f0 = side.front + side.dir * setback;
        const f1 = side.front + side.dir * (setback + depth);
        let rect;
        if (side.axis === 'u') rect = [s, Math.min(f0, f1), s + width, Math.max(f0, f1)];
        else rect = [Math.min(f0, f1), s, Math.max(f0, f1), s + width];
        if (!opts.skip || !opts.skip(...rect)) {
          const shop = side.street && sideIsCommercial(side.street) && rng() < (center ? 0.85 : 0.5);
          const h = floors * 3 + (shop ? 1 : 0) + rng() * 0.6;
          const b = { pts: rectW(W, ...rect), h: +h.toFixed(1), style: type, levels: floors };
          if (shop) b.shop = true;
          if (!tower && type === 'house' && rng() < 0.25) b.roof = 'gable';
          buildings.push(b);
        }
        s += width;
      }
    }
  }

  const all = roads.flatMap((r) => r.pts).concat(buildings.flatMap((b) => b.pts));
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of all) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }

  const spawnUV = [(PLAZA.i + 0.5) * PITCH, PLAZA.j * PITCH - 7.5];
  return {
    source: 'procedural',
    origin: QUILMES_CENTER,
    bounds: { minX, minZ, maxX, maxZ },
    roads,
    buildings,
    areas,
    rails,
    landmarks,
    spawn: W(...spawnUV),
    spawnHeading: Math.atan2(vx, vz),
  };
}

function rectW(W, u0, v0, u1, v1) {
  return [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)];
}

"""Quilmes instead of New York in the slop engine (argv[1] = app dir; run after adapt_quilmes.py).

Taxis porteños (black, yellow roof), Mercosur plates, colectivo colours, km/h and metres, Quilmes camera spots,
no USPS mailboxes, the menus in Spanish.
"""
import re
import sys

S = sys.argv[1]
_files = {}


def src(p):
    if p not in _files:
        _files[p] = open(f'{S}/{p}').read()
    return _files[p]


def rep(p, old, new, count=1):
    s = src(p)
    if new in s:
        return  # already applied
    if old not in s:
        raise SystemExit(f'{p}: not found: {old[:80]!r}')
    _files[p] = s.replace(old, new, count if count else -1)


# ------------------------------------------------------------------ cars: taxis, plates
rep('js/cars.js', """      const grime = smoothstep(sillY + 0.16, sillY - 0.01, p.y).mul(0.2);""",
    """      const grime = smoothstep(sillY + 0.16, sillY - 0.01, p.y).mul(0.2);
      if (spec.sign) {
        // taxi porteño: black body, yellow roof
        const roof = smoothstep(0.55, 0.8, n.y).mul(smoothstep(0.2, 0.26, p.y.sub(belt)));
        bCol.assign(mix(bCol, color(0xf2b316).mul(ao), roof));
      }""")
rep('js/cars.js', """  const rows = [
    { bg: '#f2b718', bar: '#14233c', fg: '#14233c', label: 'KBM-4728' },
    { bg: '#e8edf2', bar: '#162b4c', fg: '#162b4c', label: 'JTR-8319' },
    { bg: '#f2b718', bar: '#14233c', fg: '#14233c', label: 'HXL-2506' },
    { bg: '#f0b416', bar: '#14233c', fg: '#14233c', label: 'T748219C' }
  ];""", """  // Mercosur plates (white, blue band) and the older black Argentine ones
  const rows = [
    { bg: '#f4f6f8', bar: '#1a3d8f', fg: '#111111', label: 'AE 482 KD', top: 'REPUBLICA ARGENTINA' },
    { bg: '#f4f6f8', bar: '#1a3d8f', fg: '#111111', label: 'AF 193 RT', top: 'REPUBLICA ARGENTINA' },
    { bg: '#111317', bar: '#111317', fg: '#f2f2f2', label: 'MKL 406', top: '' },
    { bg: '#f4f6f8', bar: '#1a3d8f', fg: '#111111', label: 'AD 755 QB', top: 'REPUBLICA ARGENTINA' }
  ];""")
rep('js/cars.js', """  rows.forEach(({ bg, bar, fg, label }, row) => {""", """  rows.forEach(({ bg, bar, fg, label, top }, row) => {""")
rep('js/cars.js', """    ctx.fillText('NEW YORK', 64, y0 + 7);""", """    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText(top, 64, y0 + 7);""")
rep('js/cars.js', """    ctx.fillRect(0, y0 + 56, 128, 8);""", """    if (!top) ctx.fillRect(0, y0 + 56, 128, 8);""")

# ------------------------------------------------------------------ traffic: taxis porteños, no green cabs
rep('js/traffic.js', "const taxiYellow = new THREE.Color(0xffbe14);", "const taxiYellow = new THREE.Color(0x15171a); // taxi porteño: black (the roof is yellow)")
rep('js/traffic.js', "const isBoroTaxi = !isPolice && (i % 25) === 3;", "const isBoroTaxi = false; // no green Boro cabs in Quilmes")
# fewer taxis: 2 of every 20 cars
rep('js/traffic.js', """  const FLEET_MIX = ['taxi', 'sedan', 'van', 'sedan', 'suv', 'taxi', 'suv', 'minivan', 'suv', 'pickup',
    'taxi', 'sedan', 'suv', 'van', 'suv', 'taxi', 'minivan', 'sedan', 'suv', 'sedan'];""",
    """  const FLEET_MIX = ['taxi', 'sedan', 'van', 'sedan', 'suv', 'sedan', 'suv', 'minivan', 'sedan', 'pickup',
    'taxi', 'sedan', 'suv', 'van', 'sedan', 'sedan', 'minivan', 'sedan', 'suv', 'pickup'];""")

# ------------------------------------------------------------------ the player's car: a taxi porteño
rep('js/controllers.js', "const taxiLoftMat = createLoftedCarMaterial(spec, 0xffbe14);", "const taxiLoftMat = createLoftedCarMaterial(spec, 0x15171a);")
rep('js/controllers.js', """    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(buildCarSidePatch(spec, side, doorMid - 0.36, doorMid + 0.36, 0.53, 0.81, 0.003), doorDecalMat);
      chassisPivot.add(decal);
    }""", """    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(buildCarSidePatch(spec, side, doorMid - 0.3, doorMid + 0.3, 0.6, 0.78, 0.003), doorDecalMat);
      chassisPivot.add(decal);
    }""")
a = src('js/controllers.js').index('function createTaxiDoorDecalTexture() {')
b = src('js/controllers.js').index('class ThirdPersonControllerManager {')
_files['js/controllers.js'] = src('js/controllers.js')[:a] + """function createTaxiDoorDecalTexture() {
  // door sign of a Quilmes radio taxi
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#15171a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#f2b316';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 46px Inter, Arial, sans-serif';
  ctx.fillText('TAXI', 128, 44);
  ctx.font = '700 19px Inter, Arial, sans-serif';
  ctx.fillText('QUILMES · LIC. 0482', 128, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

function createNYLicensePlateTexture() {
  // Mercosur plate
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f6f8';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#1a3d8f';
  ctx.fillRect(0, 0, 256, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REPUBLICA ARGENTINA', 128, 20);
  ctx.fillStyle = '#111111';
  ctx.font = '900 50px JetBrains Mono, monospace';
  ctx.fillText('AE 482 KD', 128, 90);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 124);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

""" + src('js/controllers.js')[b:]

# ------------------------------------------------------------------ colectivos instead of MTA buses
rep('js/bus.js', "const mtaRoyalBlue = color(0x16358a);", "const mtaRoyalBlue = color(0xb3121f); // colectivo: red body")
rep('js/bus.js', "const mtaSkyBlue = color(0x1a88e0);", "const mtaSkyBlue = color(0xf1f3f5); // white sweep")
rep('js/bus.js', "const sbsCyan = color(0x1fb8d0);", "const sbsCyan = color(0x14804a); // second line: green")
rep('js/bus.js', "const mtaGold = color(0xf0b21a);", "const mtaGold = color(0xf2c400); // yellow stripes")
rep('js/bus.js', "modernLivery = mix(modernLivery, color(0xeaa818), rear);", "modernLivery = mix(modernLivery, color(0xb3121f), rear);")
rep('js/bus.js', "const legacyLivery = mix(mix(mtaWhite, color(0x0055b3), blueStripe), color(0x00a4e4), cyanRibbon);",
    "const legacyLivery = mix(mix(mtaWhite, color(0x1c4fa8), blueStripe), color(0xf2c400), cyanRibbon); // third line: white & blue")
rep('js/bus.js', "body = mix(body, mix(color(0xf2b518), color(0x182648), plateText.mul(0.65)), plate);",
    "body = mix(body, mix(color(0xf2f4f6), color(0x111111), plateText.mul(0.65)), plate);")

# ------------------------------------------------------------------ no USPS mailboxes
rep('js/street-details.js', "      if (isOnSidewalk(mb[0], mb[1], 0.45)) mailboxPositions.push(mb);", "      // (no USPS mailboxes in Quilmes)")

# ------------------------------------------------------------------ km/h and metres
rep('js/main.js', "const topSpeedMph = { person: 18, car: 81, cyclist: 43, helicopter: 116 };", "const topSpeedMph = { person: 30, car: 130, cyclist: 70, helicopter: 187 }; // km/h")
rep('js/main.js', "const mph = Math.round(Math.abs(activeEnt.speed) * 2.237);", "const mph = Math.round(Math.abs(activeEnt.speed) * 3.6); // km/h")
rep('js/main.js', "const altFt = Math.max(0, Math.round(activeEnt.position.y * 3.281));", "const altFt = Math.max(0, Math.round(activeEnt.position.y)); // metres")
rep('index.html', '<span class="gauge-unit">mph</span>', '<span class="gauge-unit">km/h</span>')
rep('index.html', '<span id="hud-altitude">0</span> ft</span>', '<span id="hud-altitude">0</span> m</span>')

# ------------------------------------------------------------------ Quilmes camera spots (grid frame, metres)
CAMS = [
    ('plaza', 'Plaza San Martín y Catedral', 52, "desiredPos.set(10.0 + sway, 9.0, -120.0);\n        desiredLook.set(113.0, 16.0, -12.0);"),
    ('peatonal', 'Peatonal Rivadavia', 58, "desiredPos.set(150.0 + sway, 6.0, 250.0);\n        desiredLook.set(150.0, 4.0, 480.0);"),
    ('estacion', 'Estación Quilmes', 52, "desiredPos.set(40.0 + sway, 14.0, 620.0);\n        desiredLook.set(141.0, 5.0, 715.0);"),
    ('cerveceria', 'Cervecería Quilmes', 50, "desiredPos.set(560.0 + sway, 35.0, 650.0);\n        desiredLook.set(768.0, 12.0, 893.0);"),
    ('estadio', 'Estadio Centenario', 52, "desiredPos.set(2040.0 + sway, 50.0, 880.0);\n        desiredLook.set(2217.0, 8.0, 1049.0);"),
    ('bernal', 'Estación Bernal', 52, "desiredPos.set(-2140.0 + sway, 12.0, 1260.0);\n        desiredLook.set(-2211.0, 5.0, 1356.0);"),
    ('ribera', 'La Ribera y el Río', 46, "desiredPos.set(-312.0 + sway * 10.0, 45.0, -3200.0);\n        desiredLook.set(-120.0, 10.0, -1700.0);"),
]
OLD_IDS = ['centralPark', 'fifthAve', 'timesSquare', 'chryslerGCT', 'observatory', 'bryantPark', 'waterfront']
p = 'js/cameras.js'
s = src(p)
if "id: 'plaza'" not in s:
    a = s.index("  { id: 'centralPark'")
    b = s.index("  { id: 'drone'")
    s = s[:a] + ''.join(f"  {{ id: '{i}', name: '{n}', category: 'scenic', fov: {f} }},\n" for i, n, f, _ in CAMS) + s[b:]
    s = s.replace("name: 'Auto-Director Aerial'", "name: 'Vista aérea'")
    a = s.index("      case 'centralPark': {")
    b = s.index("      case 'drone': {")
    s = s[:a] + ''.join(f"""      case '{i}': {{
        const sway = Math.sin(elapsed * 0.22) * 2.5;
        {body}
        break;
      }}

""" for i, _, _, body in CAMS) + s[b:]
    s = s.replace("""          Math.cos(angle) * radius + 60.0,
          alt,
          Math.sin(angle) * radius + 250.0
        );
        desiredLook.set(60.0, 160.0, 250.0);""", """          Math.cos(angle) * radius + 150.0,
          alt * 0.55,
          Math.sin(angle) * radius + 350.0
        );
        desiredLook.set(150.0, 20.0, 350.0);""")
    _files[p] = s
p = 'index.html'
s = src(p)
if 'data-camera="plaza"' not in s:
    a = s.index('    <button id="cam-centralPark"')
    b = s.index('    <button id="cam-drone"')
    keys = ['', '8', '9', '0', '', '', '']
    s = s[:a] + ''.join(
        f'    <button id="cam-{i}" class="pop-item cam-btn" data-camera="{i}" type="button"><span class="pop-name">{n}</span>{f"<kbd>{k}</kbd>" if k else ""}</button>\n'
        for (i, n, _, _), k in zip(CAMS, keys)) + s[b:]
    _files[p] = s
# number keys that pointed at the New York presets
for old, new in zip(['fifthAve', 'timesSquare', 'chryslerGCT'], ['peatonal', 'estacion', 'cerveceria']):
    for f in ['js/main.js', 'js/controllers.js', 'js/cameras.js', 'js/gamepad-controls.js', 'js/touch-controls.js']:
        try:
            _files[f] = src(f).replace(f"'{old}'", f"'{new}'")
        except FileNotFoundError:
            pass
for f in list(_files):
    for old in OLD_IDS:
        if f"'{old}'" in _files[f] and f.endswith('.js') and f != 'js/cameras.js':
            print('note:', f, 'still names', old)

# ------------------------------------------------------------------ Spanish menus
p = 'index.html'
for old, new in [
    ('title="Car · Yellow Cab [2]"', 'title="Auto · Taxi [2]"'),
    ('<h2>Manhattan Street Atlas</h2>', '<h2>Mapa de Quilmes</h2>'),
    ('placeholder="Search streets &amp; landmarks — Broadway, Canal, Wall St…"', 'placeholder="Buscar calles y lugares — Rivadavia, Mitre, Estación…"'),
    ("title=\"True north · Manhattan's street grid runs 29° east of it\"", 'title="Norte · la cuadrícula de Quilmes está girada 58°"'),
    ('title="All of Manhattan (125th St to Battery Park)" aria-label="Fit all of Manhattan"', 'title="Todo Quilmes" aria-label="Ver todo Quilmes"'),
    ('<!-- All Cameras: 3 Follow Cameras + 7 Iconic NYC Vantage Cameras + Auto-Director Drone -->', '<!-- Cameras: 3 follow cameras, Quilmes spots, aerial drone -->'),
]:
    _files[p] = src(p).replace(old, new)
s = src(p)
for old, new in [('>Walk<', '>Caminar<'), ('>Drive<', '>Manejar<'), ('>Cycle<', '>Bici<'), ('>Fly<', '>Volar<'),
                 ('>Teleport<', '>Ir a<'), ('>Map<', '>Mapa<'), ('>Golden Hour<', '>Atardecer<'),
                 ('<div class="pop-title">Scenic</div>', '<div class="pop-title">Lugares</div>'),
                 ('<div class="pop-title">Follow</div>', '<div class="pop-title">Seguir</div>'),
                 ('aria-hidden="true">SF</span>', 'aria-hidden="true">QL</span>')]:
    s = s.replace(old, new)
_files[p] = s
_files['js/controllers.js'] = src('js/controllers.js').replace("label: 'Taxi',", "label: 'Taxi',")

# ------------------------------------------------------------------ the real shops on the storefront signs
rep('js/buildings.js', "import { addBuildingDetails } from './building-details.js';", """import { addBuildingDetails } from './building-details.js';
import { SHOPS } from './quilmes-places.js';
import { texture as tslTexture, instancedBufferAttribute, floor as tslFloor, float as tslFloat } from 'three/tsl';""")
rep('js/buildings.js', "    if (x > -600 && x < 600 && z > -600 && z < 900) return 'centro'; // Quilmes centro: plaza to the station",
    """    if (x > -600 && x < 600 && z > -600 && z < 900) return 'centro'; // Quilmes centro: plaza to the station
    if (Math.hypot(x + 2211, z - 1356) < 450) return 'centro'; // Bernal centro""")
rep('js/buildings.js', """  const surveyedBuckets = materials.map(() => []);
  const detailsToPlace = [];""", """  // GTA Quilmes: every real shop goes on the nearest building; other storefronts get a generic trade sign
  const SIGN_GENERIC = ['KIOSCO', 'ALMACÉN', 'VERDULERÍA', 'PANADERÍA', 'FERRETERÍA', 'PELUQUERÍA', 'LIBRERÍA',
    'CARNICERÍA', 'PIZZERÍA', 'ROTISERÍA', 'LAVADERO', 'MERCERÍA', 'BAZAR', 'DIETÉTICA', 'FIAMBRERÍA', 'HELADERÍA',
    'AUTOSERVICIO', 'QUINIELA', 'REGALERÍA', 'ZAPATERÍA', 'ÓPTICA', 'CERRAJERÍA', 'FARMACIA', 'TIENDA', 'POLIRRUBRO',
    'CELULARES', 'VETERINARIA', 'GOMERÍA'];
  const shopsOf = new Map();
  {
    const cellOf = (x, z) => `${Math.floor(x / 25)},${Math.floor(z / 25)}`;
    const hash = new Map();
    for (const b of surveyedBuildings) {
      if (b.height < 3) continue;
      const k = cellOf(b.cx, b.cz);
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(b);
    }
    SHOPS.forEach(([, , x, z], i) => {
      let best = null, bd = 30;
      const ci = Math.floor(x / 25), cj = Math.floor(z / 25);
      for (let a = ci - 1; a <= ci + 1; a++) for (let c = cj - 1; c <= cj + 1; c++) {
        for (const b of hash.get(`${a},${c}`) || []) {
          const d = Math.hypot(b.cx - x, b.cz - z);
          if (d < bd) { bd = d; best = b; }
        }
      }
      if (!best) return;
      if (!shopsOf.has(best)) shopsOf.set(best, []);
      shopsOf.get(best).push(SIGN_GENERIC.length + i);
    });
  }
  const surveyedBuckets = materials.map(() => []);
  const detailsToPlace = [];""")
rep('js/buildings.js', """    const storefronts = b.height >= 6 && mulberry32(seed ^ 0x53544f52)() < 0.55;
    const record = { ...b, tone, storefronts };""", """    const shops = shopsOf.get(b) || null;
    const centro = districtOf(b.cx, b.cz) === 'centro';
    const storefronts = !!shops || (b.height >= 3.6 && mulberry32(seed ^ 0x53544f52)() < (centro ? 0.3 : 0.035));
    const record = { ...b, tone, storefronts, shops, genericSigns: SIGN_GENERIC.length };""")
p = 'js/buildings.js'
s = src(p)
if 'SIGN_COLS' not in s:
    a = s.index("  const signInsts = signThemes.map((st) => {")
    b = s.index("    return sInst;\n  });\n", a) + len("    return sInst;\n  });\n")
    s = s[:a] + """  // One atlas with every sign: the generic trades, then the real shops (quilmes-places.js), 8 per row
  const SIGN_COLS = 8, SIGN_W = 256, SIGN_H = 32;
  const signTexts = [...SIGN_GENERIC.map((t) => [t, '']), ...SHOPS.map(([name, kind]) => [name.toUpperCase(), kind])];
  const SIGN_ROWS = Math.ceil(signTexts.length / SIGN_COLS);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = SIGN_COLS * SIGN_W;
  signCanvas.height = SIGN_ROWS * SIGN_H;
  {
    const ctx = signCanvas.getContext('2d');
    const KIND_BG = { pharmacy: '#0f6b3a', bank: '#123d7a', supermarket: '#b3121f', restaurant: '#3a1d12', bar: '#1b1b22',
      pub: '#1b1b22', cafe: '#3b2616', fast_food: '#c0391b', ice_cream: '#e85d9a', bakery: '#8a5a1e', butcher: '#8f1d1d',
      clothes: '#222831', lottery: '#1f5fa8', hardware: '#d46f12' };
    const PALETTE = ['#f4f1ea', '#13294b', '#7a1020', '#0f5132', '#e3b505', '#2b2b2b', '#f0f4f8', '#5b2a86'];
    signTexts.forEach(([text, kind], i) => {
      const x = (i % SIGN_COLS) * SIGN_W, y = Math.floor(i / SIGN_COLS) * SIGN_H;
      const bg = KIND_BG[kind] || PALETTE[(i * 7) % PALETTE.length];
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, SIGN_W, SIGN_H);
      const light = ['#f4f1ea', '#e3b505', '#f0f4f8', '#e85d9a'].includes(bg);
      ctx.fillStyle = light ? '#1a1a1a' : '#fbf6e8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 22;
      ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
      while (size > 9 && ctx.measureText(text).width > SIGN_W - 14) {
        size--;
        ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
      }
      ctx.fillText(text, x + SIGN_W / 2, y + SIGN_H / 2 + 1);
    });
  }
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = 8;
  const signCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SIGNS_PER_THEME * signThemes.length), 1);
  signCell.setUsage(THREE.DynamicDrawUsage);
  const signSlots = MAX_SIGNS_PER_THEME * signThemes.length;
  const signInsts = [(() => {
    const cell = instancedBufferAttribute(signCell);
    const row = tslFloor(cell.div(SIGN_COLS));
    const col = cell.sub(row.mul(SIGN_COLS));
    const suv = vec2(uv().x.add(col).div(SIGN_COLS), uv().y.add(tslFloat(SIGN_ROWS - 1).sub(row)).div(SIGN_ROWS));
    const sMat = new THREE.MeshBasicNodeMaterial();
    sMat.colorNode = tslTexture(signTex, suv);
    const sInst = new THREE.InstancedMesh(unitBox, sMat, signSlots);
    sInst.frustumCulled = false;
    group.add(sInst);
    return sInst;
  })()];
""" + s[b:]
    s = s.replace("""        const themeIdx = a.colorIdx % signInsts.length;
        if (signCounts[themeIdx] < MAX_SIGNS_PER_THEME) {
          dummy.position.set(a.x, 4.68, a.z);
          dummy.scale.set(0.28, 0.86, a.d * 0.92);
          dummy.updateMatrix();
          signInsts[themeIdx].setMatrixAt(signCounts[themeIdx]++, dummy.matrix);
        }""", """        const themeIdx = a.colorIdx % storeThemeColors.length;
        if (signCounts[0] < signSlots) {
          dummy.position.set(a.x, a.y + 0.88, a.z);
          dummy.scale.set(0.28, 0.86, a.d * 0.92);
          dummy.updateMatrix();
          signCell.setX(signCounts[0], a.sign || 0);
          signInsts[0].setMatrixAt(signCounts[0]++, dummy.matrix);
        }""")
    s = s.replace("""    signInsts.forEach((sInst, idx) => {
      sInst.count = signCounts[idx];
      flagRange(sInst.instanceMatrix, signCounts[idx]);
    });""", """    signInsts.forEach((sInst, idx) => {
      sInst.count = signCounts[idx];
      flagRange(sInst.instanceMatrix, signCounts[idx]);
    });
    flagRange(signCell, signCounts[0]);""")
    s = s.replace("spot.position.set(a.x + outX * 0.45, 4.35, a.z + outZ * 0.45);", "spot.position.set(a.x + outX * 0.45, a.y + 0.55, a.z + outZ * 0.45);")
    for need in ['signCell.setX', 'flagRange(signCell', 'a.y + 0.55']:
        assert need in s, need
    _files[p] = s
# storefronts on low buildings too, more of them on the buildings that hold real shops
# the real shops get the game's shopfronts (gta-world.js): no slop awning or sign on their buildings
rep('js/building-details.js', "      if (rand() > 0.22) continue;", "      if (b.shops || rand() > 0.22) continue;")
rep('js/building-details.js', "        item = { x: x + e.nx, y: 3.8, z: z + e.nz, w: 1.8, d, colorIdx: Math.floor(rand() * 5), ry };",
    """        const sign = b.shops ? b.shops[detail.awnings.length % b.shops.length] : Math.floor(rand() * b.genericSigns);
        item = { x: x + e.nx, y: Math.min(3.8, b.height - 1.35), z: z + e.nz, w: 1.8, d, colorIdx: Math.floor(rand() * 5), ry, sign };""")

# ------------------------------------------------------------------ places: map labels and teleports
p = 'js/city-config.js'
rep(p, "const P = (k, fallback) =>", "import { LANDMARKS as Q_LANDMARKS, STATIONS as Q_STATIONS } from './quilmes-places.js';\nconst P = (k, fallback) =>")
rep(p, """  estacion: roadSpot(estacion.x, estacion.z - 40, estacion.x, estacion.z, /Gaboto|Yrigoyen|Rivadavia|Sarmiento/)
};""", """  estacion: roadSpot(estacion.x, estacion.z - 40, estacion.x, estacion.z, /Gaboto|Yrigoyen|Rivadavia|Sarmiento/),
  bernal: roadSpot(-2211, 1300, -2211, 1356),
  cerveceria: roadSpot(700, 830, 768, 893),
  estadio: roadSpot(2150, 1000, 2217, 1049),
  ribera: roadSpot(-312, -2800, -312, -2876),
  ezpeleta: roadSpot(4020, 200, 4020, 257)
};""")
rep(p, """  lm('estacion', 'Estación Quilmes', 'Estación', estacion, 'Centro')
].filter(Boolean);""", """  lm('estacion', 'Estación Quilmes', 'Estación', estacion, 'Centro'),
  // every named place of the GTA Quilmes map
  ...Q_STATIONS.filter(([n]) => n !== 'Estación Quilmes').map(([n, x, z], i) => lm(`st${i}`, n, n.replace('Estación ', ''), { x, z }, 'Quilmes')),
  ...Q_LANDMARKS.filter(([n]) => !/^Estaci|^Plaza San Mart|^Catedral/.test(n)).map(([n, x, z], i) => lm(`q${i}`, n, n.length > 26 ? n.slice(0, 24) + '…' : n, { x, z }, 'Quilmes'))
].filter(Boolean);""")
p = 'index.html'
rep(p, """    <button id="tp-estacion" """, """    <button id="tp-bernal" class="pop-item tp-btn" data-teleport="bernal" type="button"><span class="pop-name">Bernal centro</span><span class="pop-sub">Estación Bernal</span></button>
    <button id="tp-cerveceria" class="pop-item tp-btn" data-teleport="cerveceria" type="button"><span class="pop-name">Cervecería Quilmes</span><span class="pop-sub">Quilmes</span></button>
    <button id="tp-estadio" class="pop-item tp-btn" data-teleport="estadio" type="button"><span class="pop-name">Estadio Centenario</span><span class="pop-sub">Quilmes A. C.</span></button>
    <button id="tp-ribera" class="pop-item tp-btn" data-teleport="ribera" type="button"><span class="pop-name">La Ribera</span><span class="pop-sub">Costanera · Río de la Plata</span></button>
    <button id="tp-ezpeleta" class="pop-item tp-btn" data-teleport="ezpeleta" type="button"><span class="pop-name">Ezpeleta</span><span class="pop-sub">Estación Ezpeleta</span></button>
    <button id="tp-estacion" """)
rep(p, '<link rel="modulepreload" href="./js/subway-geodata.js" />', '<link rel="modulepreload" href="./js/quilmes-places.js" />\n  <link rel="modulepreload" href="./js/subway-geodata.js" />')

# ------------------------------------------------------------------ the maps: north up, Quilmes barrios
p = 'js/nyc-map.js'
s = src(p)
if 'MAP_ROT' not in s:
    def sub(old, new, n=1):
        global s
        assert s.count(old) >= n, old
        s = s.replace(old, new)
    a = s.index('const AREA_LABELS = [')
    b = s.index('];', a) + 2
    s = s[:a] + """const AREA_LABELS = [
  // [label, x, z, kind: 0 town, 1 water, 2 barrio], grid frame metres
  ['RÍO DE LA PLATA', -300, -3900, 1], ['RÍO DE LA PLATA', 3200, -3300, 1], ['RÍO DE LA PLATA', -3800, -2200, 1],
  ['QUILMES', 600, 1500, 0], ['BERNAL', -2600, 1500, 0],
  ['QUILMES CENTRO', 330, 320, 2], ['LA RIBERA', -350, -2450, 2], ['QUILMES ESTE', 1300, -900, 2],
  ['QUILMES OESTE', 1300, 2900, 2], ['EZPELETA', 4100, 650, 2], ['BERNAL ESTE', -2500, 200, 2],
  ['BERNAL OESTE', -1900, 2700, 2], ['DON BOSCO', -3600, 2600, 2], ['LA CERVECERÍA', 900, 1150, 2]
];""" + s[b:]
    sub("const GRID_BEARING = (GEO.frame && GEO.frame.bearingDeg) || 29.02; // Manhattan's grid north, degrees east of true north",
        """const GRID_BEARING = (GEO.frame && GEO.frame.bearingDeg) || 29.02; // the street grid's north, degrees east of true north
// Quilmes: both maps are drawn true north up, like the game's: the grid frame turned clockwise by the bearing
const MAP_ROT = (GRID_BEARING * Math.PI) / 180;
const RC = Math.cos(MAP_ROT), RS = Math.sin(MAP_ROT);""")
    sub("""    this.minX = cx - w / (2 * s);
    this.maxX = cx + w / (2 * s);
    this.minZ = cz - h / (2 * s);
    this.maxZ = cz + h / (2 * s);
  }""", """    const half = Math.hypot(w, h) / (2 * s); // the turned view's extent in the grid frame
    this.minX = cx - half;
    this.maxX = cx + half;
    this.minZ = cz - half;
    this.maxZ = cz + half;
  }""")
    sub("""    ctx.setTransform(s * dpr, 0, 0, s * dpr, dpr * (this.w * 0.5 - this.cx * s), dpr * (this.h * 0.5 - this.cz * s));""",
        """    const k = s * dpr;
    ctx.setTransform(k * RC, k * RS, -k * RS, k * RC, dpr * (this.w * 0.5 - s * (RC * this.cx - RS * this.cz)),
      dpr * (this.h * 0.5 - s * (RS * this.cx + RC * this.cz)));""")
    sub("""  toX(x) {""", """  /** CSS pixels from the canvas centre of a grid point */
  pt(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    return [(RC * dx - RS * dz) * this.s, (RS * dx + RC * dz) * this.s];
  }

  toX(x) {""")
    sub("""      const X = v.toX(c.a.x);
      const Y = v.toY(c.a.z);""", """      const [X, Y] = v.pt(c.a.x, c.a.z);
      let ang = c.a.ang + MAP_ROT; // upright text
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;""")
    sub("""      const ca = Math.abs(Math.cos(c.a.ang));
      const sa = Math.abs(Math.sin(c.a.ang));""", """      const ca = Math.abs(Math.cos(ang));
      const sa = Math.abs(Math.sin(ang));""")
    sub("      ctx.rotate(c.a.ang);", "      ctx.rotate(ang);")
    s = re.sub(r'const (\w+) = toX\(([\w.]+)\.x\);\n(\s*)const (\w+) = toY\(\2\.z\);', r'const [\1, \4] = v.pt(\2.x, \2.z);', s)
    sub("""      const dx = toX(x);
      const dy = toY(z);""", """      const [dx, dy] = v.pt(x, z);""")
    sub("drawRoute(ctx, toX(ent.position.x), toY(ent.position.z), wx, wy, 4);", "drawRoute(ctx, ...v.pt(ent.position.x, ent.position.z), wx, wy, 4);")
    sub("ctx.rotate(-ent.heading + Math.PI);", "ctx.rotate(-ent.heading + Math.PI + MAP_ROT);", 2)
    sub("ctx.rotate(-camAngle + Math.PI);", "ctx.rotate(-camAngle + Math.PI + MAP_ROT);")
    # the radar's cached ground: redraw when the player nears its edge, placed turned like the view
    sub("""      Math.abs(px - c.cx) > w / c.s - w / (2 * scale) - 8 / scale ||
      Math.abs(pz - c.cz) > h / c.s - h / (2 * scale) - 8 / scale) {""",
        """      Math.hypot(px - c.cx, pz - c.cz) > Math.min(w, h) / c.s - Math.hypot(w, h) / (2 * scale) - 8 / scale) {""")
    sub("""    ctx.drawImage(c.canvas, dpr * ((c.cx - w / c.s - px) * scale + w * 0.5), dpr * ((c.cz - h / c.s - pz) * scale + h * 0.5),""",
        """    const ox = (RC * (c.cx - px) - RS * (c.cz - pz)) * scale, oz = (RS * (c.cx - px) + RC * (c.cz - pz)) * scale;
    ctx.drawImage(c.canvas, dpr * (ox - w * k + w * 0.5), dpr * (oz - h * k + h * 0.5),""")
    # pan, zoom and clicks: screen offsets back to the grid frame
    sub("""          this.viewCenterX = this.panStart.cx - dx / this.viewZoom;
          this.viewCenterZ = this.panStart.cz - dy / this.viewZoom;""",
        """          this.viewCenterX = this.panStart.cx - (RC * dx + RS * dy) / this.viewZoom;
          this.viewCenterZ = this.panStart.cz - (-RS * dx + RC * dy) / this.viewZoom;""")
    sub("""        this.viewCenterX = before.x - (mx - rect.width * 0.5) / this.viewZoom;
        this.viewCenterZ = before.z - (my - rect.height * 0.5) / this.viewZoom;""",
        """        const ux = mx - rect.width * 0.5, uy = my - rect.height * 0.5;
        this.viewCenterX = before.x - (RC * ux + RS * uy) / this.viewZoom;
        this.viewCenterZ = before.z - (-RS * ux + RC * uy) / this.viewZoom;""")
    sub("""      x: this.viewCenterX + (sx - width * 0.5) / this.viewZoom,
      z: this.viewCenterZ + (sy - height * 0.5) / this.viewZoom""",
        """      x: this.viewCenterX + (RC * (sx - width * 0.5) + RS * (sy - height * 0.5)) / this.viewZoom,
      z: this.viewCenterZ + (-RS * (sx - width * 0.5) + RC * (sy - height * 0.5)) / this.viewZoom""")
    sub("if (needle) needle.setAttribute('transform', `rotate(${-GRID_BEARING} 22 22)`);", "if (needle) needle.setAttribute('transform', 'rotate(0 22 22)'); // true north up")
    left = [l for l in s.split('\n') if re.search(r'\btoX\(|\btoY\(', l) and 'v.toX(wx)' not in l and 'v.toY(wz)' not in l and '  toX(x) {' not in l and '  toY(z) {' not in l]
    assert not left, left
    _files[p] = s
rep('index.html', 'title="Norte · la cuadrícula de Quilmes está girada 58°"', 'title="Norte arriba"')
for old, new in [
    ("`${ROAD_NAME_COUNT} streets · ${BLOCKS.length.toLocaleString('en-US')} blocks`", "`${ROAD_NAME_COUNT} calles · ${BLOCKS.length.toLocaleString('es-AR')} manzanas`"),
    ("`Search ${ROAD_NAME_COUNT} streets & landmarks…`", "`Buscar entre ${ROAD_NAME_COUNT} calles y lugares…`"),
    ("· Click to teleport here`", "· Clic para ir acá`"),
    ("`You are at ${getLocationLabel(", "`Estás en ${getLocationLabel("),
]:
    rep('js/nyc-map.js', old, new)
for old, new in [
    ('>You are at 5th Ave &amp; 35th St<', '>Estás en Plaza San Martín<'),
    ('<span class="tool-label">Close</span><kbd>Esc</kbd>', '<span class="tool-label">Cerrar</span><kbd>Esc</kbd>'),
    ('>Click anywhere to teleport &amp; set your GPS route · Drag to pan · Scroll to zoom<', '>Clic para ir a un lugar y marcar la ruta · Arrastrá para mover · Rueda para acercar<'),
]:
    rep('index.html', old, new)

# semáforos: dark grey housings like Quilmes's, not New York's yellow
rep('js/street-details.js', "    color: 0xe6a817, // Authentic NYC DOT school-bus/marigold yellow housing", "    color: 0x24282a, // Quilmes: dark grey signal housings")

# ------------------------------------------------------------------ the game's hand-made places (gta-world.js)
p = 'js/main.js'
rep(p, "import { buildLandmarks } from './landmarks.js';", "import { buildLandmarks } from './landmarks.js';\nimport { buildGtaWorld, buildHouses } from './gta-world.js';\nimport { GAME_FRAME } from './quilmes-places.js';")
rep(p, """  const { colliders: landmarkColliders } = buildLandmarks(scene);
  markInit('landmarks');""", """  const { colliders: landmarkColliders } = buildLandmarks(scene);
  // GTA Quilmes: the game's cathedral, churches, stations, stadiums, brewery, plazas and peatonal (src/slop/gtaWorld.js)
  let gtaPlaces = null;
  try {
    gtaPlaces = await buildGtaWorld(scene, { dataUrl: new URL('./gta-world.json', import.meta.url), frame: GAME_FRAME });
  } catch (err) {
    console.error('[gta-world]', err);
  }
  let gtaHouses = null;
  try {
    // phones (and ?liviano): only ~700 m around the player, rebuilt as it moves on; ?completo forces the whole map
    const lite = /[?&]liviano/.test(location.search) ||
      (!/[?&]completo/.test(location.search) && (matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory || 8) <= 4));
    let center = TELEPORT_LOCATIONS.plaza;
    try {
      const sv = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY));
      const e = sv && sv.entities && sv.entities[sv.activeMode];
      if (e && Number.isFinite(e.x) && Number.isFinite(e.z)) center = { x: e.x, z: e.z };
    } catch (err) { /* no saved position */ }
    gtaHouses = await buildHouses(scene, { dataUrl: new URL('./gta-houses.json', import.meta.url), frame: GAME_FRAME, center, radius: lite ? 700 : Infinity });
  } catch (err) {
    console.error('[gta-houses]', err);
  }
  markInit('landmarks');""")
rep(p, "  const allColliders = [...landmarkColliders, ...cityBlocks.colliders, ...boroughs.colliders, ...(cityGrid.colliders || [])];",
    "  const allColliders = [...landmarkColliders, ...cityBlocks.colliders, ...boroughs.colliders, ...(cityGrid.colliders || []), ...(gtaPlaces ? gtaPlaces.colliders : []), ...(gtaHouses ? gtaHouses.colliders : [])];")
rep(p, """    lightingSystem.applyPreset(timeId);
    colorGrade.applyPreset(lightingSystem.activePresetId);""", """    lightingSystem.applyPreset(timeId);
    colorGrade.applyPreset(lightingSystem.activePresetId);
    if (gtaPlaces) gtaPlaces.setNight(lightingSystem.uNightFactor.value);
    if (gtaHouses) gtaHouses.setNight(lightingSystem.uNightFactor.value);""")

rep('js/main.js', "    if (boroughs.update) boroughs.update(elapsed);", "    if (gtaPlaces) gtaPlaces.update(dt); // trains and barreras\n    if (gtaHouses) gtaHouses.update(cameraSystem.currentPos.x, cameraSystem.currentPos.z); // house streaming\n    if (boroughs.update) boroughs.update(elapsed);")

rep('js/main.js', "    controllerManager.entities.cyclist.helmet\n  ];", "    controllerManager.entities.cyclist.helmet,\n    ...(gtaPlaces && gtaPlaces.dynamic ? [gtaPlaces.dynamic] : [])\n  ];")

# ------------------------------------------------------------------ colectivos on their real routes (traffic.js)
p = 'js/traffic.js'
rep(p, "const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));", """const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// GTA Quilmes: the real colectivo lines (quilmes-buses.js). A bus is put on a line that passes near the camera, takes
// at every intersection the move that keeps to its route and stops at the line's paradas.
const ROUTES = BUS_ROUTES.map((r) => {
  const n = r.pts.length / 2, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(r.pts[2 * i] - r.pts[2 * i - 2], r.pts[2 * i + 1] - r.pts[2 * i - 1]);
  return { ...r, n, cum, len: cum[n - 1] };
});
// Nearest point of route R to (x, z) between distances s0 and s1 along it: { s, d }
function routeProject(R, x, z, s0, s1) {
  let best = Infinity, bs = s0;
  for (let i = 0; i < R.n - 1; i++) {
    if (R.cum[i + 1] < s0 || R.cum[i] > s1) continue;
    const ax = R.pts[2 * i], az = R.pts[2 * i + 1], dx = R.pts[2 * i + 2] - ax, dz = R.pts[2 * i + 3] - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best) { best = d; bs = R.cum[i] + t * Math.sqrt(l2); }
  }
  return { s: bs, d: best };
}""")
rep(p, "import {\n  BUS_SPEC,", "import { BUS_ROUTES } from './quilmes-buses.js';\nimport {\n  BUS_SPEC,")
# destination signs: one row per bus, drawn when it takes a line
a = src(p).index('function createBusDestinationTexture() {')
b = src(p).index('const clamp = (x, lo, hi)')
_files[p] = src(p)[:a] + """// LED destination signs: one 64 px row per bus (16 rows), redrawn with its line and destination
function createBusDestinationTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#090b10';
  ctx.fillRect(0, 0, 512, 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.draw = (row, line, dest) => {
    const y0 = row * 64;
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, y0, 512, 64);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(6, y0 + 8, 500, 48);
    ctx.fillStyle = '#ffb000';
    ctx.font = '900 34px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line, 64, y0 + 33);
    ctx.font = '800 22px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(dest.toUpperCase(), 130, y0 + 33, 370);
    tex.needsUpdate = true;
  };
  for (let i = 0; i < 16; i++) tex.draw(i, '', 'QUILMES');
  return tex;
}

""" + src(p)[b:]
rep(p, "    const vRow = varying(vertexStage(mod(floor(max(float(0.0), state.w.sub(1.0)).add(0.5)), 8.0)));\n    const signUV = vec2(uv().x, uv().y.mul(0.095).add(0.015).add(float(7.0).sub(vRow).mul(0.125)));",
    "    const vRow = varying(vertexStage(mod(floor(max(float(0.0), state.w.sub(1.0)).add(0.5)), 16.0)));\n    const signUV = vec2(uv().x, uv().y.mul(0.0475).add(0.0075).add(float(15.0).sub(vRow).mul(0.0625)));")
# route-following moves
rep(p, """  function chooseMove(v, fromLane) {
    const e = v.edge;""", """  function chooseMove(v, fromLane) {
    if (v.bus && v.route) {
      const m = routeMove(v, fromLane);
      if (m) return m;
      v.route = null; // off its line: an ordinary bus until it is recycled
    }
    const e = v.edge;""")
rep(p, """  // Could the vehicle of lane entry o, approaching the end of edge a""", """  // The move out of v's edge that keeps closest to its line ahead (null if none stays within ~30 m of it)
  function routeMove(v, fromLane) {
    const R = v.route, e = v.edge;
    let best = null, bd = 30, any = null, ad = 30;
    for (const m of e.moves) {
      const f = m.to;
      const t = Math.min(f.len, 50);
      const q = routeProject(R, f.sx + f.dx * t, f.sz + f.dz * t, v.rs - 10, v.rs + 260);
      const q0 = routeProject(R, f.sx + f.dx * Math.min(f.len, 12), f.sz + f.dz * Math.min(f.len, 12), v.rs - 10, v.rs + 200);
      const d = Math.max(q.d, q0.d) + (q.s < q0.s ? 40 : 0); // and along the line, not back
      if (d < ad) { ad = d; any = m; }
      if (fromLane && m.out[v.lane] < 0) continue;
      if (d < bd) { bd = d; best = m; }
    }
    return best || any;
  }

  // Paradas: brake for the next stop of v's line, wait there a few seconds
  function busStopAcc(v) {
    const R = v.route;
    const q = routeProject(R, v.x, v.z, v.rs - 15, v.rs + 60);
    if (q.d < 25) v.rs = Math.max(v.rs, q.s);
    while (v.stop < R.stops.length && R.stops[v.stop] < v.rs - 4) v.stop++;
    if (clock < v.dwellUntil) return stopAt(v, 0.05, 0.1);
    if (v.stop >= R.stops.length) {
      if (v.rs > R.len - 30) v.route = null; // end of the line
      return 0;
    }
    const d = R.stops[v.stop] - v.rs - v.half + 2;
    if (d > LOOKAHEAD) return 0;
    // held up short of the parada (a queue, a red): after a while it lets this one go
    if (v.speed > 0.5) v.slowSince = clock;
    else if (clock - (v.slowSince ?? clock) > 20) {
      v.stop++;
      v.slowSince = clock;
      return 0;
    }
    if (d < 1.5 && v.speed < 0.6) {
      v.dwellUntil = clock + 6 + Math.random() * 6;
      v.stop++;
      return stopAt(v, 0.05, 0.1);
    }
    return stopAt(v, Math.max(0.05, d), 0.5);
  }

  // Could the vehicle of lane entry o, approaching the end of edge a""")
rep(p, """    const acc = Math.min(freeAcc(v) + worst, (cap - v.speed) * 2);
    v.acc = clamp(acc, -9, v.driver.a);""", """    if (v.bus && v.route) worst = Math.min(worst, busStopAcc(v));
    const acc = Math.min(freeAcc(v) + worst, (cap - v.speed) * 2);
    v.acc = clamp(acc, -9, v.driver.a);""")
# spawning on a line near the camera
rep(p, """  function spawnVehicle(v, rMin, rMax, protectView) {
    for (let attempt = 0; attempt < 12; attempt++) {""", """  function spawnBusOnRoute(v, rMin, rMax, protectView) {
    const near = ROUTES.filter((R) => {
      for (let i = 0; i < R.n; i += 2) if (Math.hypot(R.pts[2 * i] - focusX, R.pts[2 * i + 1] - focusZ) < rMax) return true;
      return false;
    });
    if (!near.length) return false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const R = near[Math.floor(Math.random() * near.length)];
      const cand = [];
      for (let i = 0; i < R.n - 1; i++) {
        const d = Math.hypot(R.pts[2 * i] - focusX, R.pts[2 * i + 1] - focusZ);
        if (d > rMin && d < rMax) cand.push(i);
      }
      if (!cand.length) continue;
      const i = cand[Math.floor(Math.random() * cand.length)];
      const ax = R.pts[2 * i], az = R.pts[2 * i + 1];
      const L = R.cum[i + 1] - R.cum[i] || 1;
      const ux = (R.pts[2 * i + 2] - ax) / L, uz = (R.pts[2 * i + 3] - az) / L;
      for (const e of nearEdges) {
        if (e.len < 2 * v.half + 10 || e.dx * ux + e.dz * uz < 0.9) continue;
        const s = (ax - e.sx) * e.dx + (az - e.sz) * e.dz;
        if (s < v.half + 5 || s > e.len - v.half - 5) continue;
        if (Math.abs((ax - e.sx) * e.rx + (az - e.sz) * e.rz) > 8) continue;
        const lane = e.lanes.length - 1; // the curb lane
        const x = e.sx + e.dx * s + e.rx * e.lanes[lane], z = e.sz + e.dz * s + e.rz * e.lanes[lane];
        if (protectView && nearView(x, z, v.half + 4, VEHICLE_SPAWN_DISTANCE)) continue;
        if (player.active && Math.hypot(x - player.x, z - player.z) < 25) continue;
        if (!laneClear(e.occ[lane], s, v.half + 8)) continue;
        v.route = R;
        v.rs = R.cum[i];
        v.stop = 0;
        v.dwellUntil = 0;
        place(v, e, lane, s);
        busDestTex.draw(v.variant, R.line, R.dest);
        return true;
      }
    }
    v.route = null;
    return false;
  }

  function spawnVehicle(v, rMin, rMax, protectView) {
    // colectivos only run on their lines: none where no line passes
    if (v.bus && ROUTES.length) return spawnBusOnRoute(v, rMin, rMax, protectView);
    for (let attempt = 0; attempt < 12; attempt++) {""")
rep(p, "      if (d <= (jump ? NEAR_RADIUS : VEHICLE_RADIUS)) continue;",
    "      // a colectivo that left its line goes back to one as soon as it is out of sight\n      const offLine = v.bus && !v.route && v.edge && ROUTES.length && !nearView(v.x, v.z, v.half + 4, VEHICLE_SPAWN_DISTANCE);\n      if (d <= (jump ? NEAR_RADIUS : VEHICLE_RADIUS) && !offLine) continue;")
rep(p, "const NUM_BUSES = 12;", "const NUM_BUSES = 14; // colectivos (one LED sign row each, 16 at most)")

rep('js/main.js', "  const controllerManager = new ThirdPersonControllerManager(scene, allColliders);", """  const controllerManager = new ThirdPersonControllerManager(scene, allColliders);
  // the light mode rebuilds the houses around the player: swap their footprints in the collision list
  if (gtaHouses) {
    gtaHouses.onRebuild = (oldColliders, newColliders) => {
      const gone = new Set(oldColliders);
      const keep = allColliders.filter((c) => !gone.has(c));
      allColliders.length = 0;
      for (const c of keep) allColliders.push(c);
      for (const c of newColliders) allColliders.push(c);
      controllerManager._colliderCells = null;
    };
  }""")

# ------------------------------------------------------------------ light mode (phones): a smaller city, crash notes
p = 'index.html'
s = src(p)
a = s.index('  <script type="importmap">')
b = s.index('</script>', a) + len('</script>')
s = s[:a] + """  <script>
    // Phones (coarse pointer, <= 4 GB, or ?liviano; ?completo forces the full city) get the light city: the engine's
    // streets, blocks and trees of Quilmes centro and Bernal only (js/lite/), the game's houses near the player.
    (() => {
      const q = location.search;
      let lite = /[?&]liviano/.test(q) || (!/[?&]completo/.test(q) && (matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory || 8) <= 4));
      // where the last load stopped, if it never finished (the browser closed the tab)
      let prev = null;
      try {
        prev = JSON.parse(localStorage.getItem('slopq-load'));
        localStorage.setItem('slopq-load', JSON.stringify({ stage: 'inicio', ok: false }));
      } catch (err) { /* no storage */ }
      window.SLOPQ_PREV = prev && !prev.ok ? prev.stage : null;
      window.SLOPQ_LITE = lite;
      const V = '__SLOPQ_V__', cdn = 'https://cdn.jsdelivr.net/npm/three@0.187.0/';
      const imports = {
        three: cdn + 'build/three.webgpu.js', 'three/webgpu': cdn + 'build/three.webgpu.js',
        'three/tsl': cdn + 'build/three.tsl.js', 'three/addons/': cdn + 'examples/jsm/'
      };
      if (lite) {
        for (const f of ['nyc-geodata', 'building-geodata', 'tree-geodata']) {
          imports[new URL('./js/' + f + '.js?v=' + V, location.href).href] = new URL('./js/lite/' + f + '.js?v=' + V, location.href).href;
        }
      }
      document.write('<script type="importmap">' + JSON.stringify({ imports }) + '<\\/script>');
    })();
  </script>""" + s[b:]
s = re.sub(r'  <link rel="modulepreload" href="\./js/(nyc-geodata|building-geodata|tree-geodata)\.js" />\n', '', s)
s = re.sub(r'  <link rel="preload" href="\./js/(tree|building)-geodata\.bin\.gz"[^>]*>\n', '', s)
_files[p] = s
p = 'js/main.js'
rep(p, """  async function showLoadingStage(message) {
    if (loadingStatus) loadingStatus.textContent = message;""", """  async function showLoadingStage(message) {
    if (loadingStatus) loadingStatus.textContent = message;
    try { localStorage.setItem('slopq-load', JSON.stringify({ stage: message, ok: false })); } catch (err) { /* no storage */ }
    if (window.SLOPQ_PREV && loadingStatus && !document.getElementById('slopq-prev')) {
      const note = document.createElement('div');
      note.id = 'slopq-prev';
      note.style.cssText = 'margin-top:10px;font-size:12px;opacity:.75;max-width:320px;text-align:center';
      note.textContent = `La vez anterior la página se cerró en: «${window.SLOPQ_PREV}»` + (window.SLOPQ_LITE ? ' · modo liviano' : '');
      loadingStatus.after(note);
    }""")
rep(p, """        console.log(`[init] ${initTimings.join(', ')}`);""", """        console.log(`[init] ${initTimings.join(', ')}`);
        // playing: a crash from here on shows as «jugando» next time; leaving the page normally clears it
        try {
          localStorage.setItem('slopq-load', JSON.stringify({ stage: 'jugando', ok: false }));
          const clear = () => { try { localStorage.setItem('slopq-load', JSON.stringify({ stage: 'jugando', ok: true })); } catch (err) { /* */ } };
          addEventListener('pagehide', clear);
          document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); else localStorage.setItem('slopq-load', JSON.stringify({ stage: 'jugando', ok: false })); });
        } catch (err) { /* no storage */ }""")
# the game's houses: light mode from the page's choice
_files[p] = src(p).replace("""    const lite = /[?&]liviano/.test(location.search) ||
      (!/[?&]completo/.test(location.search) && (matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory || 8) <= 4));""", """    const lite = !!window.SLOPQ_LITE;""")

for p, s in _files.items():
    open(f'{S}/{p}', 'w').write(s)
print('ok', len(_files), 'files')

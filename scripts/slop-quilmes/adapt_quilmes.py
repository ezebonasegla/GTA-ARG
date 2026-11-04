"""Quilmes names, teleports and districts in the Slop Santa Fe front-end (argv[1] = app dir)."""
import re
import sys

S = sys.argv[1]

p = f'{S}/js/city-config.js'
s = open(p).read()
a = s.index("function districtAt(x, z) {")
b = s.index("for (const b of BLOCKS) b.district = districtAt(b.cx, b.cz);")
s = s[:a] + """function districtAt(x, z) {
  if (x > -600 && x < 600 && z > -600 && z < 900) return 'microcentro';
  return 'centro';
}
""" + s[b:]
a = s.index("const plaza = P('plaza25DeMayo', { x: -65, z: 60 });")
b = s.index("const ISLAND_BOUNDS")
s = s[:a] + """// Quilmes: positions in the grid frame (origin Alsina & Av. Mitre, by the Plaza San Martín)
const plaza = { x: 51, z: -46 };
const catedral = P('catedral', { x: 113, z: -12 });
const peatonal = { x: 152, z: 378 };
const estacion = { x: 144, z: 715 };
// Street-level arrivals shared by every travel mode
const TELEPORT_LOCATIONS = {
  plaza: roadSpot(plaza.x - 60, plaza.z, plaza.x + 60, plaza.z, /Mitre|Alsina/),
  catedral: roadSpot(catedral.x + 30, catedral.z, catedral.x + 30, catedral.z + 100, /Rivadavia|Sarmiento/),
  peatonal: roadSpot(peatonal.x, peatonal.z, peatonal.x, peatonal.z + 100, /Rivadavia/),
  estacion: roadSpot(estacion.x, estacion.z - 40, estacion.x, estacion.z, /Gaboto|Yrigoyen|Rivadavia|Sarmiento/)
};
const site = (name) => LANDMARK_SITES[name];
const lm = (id, name, short, at, district) => (at ? { id, name, short, x: at.x, z: at.z, district } : null);
const NYC_LANDMARKS = [
  lm('plaza', 'Plaza San Martín', 'Plaza San Martín', plaza, 'Centro'),
  lm('catedral', 'Catedral de Quilmes', 'Catedral', catedral, 'Centro'),
  lm('estacion', 'Estación Quilmes', 'Estación', estacion, 'Centro')
].filter(Boolean);

""" + s[b:]
s = s.replace("return `${z < -1500 ? 'Laguna Setúbal' : 'Puerto de Santa Fe'}${st ? ` · near ${st.road.name}` : ''}`;",
              "return `Quilmes${st ? ` · near ${st.road.name}` : ''}`;")
s = s.replace("return z < -1500 ? 'Laguna Setúbal' : 'Riacho Santa Fe';", "return 'Quilmes';")
open(p, 'w').write(s)

p = f'{S}/js/buildings.js'
s = open(p).read()
old = """    if (x > -500 && x < 400 && z > -1100 && z < 450) return 'centro';
    if (Math.abs(z + 2450) < 130 && x > -1300 && x < 2100) return 'boulevard';
    if (x > 1000 && z < -1500) return 'costanera';
    return 'barrio';"""
assert old in s
s = s.replace(old, """    if (x > -600 && x < 600 && z > -600 && z < 900) return 'centro'; // Quilmes centro: plaza to the station
    return 'barrio';""")
open(p, 'w').write(s)

p = f'{S}/index.html'
s = open(p).read()
a = s.index('    <button id="tp-plaza"')
b = s.index('  </div>', a)
s = s[:a] + """    <button id="tp-plaza" class="pop-item tp-btn" data-teleport="plaza" type="button"><span class="pop-name">Plaza San Martín</span><span class="pop-sub">Av. Mitre · Centro</span></button>
    <button id="tp-catedral" class="pop-item tp-btn" data-teleport="catedral" type="button"><span class="pop-name">Catedral de Quilmes</span><span class="pop-sub">Rivadavia · Centro</span></button>
    <button id="tp-peatonal" class="pop-item tp-btn" data-teleport="peatonal" type="button"><span class="pop-name">Peatonal Rivadavia</span><span class="pop-sub">Rivadavia · Centro</span></button>
    <button id="tp-estacion" class="pop-item tp-btn" data-teleport="estacion" type="button"><span class="pop-name">Estación Quilmes</span><span class="pop-sub">Línea Roca · Centro</span></button>
""" + s[b:]
s = s.replace('Santa Fe', 'Quilmes')
s = re.sub(r'<meta name="description" content="[^"]*"',
           '<meta name="description" content="Demo: el centro de Quilmes (Buenos Aires) sobre el motor de Slop New York de mrdoob (three.js WebGPU + TSL), adaptado desde Slop Santa Fe. Datos: OpenStreetMap / Overture, Google Open Buildings 2.5D."', s)
open(p, 'w').write(s)
print('ok')

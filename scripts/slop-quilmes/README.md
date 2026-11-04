# Slop Quilmes

Todo el mapa de GTA Quilmes (Quilmes, Bernal, Ezpeleta, la Ribera; unos 39 km² de ciudad detallada) sobre el motor de
[Slop New York](https://github.com/mrdoob/slop-newyork) de mrdoob (three.js WebGPURenderer + TSL, licencia MIT),
partiendo de su adaptación a una ciudad argentina, [Slop Santa Fe](https://github.com/ArtoriasDelAbismo/slop-sf).
Sirve para comparar gráficos y rendimiento con el juego; no comparte código con él.

Se publica junto al juego en `/slop-quilmes/` (archivos en `public/slop-quilmes/`).

## Datos

Todo sale del mapa del juego (`public/data/quilmes.json`), así las dos versiones muestran las mismas calles y edificios:

- Calles, parques y agua: OpenStreetMap a través de Overture Maps.
- Edificios (98 mil): contornos de Google Open Buildings / Overture recortados a las calles, con su altura real de
  Google Open Buildings 2.5D Temporal.
- Negocios (909) en los carteles de las fachadas, lugares (64) en el mapa y estaciones: OpenStreetMap / Overture.
- Árboles: estimados en las veredas.

© OpenStreetMap contributors (ODbL), Overture Maps Foundation, Google Open Buildings (CC BY 4.0).

## Qué se cambió del motor

- `adapt_quilmes.py`: nombres, barrios y teletransportes de Quilmes.
- `adapt_full.py`:
  - taxis porteños (negros con techo amarillo) en vez de los yellow cabs, y el auto del jugador es uno de ellos;
  - patentes Mercosur, colectivos en vez de los micros MTA, sin buzones USPS;
  - km/h y metros, cámaras en lugares de Quilmes, menús en castellano;
  - los negocios reales en los carteles de las fachadas;
  - los lugares del juego en el mapa y en "Ir a".
- `src/slop/gtaWorld.js` (empaquetado con `vite.slop.config.js` en `js/gta-world.js`): el mismo código del juego
  (`src/world/landmarks.js`, `zones.js`) arma la Catedral, las iglesias, municipalidad y hospitales, las estaciones,
  los estadios, la cervecería, las plazas, las canchas y la peatonal sobre `js/gta-world.json`, y los gira al marco
  del motor (`GAME_FRAME` en `js/quilmes-places.js`).
- `tools/geo-base.mjs`: el marco de Quilmes (origen en Alsina y Av. Mitre, cuadrícula girada 58°). La zona detallada
  cubre todas las calles del mapa.

## Regenerar

```sh
# copiar Slop Santa Fe a <dir>/app, y tools/* de acá sobre <dir>/app/tools
python3 scripts/slop-quilmes/prepare.py <dir> public/data/quilmes.json   # osm_quilmes.json + CSV de edificios y alturas
node --max-old-space-size=8000 <dir>/app/tools/build-geodata.mjs         # ~3 min
node <dir>/app/tools/build-buildings.mjs tools/data/cache/gob_quilmes.csv
node <dir>/app/tools/build-trees.mjs
node <dir>/app/tools/build-places.mjs public/data/quilmes.json
python3 scripts/slop-quilmes/adapt_quilmes.py <dir>/app
# celulares: la misma ciudad del motor, solo Quilmes centro y Bernal, en <dir>/app/js/lite/
#   (en una copia de tools/: GEO_DETAIL=-2500,900,-700,1400 con build-geodata, build-buildings y build-trees)
npx vite build -c vite.slop.config.js && cp scripts/slop-quilmes/build/gta-world.js <dir>/app/js/   # los lugares hechos a mano del juego
python3 scripts/slop-quilmes/adapt_full.py <dir>/app
scripts/slop-quilmes/publish.sh <dir>/app   # copia a public/slop-quilmes/ y marca la versión en cada import (?v=...) para que
# los navegadores no sigan usando los módulos viejos de la caché
```

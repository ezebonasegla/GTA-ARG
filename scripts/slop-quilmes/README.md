# Slop Quilmes (demo de comparación)

El centro de Quilmes (unos 2 × 2 km alrededor de la Plaza San Martín) sobre el motor de
[Slop New York](https://github.com/mrdoob/slop-newyork) de mrdoob (three.js WebGPURenderer + TSL, licencia MIT),
partiendo de su adaptación a una ciudad argentina, [Slop Santa Fe](https://github.com/ArtoriasDelAbismo/slop-sf).
Sirve para comparar gráficos y rendimiento con GTA Quilmes; no comparte código con el juego.

Se publica junto al juego en `/slop-quilmes/` (archivos en `public/slop-quilmes/`).

## Datos

- Calles, parques, agua, vías y lugares: OpenStreetMap a través de Overture Maps
  (`scripts/fetch_overture.py`), convertidos al formato Overpass que esperan las herramientas.
- Edificios: los contornos del mapa del juego (Google Open Buildings / Overture, ya recortados a las calles) con su
  altura real de Google Open Buildings 2.5D Temporal (`scripts/fetch_heights.py`).
- Árboles: estimados en las veredas (OpenStreetMap no tiene árboles cargados en la zona).

© OpenStreetMap contributors (ODbL), Overture Maps Foundation, Google Open Buildings (CC BY 4.0).

## Regenerar

```sh
python3 scripts/fetch_overture.py --lat -34.7206 --lon -58.2546 --radius 1400 --out <dir>/data/overture-raw.json
# copiar Slop Santa Fe a <dir>/app, y estas herramientas sobre <dir>/app/tools
python3 scripts/slop-quilmes/prepare.py <dir> public/data/quilmes.json   # osm_quilmes.json + CSV de edificios y alturas
node <dir>/app/tools/build-geodata.mjs
node <dir>/app/tools/build-buildings.mjs tools/data/cache/gob_quilmes.csv
node <dir>/app/tools/build-trees.mjs
python3 scripts/slop-quilmes/adapt_quilmes.py <dir>/app            # nombres, teletransportes y barrios de Quilmes
```

`tools/geo-base.mjs` tiene el marco de Quilmes: origen en Alsina y Av. Mitre, cuadrícula girada 58°, zona detallada
de ±1050 m.

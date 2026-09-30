# GTA Quilmes

Un juego de mundo abierto 3D estilo GTA, en el navegador, ambientado en **Quilmes (Provincia de Buenos Aires)**.
Recorrés la ciudad a pie o manejando, robás autos, esquivás colectivos y le escapás a la policía.

Hecho con [Three.js](https://threejs.org/) y datos abiertos de [OpenStreetMap](https://www.openstreetmap.org/).

## Cómo jugar

```bash
npm install
npm run dev         # abrí http://localhost:5173
```

El repositorio ya incluye el **mapa real de Quilmes** (`public/data/quilmes.json`): un cuadrado de 5 km
centrado en la Plaza San Martín, con **4.816 calles** con su nombre y sentido reales y **67.579 edificios**
(Quilmes centro, Bernal, Quilmes Oeste, Ezpeleta, la autopista, la ribera y el Río de la Plata).
Para regenerarlo o ampliarlo mirá [Mapa real](#mapa-real-de-quilmes).

Si el archivo no está, el juego arranca con una **aproximación procedural** del centro de Quilmes.
También podés forzarla con `?mapa=procedural` en la URL.

### Controles

| Tecla | Acción |
| --- | --- |
| `W A S D` / flechas | caminar / manejar |
| Mouse | mover la cámara (hacé clic para capturar el mouse) |
| `Shift` | correr |
| `Espacio` | saltar / freno de mano (derrapar) |
| `E` | subir, bajar o robar un auto |
| `H` | bocina |
| `F` | empujar |
| `C` | cambiar distancia de cámara |
| `O` | pantalla completa (también con el botón ⛶ arriba) |
| `T` | adelantar el reloj 1 hora |
| `P` | pausar el reloj |
| `V` | activar/desactivar modo fantasma (vuelo libre) |
| En modo fantasma: `W A S D` + `Espacio`/`Shift` (`Control` acelera) | volar por el cielo |
| `Tab` | ayuda |

### En el celular

Abrilo desde el navegador del celular (o tablet) y ponelo en **horizontal**. Aparecen controles en pantalla:
joystick a la izquierda (tocá y arrastrá; empujado al máximo, corrés), arrastrar del lado derecho mueve la
cámara, y botones para subir/bajar del auto, saltar, empujar y cambiar de cámara. Manejando aparecen los
pedales **Acelerar** y **Freno**, el joystick dobla y "Saltar" pasa a ser el freno de mano. En celulares
el juego baja la resolución y la calidad de las sombras para andar más fluido.

Para probarlo desde el celular en la misma red Wi-Fi: `npm run dev -- --host` y abrí la dirección
"Network" que muestra Vite.

### Qué hay en el juego

- Ciudad 3D con fachadas típicas del conurbano: casas de revoque con rejas y persianas, ladrillo a la vista,
  PH, edificios de departamentos con balcones, locales con carteles y persianas metálicas, tanques de agua
  en los techos, techos de tejas, veredas de baldosas y árboles en las calles.
- Tránsito que respeta las calles de **mano única** y circula por la derecha: autos, taxis negro y amarillo,
  camionetas y **colectivos**. Autos estacionados junto al cordón.
- Peatones que caminan por las veredas y se asustan con la bocina.
- Nivel de búsqueda (estrellas): atropellar gente, robar patrulleros o chocarlos suma estrellas; los
  patrulleros te persiguen por las calles. Alejate para perderlos o te agarran (BUSTED).
- Ciclo de día y noche con el recorrido del sol para la latitud de Quilmes, ventanas y faroles que se prenden.
- Minimapa con los puntos de referencia, velocímetro, reloj y nombre de la calle actual.
- **Trenes de la línea Roca** que circulan por las vías reales y paran en las estaciones Quilmes y Bernal
  (cuidado: atropellan).

### Modo fotorrealista (ciudad 3D de Google, gratis)

Con la tecla **G** el juego cambia la ciudad generada por la **malla fotorrealista 3D de Google**
(Photorealistic 3D Tiles, la misma de Google Earth), donde cada casa tiene su forma y colores reales. Las calles,
colisiones, tránsito, colectivos y trenes siguen funcionando igual por debajo.

Se accede gratis a través de **Cesium ion** (plan Community, sin tarjeta, uso no comercial, con un cupo mensual
de sesiones):

1. Creá una cuenta gratuita en <https://cesium.com/ion>.
2. En *Asset Depot* agregá "Google Photorealistic 3D Tiles" a tu cuenta si no aparece en *My Assets*.
3. En *Access Tokens* copiá el token (el *Default Token* sirve).
4. Pegalo en la pantalla de inicio del juego, en "Modo fotorrealista". Queda guardado sólo en tu navegador.

También podés dejarlo fijo al desarrollar/publicar con variable de entorno:

```bash
VITE_CESIUM_ION_TOKEN=tu_token npm run dev
```

Limitaciones: la página publicada en claude.ai bloquea las descargas de otros sitios, así que este modo funciona
jugando en tu computadora (`npm run dev`) o desde una página propia (por ejemplo GitHub Pages). A nivel de calle
la malla se ve algo "derretida" (árboles y autos pegados a las paredes), de noche las fotos se oscurecen pero
no tienen luces reales, y en celulares es bastante más pesado. Google exige mostrar sus créditos, que aparecen
abajo a la derecha.

### Colectivos reales

Los colectivos recorren los **recorridos reales** de las líneas que pasan por Quilmes y paran en sus **paradas
reales**, con el número de línea y el destino en el cartel (adelante, al costado y atrás). Cada parada tiene su
poste; al acercarte a pie, la pantalla muestra la dirección de la parada y qué líneas paran ahí.

Líneas incluidas (22): 22, 85, 98, 129, 148, 159, 178, 195, 219, 257, 263, 266, 278, 281, 293, 295, 300,
324, 372, 570, 580 y 585, con sus ramales en ambos sentidos (185 recorridos y 1.286 paradas).

Los datos salen del **GTFS oficial de colectivos del AMBA** (Gobierno de la Ciudad de Buenos Aires, vía la
copia de Mobility Database) con `npm run fetch-buses` (`scripts/fetch_buses.py` → `public/data/buses.json`).
La copia disponible corresponde al **último trimestre de 2019**: algunos recorridos pueden haber cambiado desde
entonces, y las líneas municipales (582, 583, 584) no están en ese archivo. Los colores de cada empresa son
representativos (el GTFS no los incluye).

### Lugares con forma propia

Los lugares conocidos se detectan en los datos (`scripts/specials.mjs`) y se modelan sobre su ubicación y
huella reales (`src/world/landmarks.js`):

| Lugar | Cómo se ve en el juego |
| --- | --- |
| Catedral de Quilmes | nave central con naves laterales y contrafuertes, ábside, frente con columnas, rosetón y frontón mirando a la plaza, campanario con cúpula, linterna y cruz |
| Iglesias y parroquias | nave con techo a dos aguas, frontón y campanario con aguja |
| Municipalidad, Teatro Municipal, Museo, Departamento Judicial | pórtico de columnas con frontón y escalinata hacia la calle; la Municipalidad con bandera argentina y cartel |
| Hospitales y clínicas | cruces rojas, marquesina de acceso y cartel iluminado de noche |
| Estaciones Quilmes y Bernal | andenes a ambos lados de las vías, techos de estilo inglés sobre columnas, carteles con el nombre, bancos y edificio de ladrillo con techo de tejas |
| Estadio Centenario (Quilmes A.C.) y otros estadios | tribunas escalonadas blancas y azules, platea techada, torres de iluminación; el Estadio Nacional de Hockey con césped azul |
| Cervecería y Maltería Quilmes | complejo de ladrillo, silos, chimenea y el cartel "Quilmes" en el techo |
| Plazas (San Martín, Bicentenario, 9 de Julio…) | senderos perimetrales, diagonales y en cruz, bancos, faroles y monumento: ecuestre de San Martín, obelisco, fuente o busto |
| Canchas de fútbol | líneas, áreas, círculo central y arcos |

Las formas son **representativas**, no copias exactas de cada edificio: siguen la ubicación, el tamaño y la
orientación reales, pero los detalles (cantidad de columnas, altura de la torre, etc.) son aproximados.

## Mapa real de Quilmes

Hay dos fuentes, y las dos terminan en el mismo conversor (`scripts/fetch-osm.mjs`):

### Overture Maps (recomendado, es la que se usó para el mapa incluido)

```bash
pip install pyarrow shapely
npm run fetch-overture      # = python3 scripts/fetch_overture.py && node scripts/fetch-osm.mjs --input .cache/overture-raw.json
```

[Overture Maps](https://overturemaps.org/) publica gratis (bucket S3 público, sin API key) las calles de
OpenStreetMap junto con **huellas de edificios detectadas en imágenes satelitales** (Google Open Buildings,
Microsoft ML Buildings). En Quilmes eso da ~62.000 edificios contra ~2.400 dibujados a mano en OSM.
Como casi ninguno tiene altura cargada, el conversor la estima según el tamaño de la huella y la distancia
al centro (donde están las torres), y **divide las huellas que agrupan varias casas pegadas** en lotes de
~8,66 m, cada uno con su propia altura (se desactiva con `--no-split`). Los comercios de Overture Places
marcan qué edificios tienen local en planta baja, las iglesias toman estilo de iglesia y los lugares
conocidos (Catedral, Municipalidad, Estación Quilmes, Cervecería Quilmes, estadio de Quilmes…) aparecen en el minimapa.

Opciones: `python3 scripts/fetch_overture.py --lat -34.72 --lon -58.27 --radius 3000` (y el mismo
`--radius` para `fetch-osm.mjs`).

### OpenStreetMap directo (Overpass)

```bash
npm run fetch-osm                             # 2 km alrededor de Plaza San Martín (llega al río)
npm run fetch-osm -- --radius 3000            # área más grande (más pesada)
npm run fetch-osm -- --lat -34.72 --lon -58.27 # centrar en otro punto (p. ej. Quilmes Oeste)
npm run fetch-osm -- --input respuesta.json   # convertir una respuesta de Overpass guardada
npm run fetch-osm -- --no-infill              # no completar lotes faltantes
```

El script consulta la API de Overpass y genera `public/data/quilmes.json` con:

- **Calles** con su nombre, ancho (según tipo, `lanes` o `width`) y sentido (`oneway`).
- **Edificios** con su huella real. La altura sale de `height` o `building:levels`; si no está cargada se estima
  según el tipo de edificio. Usa `building:colour` y `roof:shape` cuando existen, y marca planta baja comercial
  en los edificios que tienen comercios (`shop`, bares, farmacias, etc.) mapeados.
- **Plazas, parques, canchas, playas, agua y la costa del Río de la Plata**, vías del tren y estaciones.
- **Relleno de manzanas**: en OSM muchas casas del conurbano no están dibujadas. El script completa el frente de
  las manzanas vacías con lotes de ~8,66 m típicos de la zona (se puede desactivar con `--no-infill`).

Los datos del mapa son © colaboradores de OpenStreetMap ([ODbL](https://www.openstreetmap.org/copyright)),
Overture Maps Foundation, Google Open Buildings y Microsoft ML Buildings, bajo las licencias con las que Overture
los publica. Si publicás el juego con el mapa, mantené esa atribución (el juego la muestra en pantalla).

### ¿Y Google Street View?

No se usa Street View para generar los edificios: los términos de Google Maps Platform prohíben descargar,
extraer o derivar datos de sus imágenes, y analizar automáticamente cada fachada tampoco es viable a esta escala.
Formas legítimas de acercarse más a la realidad:

1. **Mejorar OpenStreetMap**: cargar `building:levels`, `building:colour` y `roof:shape` de las casas de Quilmes
   (por ejemplo con [StreetComplete](https://streetcomplete.app/) o el editor iD). Todo lo que se cargue aparece
   en el juego la próxima vez que corras `npm run fetch-osm`.
2. **Google Photorealistic 3D Tiles** (API oficial de Map Tiles): permite mostrar la malla fotorrealista de Google
   dentro de una app 3D con una API key propia, respetando sus términos y atribución. Es un posible paso futuro
   (por ejemplo con `3d-tiles-renderer` para Three.js), aunque es mucho más pesado y no sirve para colisiones.

## Estructura del código

```
index.html               HUD, pantallas de carga/inicio y estilos
src/main.js              loop del juego, cámara, entrar/salir de autos, nivel de búsqueda
src/environment.js       cielo, sol, niebla, ciclo día/noche
src/hud.js               minimapa, velocímetro, estrellas, mensajes
src/audio.js             sonidos sintetizados (motor, bocina, sirena, golpes)
src/input.js             teclado y mouse
src/world/procedural.js  aproximación procedural de Quilmes centro
src/world/builder.js     convierte los datos en mallas (calles, veredas, edificios, árboles, faroles)
src/world/textures.js    texturas generadas por código (fachadas, asfalto, baldosas…)
src/world/roadGraph.js   grafo de calles (tránsito, peatones, rutas de la policía)
src/world/collision.js   colisiones 2D contra edificios y objetos
src/world/geo.js         proyección lat/lon ↔ metros y utilidades geométricas
src/world/landmarks.js   modelos de los lugares conocidos (catedral, estaciones, estadios…)
src/entities/            jugador, vehículos (física arcade), tránsito, policía, peatones y trenes
scripts/specials.mjs     detecta los lugares conocidos al convertir el mapa
scripts/landmark-shots.mjs capturas de cada lugar conocido (con navegador headless)
src/entities/buses.js    colectivos por sus recorridos reales y postes de parada
scripts/fetch_buses.py   extrae líneas, recorridos y paradas del GTFS de colectivos
src/touch.js             controles táctiles para celular
scripts/mobile-test.mjs  prueba en un celular emulado con toques (joystick, botones, pedales)
scripts/fetch_overture.py descarga Quilmes de Overture Maps
scripts/fetch-osm.mjs    conversor al formato del juego (y descarga directa de OpenStreetMap)
scripts/smoke.mjs        prueba automática con navegador headless (capturas de pantalla)
```

### Formato de `public/data/quilmes.json`

Coordenadas en metros (`x` = este, `z` = sur) respecto de `origin`:

```jsonc
{
  "source": "overture",
  "origin": { "lat": -34.7206, "lon": -58.2546 },
  "roads": [{ "pts": [[x, z], ...], "w": 9, "name": "Rivadavia", "kind": "residential", "oneway": true }],
  "buildings": [{ "pts": [[x, z], ...], "h": 6.3, "levels": 2, "style": "house", "shop": true, "roof": "gable" }],
  "areas": [{ "kind": "park|plaza|water|sand|pitch|railway|parking", "pts": [[x, z], ...] }],
  "rails": [{ "pts": [[x, z], ...] }],
  "landmarks": [{ "name": "Catedral de Quilmes", "pos": [x, z] }],
  "spawn": [x, z]
}
```

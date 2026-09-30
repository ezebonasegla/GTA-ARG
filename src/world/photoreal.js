// Photorealistic mode: streams Google Photorealistic 3D Tiles through a free
// Cesium ion account and shows them instead of the generated city. Gameplay
// (streets, collisions, traffic, buses, trains) keeps using the map data, which
// sits invisibly underneath.
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TileCompressionPlugin, UnloadTilesPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const GOOGLE_3D_TILES_ASSET = '2275207'; // "Google Photorealistic 3D Tiles" in Cesium ion
const TOKEN_KEY = 'gta-quilmes-cesium-token';
const ENV_TOKEN = String(import.meta.env.VITE_CESIUM_ION_TOKEN || '').trim();

export function defaultToken() {
  return ENV_TOKEN;
}

export function savedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the token only lasts this session */
  }
}

export class Photoreal {
  constructor({ scene, camera, renderer, origin, token, onError }) {
    this.camera = camera;
    this.renderer = renderer;
    this.onError = onError;
    this.failed = false;
    this.loadedTiles = 0;
    this.materials = new Set();
    this.groundOffset = null;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
    this.probeTimer = 0;
    this.probeOffsets = [
      [0, 0],
      [2.2, 0],
      [-2.2, 0],
      [0, 2.2],
      [0, -2.2],
      [1.5, 1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [-1.5, -1.5],
    ];

    const tiles = (this.tiles = new TilesRenderer());
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: token, assetId: GOOGLE_3D_TILES_ASSET, autoRefreshToken: true }));
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());
    // put Plaza San Martín (the map origin) at (0, 0, 0) with +Y up
    tiles.registerPlugin(new ReorientationPlugin({
      lat: THREE.MathUtils.degToRad(origin.lat),
      lon: THREE.MathUtils.degToRad(origin.lon),
      height: 0,
      recenter: true,
    }));
    tiles.errorTarget = window.matchMedia('(max-width: 900px)').matches ? 9 : 6;
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);

    tiles.addEventListener('load-model', ({ scene: model }) => {
      this.loadedTiles++;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = false;
        for (const m of [].concat(o.material)) {
          this.materials.add(m);
          if (m?.map) m.map.anisotropy = this.maxAnisotropy;
        }
      });
    });
    tiles.addEventListener('dispose-model', ({ scene: model }) => {
      model.traverse((o) => {
        if (o.isMesh) for (const m of [].concat(o.material)) this.materials.delete(m);
      });
    });
    tiles.addEventListener('load-error', (e) => {
      if (this.failed) return;
      this.failed = true;
      const msg = String(e?.error?.message || e?.error || '');
      this.onError?.(/401|403|token|unauthor/i.test(msg)
        ? 'Cesium ion rechazó el token. Revisá que esté bien copiado y que tu cuenta tenga "Google Photorealistic 3D Tiles".'
        : /claude/i.test(location.hostname)
          ? 'El link de claude.ai no permite descargar la ciudad 3D de Google. Para el modo fotorrealista abrí el juego desde su página propia o en tu computadora.'
          : 'No se pudieron descargar los 3D Tiles (sin conexión o bloqueados por el sitio donde está publicado el juego).');
    });

    // The plugin places X to the west and Z to the north; the game uses X east, Z south.
    this.holder = new THREE.Group();
    this.holder.rotation.y = Math.PI;
    this.holder.add(tiles.group);
    scene.add(this.holder);
  }

  // Ground height of the 3D mesh near (x, z): sampled on the nearest street point so
  // roofs and tree tops don't count.
  probeGround(x, z) {
    this.holder.updateMatrixWorld(true);
    const ys = [];
    this.raycaster.far = 900;
    for (const [ox, oz] of this.probeOffsets) {
      this.raycaster.set(new THREE.Vector3(x + ox, 400, z + oz), new THREE.Vector3(0, -1, 0));
      const hit = this.raycaster.intersectObject(this.tiles.group, true)[0];
      if (hit) ys.push(hit.point.y);
    }
    if (!ys.length) return null;
    ys.sort((a, b) => a - b);
    // lower quartile: avoids rooftops / tree crowns while keeping street-level terrain.
    return ys[Math.max(0, Math.floor((ys.length - 1) * 0.25))];
  }

  update(dt, { x, z, streetX, streetZ, night }) {
    this.camera.updateMatrixWorld();
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.tiles.update();
    // Keep the mesh's ground level at the game's y = 0 around the player
    // (Quilmes is almost flat, so a local offset is enough).
    this.probeTimer -= dt;
    if (this.probeTimer <= 0 && this.loadedTiles > 0) {
      this.probeTimer = 0.5;
      const y = this.probeGround(streetX ?? x, streetZ ?? z);
      if (y !== null) {
        const target = this.holder.position.y - y;
        if (this.groundOffset === null) this.groundOffset = target;
        else {
          const next = this.groundOffset + (target - this.groundOffset) * 0.25;
          const maxStep = 1.3; // cap correction speed so noisy probes don't jump
          this.groundOffset += THREE.MathUtils.clamp(next - this.groundOffset, -maxStep, maxStep);
        }
        this.holder.position.y = this.groundOffset;
      }
    }
    // the photos have daylight baked in: darken them at night
    const k = 1 - night * 0.8;
    for (const m of this.materials) m.color?.setScalar(k);
  }

  // Google requires showing the data attributions on screen.
  attribution() {
    const list = this.tiles.getAttributions();
    const text = list.filter((a) => a.type === 'string').map((a) => a.value).join(' · ');
    return `Google${text ? ' · ' + text : ''} · vía Cesium ion`;
  }

  get ready() {
    return this.groundOffset !== null;
  }
}

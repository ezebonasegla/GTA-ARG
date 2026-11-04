// Bundles src/slop/gtaWorld.js (the game's hand-made places) for Slop Quilmes:
// npx vite build -c vite.slop.config.js  ->  scripts/slop-quilmes/build/gta-world.js
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'scripts/slop-quilmes/build',
    emptyOutDir: true,
    minify: true,
    lib: { entry: 'src/slop/gtaWorld.js', formats: ['es'], fileName: () => 'gta-world.js' },
    rollupOptions: {
      external: [/^three/],
      output: {
        // the page's import map: three = three.webgpu.js (core classes included), addons under three/addons/
        paths: (id) => id.replace(/^three\/examples\/jsm\//, 'three/addons/'),
      },
    },
  },
});

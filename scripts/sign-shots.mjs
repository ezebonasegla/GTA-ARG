// Close-up screenshots of street corner signs.
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:5174/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
await page.goto(url);
await page.waitForSelector('#start:not(.hidden)', { timeout: 180000 });
await page.click('#start');
await page.waitForTimeout(1500);
const posts = await page.evaluate(() => {
  const d = window.__game.data;
  const all = window.__game.world.streetSigns.posts;
  const want = d.source === 'procedural' ? [[d.spawn[0], d.spawn[1]], [d.spawn[0] + 150, d.spawn[1] - 120]] : [[13, -7], [94, -41], [-250, 169]];
  const picks = want.map(([x, z]) => all.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]).filter(Boolean);
  return picks.length ? picks : [];
});
console.log('streetSigns in data:', await page.evaluate(() => window.__game.data.streetSigns?.length ?? 'computed in browser'), 'posts built:', await page.evaluate(() => window.__game.world.streetSigns.posts.length));
let k = 0;
for (const p of posts) {
  k++;
  const views = k === 1 ? [[0.6, 1], [-1, 0.4]] : [[0.6, 1]];
  let v = 0;
  for (const [ax, az] of views) {
    v++;
    await page.evaluate(({ p, ax, az }) => {
      const g = window.__game;
      g.freeCam = true;
      g.hours = 15;
      g.player.x = p.x + 6;
      g.player.z = p.z + 6;
      // look at the post from a diagonal so both plates are visible
      const d = p.signs[0].dir;
      const bx = d[0] * ax - d[1] * az, bz = d[1] * ax + d[0] * az;
      const l = Math.hypot(bx, bz);
      g.camera.position.set(p.x + (bx / l) * 3.6, 1.9, p.z + (bz / l) * 3.6);
      g.camera.lookAt(p.x, 2.2, p.z);
    }, { p, ax, az });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/sign-${k}${v > 1 ? '-b' : ''}.png` });
    console.log(k, JSON.stringify(p));
  }
}
const stats = await page.evaluate(() => ({ calls: window.__game.renderer.info.render.calls, chunks: window.__game.scene.getObjectByName('streetSigns').children.length }));
console.log(stats);
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();

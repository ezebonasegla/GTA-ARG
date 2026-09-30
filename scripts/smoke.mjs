// Headless smoke test: loads the game, drives around a bit and saves screenshots.
// Usage: npm run dev (in another terminal), then: node scripts/smoke.mjs [url] [outDir]
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForSelector('#start:not(.hidden)', { timeout: 120000 });
await page.click('#start');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/shot-1-foot.png` });
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0;
  const t0 = performance.now();
  const tick = () => (++n, performance.now() - t0 < 3000 ? requestAnimationFrame(tick) : res(n / 3));
  requestAnimationFrame(tick);
}));
console.log('fps (software GL):', fps.toFixed(1));
// walk to the car and get in
await page.evaluate(() => {
  const g = window.__game;
  const car = g.traffic.vehicles.find((v) => v.parked);
  g.player.x = car.x + 2.2 * Math.cos(car.heading);
  g.player.z = car.z - 2.2 * Math.sin(car.heading);
});
await page.keyboard.press('KeyE');
// the player walks to the door and climbs in (~0.8 s of game time)
await page.waitForFunction(() => window.__game.player.vehicle, null, { timeout: 120000 });
await page.keyboard.down('KeyW');
await page.waitForTimeout(5000);
console.log('speed km/h:', await page.evaluate(() => (window.__game.player.vehicle?.speed * 3.6).toFixed(1)));
await page.keyboard.up('KeyW');
await page.screenshot({ path: `${out}/shot-2-car.png` });
await page.evaluate(() => (window.__game.hours = 21.5));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/shot-3-night.png` });
const stats = await page.evaluate(() => {
  const g = window.__game;
  return { inCar: !!g.player.vehicle, vehicles: g.traffic.vehicles.length, peds: g.peds.list.length, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, source: g.data.source };
});
console.log(JSON.stringify(stats));
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();

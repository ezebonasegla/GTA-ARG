// Emulates a phone in landscape and drives the game with touch events.
// Usage: node scripts/mobile-test.mjs [url] [outDir]
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForSelector('#start:not(.hidden)', { timeout: 180000 });
await page.tap('#start');
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })) });
const center = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
const state = () => page.evaluate(() => { const g = window.__game; return { x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1), inCar: !!g.player.vehicle, speed: g.player.vehicle ? +(g.player.vehicle.speed * 3.6).toFixed(1) : 0 }; });

await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/mobile-1-pie.png` });
const s0 = await state();
// joystick: touch the left side and push up
await touch('touchStart', [[120, 300, 1]]);
await touch('touchMove', [[120, 240, 1]]);
await page.waitForTimeout(4000);
const s1 = await state();
await touch('touchEnd', []);
console.log('walk with stick:', JSON.stringify(s0), '->', JSON.stringify(s1));
// camera: drag on the right half
const yaw0 = await page.evaluate(() => window.__game.camera.rotation.y);
await touch('touchStart', [[600, 150, 2]]);
await touch('touchMove', [[640, 150, 2]]);
await touch('touchMove', [[680, 150, 2]]);
await page.waitForTimeout(800);
await touch('touchEnd', []);
console.log('camera drag changed view:', Math.abs((await page.evaluate(() => window.__game.camera.rotation.y)) - yaw0) > 0.01);
// get in the car with the button
await page.evaluate(() => {
  const g = window.__game;
  const car = g.traffic.vehicles.find((v) => v.parked) || g.traffic.vehicles[0];
  g.player.x = car.x + 2.2 * Math.cos(car.heading);
  g.player.z = car.z - 2.2 * Math.sin(car.heading);
});
await page.waitForTimeout(600);
const [ex, ey] = await center('#touch button[data-key="KeyE"]');
await touch('touchStart', [[ex, ey, 3]]);
await page.waitForTimeout(700);
await touch('touchEnd', []);
await page.waitForTimeout(1500);
console.log('after Subir:', JSON.stringify(await state()), 'button label:', await page.textContent('#touch button[data-key="KeyE"]'));
// gas pedal + steer with stick at the same time (multi-touch)
const [gx, gy] = await center('#touch button[data-key="KeyW"]');
await touch('touchStart', [[gx, gy, 4], [120, 300, 5]]);
await touch('touchMove', [[gx, gy, 4], [170, 300, 5]]);
await page.waitForTimeout(6000);
console.log('driving:', JSON.stringify(await state()));
await page.screenshot({ path: `${out}/mobile-2-auto.png` });
await touch('touchEnd', []);
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();

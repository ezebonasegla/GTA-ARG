// Screenshots of the special places (needs `npm run dev` running).
// Usage: node scripts/landmark-shots.mjs [url] [outDir]
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForSelector('#start:not(.hidden)', { timeout: 180000 });
await page.click('#start');
const targets = await page.evaluate(() => {
  const d = window.__game.data;
  const pick = [];
  const b = (re, type) => d.buildings.find((x) => x.special?.type === type && re.test(x.special.name || ''));
  const s = (type, re) => (d.specials || []).find((x) => x.type === type && (!re || re.test(x.name || '')));
  const add = (name, o, dist, h) => o && pick.push({ name, cx: o.cx, cz: o.cz, dist, h });
  add('catedral', b(/catedral/i, 'cathedral')?.special.box, 75, 30);
  add('municipalidad', b(/municipalidad/i, 'civic')?.special.box, 60, 20);
  add('hospital', b(/iriarte/i, 'hospital')?.special.box, 55, 22);
  const st = s('station', /quilmes/i);
  add('estacion', st, 70, 18);
  add('estadio', s('stadium', /centenario/i)?.box, 150, 70);
  add('cerveceria', s('brewery')?.box, 260, 90);
  add('plaza-san-martin', s('plaza', /san mart/i)?.box, 45, 16);
  add('iglesia', d.buildings.find((x) => x.special?.type === 'church')?.special.box, 45, 18);
  return pick;
});
for (const t of targets) {
  await page.evaluate((t) => {
    const g = window.__game;
    g.freeCam = true;
    g.camera.far = 3000;
    g.camera.updateProjectionMatrix();
    g.player.x = t.cx + 40;
    g.player.z = t.cz + 40;
    g.camera.position.set(t.cx + t.dist * 0.7, t.h, t.cz + t.dist * 0.7);
    g.camera.lookAt(t.cx, t.h * 0.25, t.cz);
    g.hours = 16;
    if (t.name === 'estacion') {
      // bring a train into the station for the picture
      for (const tr of g.trains.trains) {
        const p = tr.track.project(t.cx, t.cz);
        if (p.d < 25) {
          tr.s = p.s + tr.dir * 70;
          tr.wait = 30;
        }
      }
    }
  }, t);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/lugar-${t.name}.png` });
}
console.log('lugares:', targets.map((t) => t.name).join(', '));
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();

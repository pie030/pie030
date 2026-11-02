import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = 'http://127.0.0.1:8765/Serra_do_Eter_World_Evolution_V8.html';
const errors = [];
const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('PASS', message);
};
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--disable-dev-shm-usage']
});
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('boot')?.style.display === 'none', { timeout: 60000 });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const gl = document.getElementById('world').getContext('webgl');
    return {
      hasCanvas: !!gl,
      contextLost: gl?.isContextLost(),
      frameWidth: document.getElementById('world').width,
      frameHeight: document.getElementById('world').height,
      fpsText: document.getElementById('info').textContent,
      altitude: Number(document.getElementById('altitude').textContent)
    };
  });
  console.log('STATE', state);
  check(state.hasCanvas && !state.contextLost, 'WebGL inicializado sem perda do contexto');
  check(state.frameWidth > 800 && state.frameHeight > 400, 'Canvas dimensionado');
  check(Number.isFinite(state.altitude), 'Altitude inicial finita');
  check(state.fpsText.includes('blocos'), 'Chunks e HUD atualizados');
  await page.screenshot({ path: 'artifacts/serra-v8-desktop.png' });

  await page.locator('#cam').click();
  check((await page.locator('#cam').textContent()).includes('vertical'), 'Câmera alternada');
  await page.locator('#map').click();
  check(await page.locator('#miniwrap').isVisible(), 'Minimapa ligado');
  await page.locator('#menu').click();
  await page.locator('#dest').selectOption('coast');
  await page.locator('#travel').click();
  await page.waitForTimeout(1200);
  check(Number(await page.locator('#altitude').textContent()) < 40, 'Teleporte ao litoral');
  await page.locator('#menu').click();
  await page.locator('#quality').click();
  check((await page.locator('#quality').textContent()).includes('econômica'), 'Qualidade econômica ativada');
  await page.locator('#audit').click();
  const audit = await page.locator('#report').textContent();
  check(audit.includes('Subida da Cordilheira') && audit.includes('Serra Oriental'), 'Auditoria cobre as serras');
  await page.locator('#dest').selectOption('base');
  await page.locator('#travel').click();
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.up('w');
  check(Number(await page.locator('#speed').textContent()) > 0, 'Aceleração funciona');
  await page.locator('#menu').click();
  await page.locator('#auto').click();
  await page.waitForTimeout(1000);
  check((await page.locator('#auto').textContent()).includes('Parar'), 'Piloto demonstrativo ativo');
  await page.screenshot({ path: 'artifacts/serra-v8-road.png' });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', e => errors.push('mobile: ' + e.message));
  await mobile.goto(url, { waitUntil: 'load' });
  await mobile.waitForFunction(() => document.getElementById('boot')?.style.display === 'none', { timeout: 60000 });
  await mobile.waitForTimeout(800);
  check(await mobile.locator('.touch').isVisible(), 'Controles touchscreen visíveis');
  await mobile.screenshot({ path: 'artifacts/serra-v8-mobile.png' });

  check(errors.length === 0, 'Nenhuma exceção JavaScript/console fatal: ' + errors.join(' | '));
  console.log('ALL SMOKE TESTS PASSED');
} finally {
  await browser.close();
}

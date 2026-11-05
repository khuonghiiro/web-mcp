import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { scout } from '../src/scout/browser.js';
import { importCapture } from '../src/scout/importCapture.js';
import { analyze } from '../src/analyzer/specGenerator.js';
import { readJson, writeJson, harSchema } from '../src/core.js';
import { demoServer } from '../examples/site.js';

const root = resolve('artifacts', 'capture-test-' + Date.now());
await mkdir(root, { recursive: true });
const server = demoServer().listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address !== 'string');
const url = `http://127.0.0.1:${address.port}/`;
const extensionPath = resolve('extension');
const profile = join(root, 'profile');
await writeJson(join(profile, 'Default/Preferences'), { download: { default_directory: join(root, 'downloads'), prompt_for_download: false }, savefile: { default_directory: join(root, 'downloads') } });
const context = await chromium.launchPersistentContext(profile, {
  executablePath: chromium.executablePath(), headless: true,
  acceptDownloads: true, downloadsPath: join(root, 'downloads'),
  args: ['--remote-debugging-port=0', `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
});
try {
  const page = await context.newPage();
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('session-proof', 'retained'));
  await context.addCookies([{ name: 'unrelated', value: 'do-not-export', domain: 'other.example', path: '/' }]);
  const other = await context.newPage();
  await other.goto('about:blank');
  const originalPageCount = context.pages().length;
  const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
  const cdpDir = join(root, 'cdp');
  await scout({ url, dir: cdpDir, cdp: `http://127.0.0.1:${port}`, duration: 300, actions: resolve('examples/actions.json') });
  assert.equal(context.pages().length, originalPageCount, 'CDP must reuse an exact matching tab');
  assert.ok(!page.isClosed() && !other.isClosed(), 'Disconnect must leave all user tabs open');
  assert.equal(await page.evaluate(() => localStorage.getItem('session-proof')), 'retained');
  const cdpHar = harSchema.parse(await readJson(join(cdpDir, 'traffic.har')));
  assert.ok(cdpHar.log.entries.some(e => e.request.url.includes('/api/search')));
  assert.ok(!JSON.stringify(await readJson(join(cdpDir, 'auth-state.json'))).includes('do-not-export'));
  assert.ok((await analyze(cdpDir, 'cdp')).paths['/api/search']);
  console.log('PASS CDP: reused logged-in tab, recorded API, preserved browser and excluded unrelated cookies.');

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).host;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.bringToFront();
  const message = (type: string) => popup.evaluate(async type => {
    const api = (globalThis as unknown as { chrome: { runtime: { sendMessage: (message: unknown) => Promise<Record<string, unknown>> } } }).chrome;
    return api.runtime.sendMessage({ type });
  }, type);
  const started = await message('start');
  assert.equal(started.ok, true, JSON.stringify(started));
  await Promise.all([page.waitForResponse(response => response.url().includes('/api/search')), page.reload()]);
  await page.waitForTimeout(500);
  const result = await message('stop');
  assert.equal(result.ok, true, JSON.stringify(result));
  const capture = result.capture as { har: unknown; authState: unknown };
  assert.ok(!JSON.stringify(capture.authState).includes('do-not-export'));
  assert.ok(JSON.stringify(capture.authState).includes('session-proof'));
  assert.ok(harSchema.parse(capture.har).log.entries.some(e => e.request.url.includes('/api/private') && e.response.status === 200));
  assert.ok(!page.isClosed());
  const captureFile = join(root, 'fixture.web-mcp.json');
  await writeJson(captureFile, capture);
  const imported = join(root, 'imported');
  await importCapture(captureFile, imported);
  assert.equal(Object.keys((await analyze(imported, 'imported')).paths).length, 4);
  await assert.rejects(importCapture(captureFile, imported), /EEXIST/);
  await popup.reload();
  assert.match(await popup.locator('h1').innerText(), /Web-to-MCP/);
  await popup.locator('summary').click();
  assert.ok(await popup.locator('#stop').isVisible(), 'Manual export is inside advanced options');
  const [download] = await Promise.all([popup.waitForEvent('download', { timeout: 15000 }), popup.locator('#stop').click()]);
  const downloadPath = join(root, 'downloaded.web-mcp.json');
  try { await download.saveAs(downloadPath); }
  catch (error) {
    const details = await popup.evaluate(async () => (await (globalThis as any).chrome.downloads.search({ limit: 1, orderBy: ['-startTime'] })).map((item: any) => ({ state: item.state, error: item.error, filename: item.filename })));
    throw new Error(String(error) + ' ' + JSON.stringify(details));
  }
  assert.equal((await readJson(downloadPath) as { format: string }).format, 'web-to-mcp-capture-v1');
  await popup.setViewportSize({ width: 380, height: 620 });
  await popup.screenshot({ path: join(root, 'extension.png') });
  console.log('PASS extension: actual unpacked extension captured authenticated API, exported/imported four API paths, refused overwrite.');
  console.log('Artifacts: ' + root);
} finally {
  await context.close();
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
}

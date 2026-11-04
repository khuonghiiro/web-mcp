import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { httpUrl, readJson, writeJson } from '../core.js';
import { humanClick, humanType } from './cursor.js';
import { detectAuth } from './detector.js';

const actionsSchema = z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), selector: z.string() }),
  z.object({ type: z.literal('fill'), selector: z.string(), value: z.string() }),
  z.object({ type: z.literal('wait'), milliseconds: z.number().int().min(0).max(30000) }),
]));
export interface ScoutOptions { url: string; dir: string; headed?: boolean; interactive?: boolean; duration?: number; actions?: string; storageState?: string; channel?: string }
export async function scout(options: ScoutOptions) {
  const target = httpUrl(options.url);
  if (options.interactive && !process.stdin.isTTY) throw new Error('Interactive mode requires a terminal.');
  try { await access(join(options.dir, 'traffic.har')); throw new Error('Capture already exists; use a new project name to preserve the previous session.'); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  await mkdir(options.dir, { recursive: true });
  const browser = await chromium.launch({ headless: !(options.headed || options.interactive), channel: options.channel });
  try {
    const context = await browser.newContext({ storageState: options.storageState, recordHar: { path: join(options.dir, 'traffic.har'), mode: 'full', content: 'embed' } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (options.actions) {
        for (const action of actionsSchema.parse(await readJson(options.actions))) {
          if (action.type === 'click') await humanClick(page, action.selector);
          else if (action.type === 'fill') await humanType(page, action.selector, action.value);
          else await page.waitForTimeout(action.milliseconds);
        }
      }
      if (options.interactive) {
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        try { await rl.question('Complete login / browsing in the browser, then press Enter to save. '); } finally { rl.close(); }
      } else await page.waitForTimeout(options.duration ?? 3000);
      await writeJson(join(options.dir, 'auth.json'), await detectAuth(page));
      await writeJson(join(options.dir, 'auth-state.json'), await context.storageState());
      await writeJson(join(options.dir, 'session.json'), { targetOrigin: target.origin, capturedAt: new Date().toISOString(), runtimeErrors });
      await writeFile(join(options.dir, 'dom.html'), await page.content(), { mode: 0o600 });
      await page.screenshot({ path: join(options.dir, 'page.png'), fullPage: true });
    } finally { await context.close(); }
  } finally { await browser.close(); }
}

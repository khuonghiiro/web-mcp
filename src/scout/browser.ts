import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { httpUrl, readJson, writeJson } from '../core.js';
import { humanClick, humanType } from './cursor.js';
import { detectAuth } from './detector.js';
import { recordPage } from './recorder.js';

const actionsSchema = z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), selector: z.string() }),
  z.object({ type: z.literal('fill'), selector: z.string(), value: z.string() }),
  z.object({ type: z.literal('wait'), milliseconds: z.number().int().min(0).max(30000) }),
]));
export interface ScoutOptions { url: string; dir: string; headed?: boolean; interactive?: boolean; duration?: number; actions?: string; storageState?: string; channel?: string; cdp?: string }
export async function scout(options: ScoutOptions) {
  const target = httpUrl(options.url);
  if (options.cdp && options.storageState) throw new Error('Kết nối trình duyệt hiện tại dùng phiên đăng nhập sẵn có; không dùng cùng --storage-state.');
  if (options.interactive && !process.stdin.isTTY) throw new Error('Chế độ tương tác cần chạy trong cửa sổ terminal.');
  try { await access(join(options.dir, 'traffic.har')); throw new Error('Dữ liệu thu thập đã tồn tại; hãy dùng tên dự án mới để giữ lại phiên trước.'); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  await mkdir(options.dir, { recursive: true });
  const browser = options.cdp
    ? await chromium.connectOverCDP(options.cdp, { timeout: 30000, noDefaults: true }).catch(error => { throw new Error('Không kết nối được trình duyệt đang mở. Bật cho phép gỡ lỗi từ xa tại chrome://inspect/#remote-debugging (Edge: edge://inspect/#remote-debugging), chấp nhận hộp thoại kết nối; hoặc dùng tiện ích trong thư mục extension. Chi tiết: ' + error.message); })
    : await chromium.launch({ headless: !(options.headed || options.interactive), channel: options.channel });
  try {
    const context = options.cdp ? browser.contexts()[0] : await browser.newContext({ storageState: options.storageState, recordHar: { path: join(options.dir, 'traffic.har'), mode: 'full', content: 'embed' } });
    if (!context) throw new Error('Không tìm thấy phiên trình duyệt có thể kết nối.');
    let finishRecording: ((path: string) => Promise<void>) | undefined;
    try {
      const existingPage = options.cdp ? context.pages().find(page => page.url() === target.href) : undefined;
      const page = existingPage ?? await context.newPage();
      if (options.cdp) finishRecording = recordPage(page);
      page.setDefaultTimeout(15000);
      const runtimeErrors: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      if (existingPage) console.error('Đã kết nối tab hiện có. Hãy tải lại trang hoặc thao tác để ghi các yêu cầu API mới; dữ liệu trước lúc kết nối không được ghi.');
      else await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (options.actions) {
        for (const action of actionsSchema.parse(await readJson(options.actions))) {
          if (action.type === 'click') await humanClick(page, action.selector);
          else if (action.type === 'fill') await humanType(page, action.selector, action.value);
          else await page.waitForTimeout(action.milliseconds);
        }
      }
      if (options.interactive) {
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        try { await rl.question('Hoàn thành đăng nhập / duyệt website trong trình duyệt, sau đó nhấn Enter tại đây để lưu. '); } finally { rl.close(); }
      } else await page.waitForTimeout(options.duration ?? 3000);
      await writeJson(join(options.dir, 'auth.json'), await detectAuth(page));
      const state = await context.storageState();
      // Do not export unrelated accounts from a user's shared browser.
      if (options.cdp) {
        state.origins = state.origins.filter(item => item.origin === target.origin);
        state.cookies = state.cookies.filter(cookie => { const domain = cookie.domain.replace(/^\./, ''); return cookie.domain.startsWith('.') ? target.hostname === domain || target.hostname.endsWith('.' + domain) : target.hostname === domain; });
      }
      await writeJson(join(options.dir, 'auth-state.json'), state);
      await writeJson(join(options.dir, 'session.json'), { targetOrigin: target.origin, capturedAt: new Date().toISOString(), runtimeErrors, mode: options.cdp ? 'cdp' : 'new-browser' });
      await writeFile(join(options.dir, 'dom.html'), await page.content(), { mode: 0o600 });
      await page.screenshot({ path: join(options.dir, 'page.png'), fullPage: true });
    } finally {
      if (finishRecording) await finishRecording(join(options.dir, 'traffic.har'));
      if (!options.cdp) await context.close();
    }
    // For connectOverCDP, close disconnects this client; it does not close the user's browser.
  } finally { await browser.close(); }
}

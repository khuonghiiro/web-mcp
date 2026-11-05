import { chromium, type Browser, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { httpUrl, projectPath, writeJson, readJson, harSchema, type Entry } from '../core.js';
import { recordPage } from '../scout/recorder.js';
import { detectAuth } from '../scout/detector.js';
import { filterHar } from '../analyzer/harFilter.js';
import { makeSpec } from '../analyzer/specGenerator.js';
import { generate } from '../generator/builder.js';
import { applyStep, inspectPage, extractPage, type Step, type Workflow } from '../generator/browser-runtime.js';
import { ExtensionBridge } from '../generator/extension-bridge.js';
import { storeCapture } from '../scout/importCapture.js';

export class StudioSession {
  bridge = new ExtensionBridge();
  extensionMode = false;
  active = false;
  entries: Entry[] = [];
  runtimeErrors: string[] = [];
  browser?: Browser;
  page?: Page;
  dir = '';
  name = '';
  target = '';
  finishRecording?: (path: string) => Promise<void>;
  network: { method: string; origin: string; path: string; status: number }[] = [];
  workflows: Workflow[] = [];
  draft?: { startUrl: string; steps: Step[] };
  constructor(readonly root: string) {}
  current(): Page {
    if (!this.page || this.page.isClosed()) throw new Error('Chưa có tab hoạt động. Gọi studio_start trước.');
    return this.page;
  }
  async start(name: string, url: string, endpoint: string) {
    if (this.active) throw new Error('Đã có phiên. Gọi studio_finish hoặc studio_close trước.');
    const target = httpUrl(url);
    if (endpoint === 'extension' && !this.bridge.connected) {
      await this.bridge.start(true);
      const deadline = Date.now() + 35000;
      while (!this.bridge.connected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (endpoint === 'extension' && (!this.bridge.connected || new URL(this.bridge.tabUrl).origin !== target.origin)) throw new Error('Hãy ghép nối tiện ích trên đúng website qua studio_extension_pair trước.');
    this.dir = projectPath(join(this.root, 'artifacts'), name);
    await mkdir(join(this.root, 'artifacts'), { recursive: true });
    await mkdir(this.dir);
    try {
      this.name = name; this.target = target.href; this.workflows = []; this.draft = undefined; this.network = [];
      this.active = true;
      this.entries = []; this.runtimeErrors = [];
      this.extensionMode = endpoint === 'extension';
      if (this.extensionMode) return await this.inspect();
      this.browser = await chromium.connectOverCDP(endpoint, { noDefaults: true, timeout: 30000 });
      const context = this.browser.contexts()[0];
      if (!context) throw new Error('Không tìm thấy phiên trình duyệt.');
      this.name = name; this.target = target.href; this.workflows = []; this.draft = undefined; this.network = [];
      this.page = context.pages().find(page => page.url() === target.href) ?? await context.newPage();
      this.page.setDefaultTimeout(15000);
      this.finishRecording = recordPage(this.page, entry => this.entries.push(entry));
      this.page.on('pageerror', error => { if (this.runtimeErrors.length < 100) this.runtimeErrors.push(error.message); });
      this.page.on('response', response => {
        if (this.network.length >= 2000) return;
        try { const url = new URL(response.url()); this.network.push({ method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() }); } catch { /* Non-HTTP response. */ }
      });
      if (this.page.url() !== target.href) await this.page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await inspectPage(this.page);
    } catch (error) { await this.close(); throw error; }
  }
  async inspect() { if (!this.active) throw new Error('Gọi studio_start trước.'); return this.extensionMode ? this.bridge.rpc('inspect') : inspectPage(this.current()); }
  async extract(selector: string) { if (!this.active) throw new Error('Gọi studio_start trước.'); return this.extensionMode ? this.bridge.rpc('extract', { selector }) : extractPage(this.current(), selector); }
  async listNetwork() { return this.extensionMode ? this.bridge.rpc('network') : this.network; }
  async apiPreview(origin?: string) {
    if (!this.active) throw new Error('Gọi studio_start trước.');
    const har = this.extensionMode ? await this.bridge.rpc('har') : { log: { entries: this.entries } };
    const targetOrigin = origin ? httpUrl(origin).origin : new URL(this.target).origin;
    return makeSpec(filterHar(har, targetOrigin), targetOrigin, this.name);
  }
  async runtime() {
    if (this.extensionMode) return this.bridge.rpc('runtime');
    return { ...await this.current().evaluate(() => ({ url: location.href, readyState: document.readyState, scripts: [...document.scripts].map(script => ({ src: script.src || null, type: script.type || 'classic', inlineLength: script.src ? 0 : (script.textContent?.length ?? 0) })).slice(0, 100), resources: performance.getEntriesByType('resource').slice(-100).map(entry => ({ name: entry.name, initiatorType: (entry as PerformanceResourceTiming).initiatorType, duration: Math.round(entry.duration) })) })), errors: this.runtimeErrors };
  }
  async beginWorkflow() {
    const snapshot = await this.inspect();
    if (this.draft) throw new Error('Đang ghi một quy trình. Lưu hoặc hủy quy trình trước.');
    httpUrl(snapshot.url);
    this.draft = { startUrl: snapshot.url, steps: [] };
    return { started: true, startUrl: snapshot.url, note: 'Các bước thành công sẽ được ghi. Giá trị nhập không lưu vào workflow; chúng trở thành tham số khi dùng lại.' };
  }
  async step(step: Step, value?: string) {
    if (!this.active) throw new Error('Gọi studio_start trước.');
    if (this.draft && this.draft.steps.length >= 100) throw new Error('Tối đa 100 bước mỗi quy trình.');
    if (this.extensionMode) {
      const result = await this.bridge.rpc('step', { step, value });
      if (this.draft) this.draft.steps.push(step);
      return result;
    }
    await applyStep(this.current(), step, step.type === 'fill' ? { [step.parameter]: value ?? '' } : {});
    if (this.draft) this.draft.steps.push(step);
    await this.current().waitForTimeout(350);
    return inspectPage(this.current());
  }
  async saveWorkflow(name: string, description: string, resultSelector: string) {
    if (!this.draft) throw new Error('Gọi studio_workflow_begin trước.');
    if (this.workflows.some(workflow => workflow.name === name)) throw new Error('Tên quy trình đã tồn tại.');
    const result = await this.extract(resultSelector);
    if (!result.length) throw new Error('Selector kết quả không tìm thấy phần tử.');
    this.workflows.push({ name, description, resultSelector, ...this.draft });
    this.draft = undefined;
    await writeJson(join(this.dir, 'workflows.json'), this.workflows);
    return { saved: name, preview: result };
  }
  async finish(apiOrigin?: string) {
    if (!this.active) throw new Error('Gọi studio_start trước.');
    if (this.draft) throw new Error('Hãy lưu hoặc hủy quy trình đang ghi trước khi kết thúc.');
    const origin = apiOrigin ? httpUrl(apiOrigin).origin : new URL(this.target).origin;
    if (this.extensionMode) {
      await storeCapture(await this.bridge.rpc('capture'), this.dir);
    } else {
    const page = this.current();
    await writeJson(join(this.dir, 'auth.json'), await detectAuth(page));
    const target = new URL(this.target);
    const state = await page.context().storageState();
    state.origins = state.origins.filter(item => item.origin === target.origin);
    state.cookies = state.cookies.filter(cookie => { const domain = cookie.domain.replace(/^\./, ''); return cookie.domain.startsWith('.') ? target.hostname === domain || target.hostname.endsWith('.' + domain) : target.hostname === domain; });
    await writeJson(join(this.dir, 'auth-state.json'), state);
    await writeJson(join(this.dir, 'session.json'), { targetOrigin: target.origin, mode: 'ai-studio', capturedAt: new Date().toISOString() });
    await writeFile(join(this.dir, 'dom.html'), await page.content(), { mode: 0o600 });
    await this.finishRecording?.(join(this.dir, 'traffic.har'));
    this.finishRecording = undefined;
    }
    const har = filterHar(harSchema.parse(await readJson(join(this.dir, 'traffic.har'))), origin);
    const spec = makeSpec(har, origin, this.name);
    if (!Object.keys(spec.paths).length && !this.workflows.length) {
      if (this.extensionMode) await this.close();
      else this.finishRecording = recordPage(this.current(), entry => this.entries.push(entry));
      throw new Error('Chưa khám phá API hoặc lưu quy trình. Dữ liệu đã lưu; hãy khám phá thêm (ghép nối lại nếu dùng tiện ích).');
    }
    await writeJson(join(this.dir, 'api-spec.json'), spec);
    await writeJson(join(this.dir, 'workflows.json'), this.workflows);
    const output = await generate(this.dir, this.name, join(this.root, 'generated-mcps'));
    await this.close();
    return { output, apiPaths: Object.keys(spec.paths).length, workflows: this.workflows.map(w => w.name), next: 'Trong thư mục output: npm install && npm run build. Nạp client-config.json vào AI client. Dùng MCP_BROWSER_CDP để chọn trình duyệt cho workflow.' };
  }
  async close() {
    try { if (this.finishRecording) await this.finishRecording(join(this.dir, 'traffic.har')); }
    finally { this.finishRecording = undefined; await this.browser?.close(); this.browser = undefined; this.page = undefined; this.active = false; await this.bridge.close(); }
    return { closed: true, message: 'Đã ngắt kết nối Studio; trình duyệt của bạn vẫn mở.' };
  }
}

import { chromium, type Browser, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { httpUrl, writeJson, readJson, harSchema, type Entry } from '../core.js';
import { recordPage } from '../scout/recorder.js';
import { detectAuth } from '../scout/detector.js';
import { filterHar } from '../analyzer/harFilter.js';
import { makeSpec } from '../analyzer/specGenerator.js';
import { generate } from '../generator/builder.js';
import { applyStep, inspectPage, extractPage, type Step, type Workflow } from '../generator/browser-runtime.js';
import { ExtensionBridge } from '../generator/extension-bridge.js';
import { storeCapture } from '../scout/importCapture.js';
import { artifactPath } from '../storage/artifacts.js';
import { siteGuide, syncSiteKnowledge } from '../knowledge/sites.js';

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
  captureSaved = false;
  target = '';
  finishRecording?: (path: string) => Promise<void>;
  network: { method: string; origin: string; path: string; status: number; rpcId?: string }[] = [];
  workflows: Workflow[] = [];
  actionTrace: { startedAt: string; completedAt?: string; step: Step; beforeUrl: string; afterUrl?: string; beforeSnapshot?: string; afterSnapshot?: string; outcome: string; requests?: unknown[] }[] = [];
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
    this.dir = artifactPath(join(this.root, 'artifacts'), url, name);
    await mkdir(join(this.dir, '..'), { recursive: true });
    await mkdir(this.dir);
    await writeJson(join(this.dir, 'session.json'), { targetOrigin: target.origin, capturedAt: new Date().toISOString(), mode: endpoint === 'extension' ? 'extension' : 'cdp' });
    try {
      this.name = name; this.target = target.href; this.workflows = []; this.draft = undefined; this.network = [];
      this.active = true;
      this.captureSaved = false;
      this.actionTrace = [];
      this.entries = []; this.runtimeErrors = [];
      this.extensionMode = endpoint === 'extension';
      if (this.extensionMode) return { ...await this.inspect(), site: await siteGuide(this.root, url), artifacts: this.dir };
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
        try { const url = new URL(response.url()), rpc = url.searchParams.get('rpcids'); this.network.push({ method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status(), ...(rpc && /^[a-zA-Z0-9]{1,16}$/.test(rpc) ? { rpcId: rpc } : {}) }); } catch { /* Non-HTTP response. */ }
      });
      if (this.page.url() !== target.href) await this.page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { ...await inspectPage(this.page), site: await siteGuide(this.root, url), artifacts: this.dir };
    } catch (error) { await this.close(); throw error; }
  }
  async inspect() { if (!this.active) throw new Error('Gọi studio_start trước.'); return this.extensionMode ? this.bridge.rpc('inspect') : inspectPage(this.current()); }
  async extract(selector: string) { if (!this.active) throw new Error('Gọi studio_start trước.'); return this.extensionMode ? this.bridge.rpc('extract', { selector }) : extractPage(this.current(), selector); }
  async listNetwork() {
    if (!this.extensionMode) return this.network;
    const har = harSchema.parse(await this.bridge.rpc('har'));
    return har.log.entries.map(e => { const url = new URL(e.request.url), rpc = url.searchParams.get('rpcids'); return { method: e.request.method, origin: url.origin, path: url.pathname, status: e.response.status, ...(rpc && /^[a-zA-Z0-9]{1,16}$/.test(rpc) ? { rpcId: rpc } : {}) }; });
  }
  async readRpcResult(rpcId: string) {
    if (!this.active) throw new Error('Gọi studio_start trước.');
    const har = harSchema.parse(this.extensionMode ? await this.bridge.rpc('har') : { log: { entries: this.entries } });
    const matches = har.log.entries.filter(e => {
      try { return new URL(e.request.url).searchParams.get('rpcids') === rpcId || e.request.url.includes(rpcId); }
      catch { return false; }
    });
    const latest = matches[matches.length - 1];
    if (!latest) return { found: false, rpcId };
    let request: Record<string, unknown> = { method: latest.request.method };
    try {
      const fReq = new URLSearchParams(latest.request.postData?.text ?? '').get('f.req');
      if (fReq) {
        const outerReq = JSON.parse(fReq);
        const args = JSON.parse(outerReq?.[0]?.[0]?.[1] ?? 'null');
        if (rpcId === 'ogiZ0b' && Array.isArray(args?.[1])) {
          const first = args[1][0];
          const refIds = Array.isArray(first?.[2]) ? first[2].map((r: any) => r?.[0]).filter(Boolean) : [];
          request = {
            count: args[1].length,
            modelCode: first?.[5] ?? null,
            aspectRatioCode: first?.[4] ?? null,
            referenceImageIds: refIds,
            prompt: first?.[8]?.[0]?.[0]?.[0] ?? null,
            projectId: first?.[7]?.[5] ?? null,
            hasRecaptchaToken: Boolean(first?.[7]?.[10]?.[0])
          };
        } else if (rpcId === 'jHPbke') {
          request = { title: args?.[1]?.[1]?.[0] ?? null };
        } else if (rpcId === 'o8DA4') {
          request = { projectId: String(args?.[0] ?? '').replace(/^projects\//, '') || null, title: args?.[1]?.[0] ?? null };
        } else if (rpcId === 'UpteDb') {
          request = { limit: args?.[1] ?? null };
        } else if (rpcId === 'ngNC2' || rpcId === 'Zzl0ze') {
          request = { projectId: String(args?.[0] ?? '').replace(/^(tools\/PINHOLE\/)?projects\//, '') || null };
        } else if (rpcId === 'as29s') {
          request = { assetId: args?.[0] ?? null };
        } else if (rpcId === 'mYWVGd') {
          request = {
            workflowId: args?.[0]?.[0] ?? null,
            projectId: args?.[0]?.[4] ?? null,
            displayName: args?.[0]?.[3]?.[0] ?? null,
            archived: args?.[0]?.[3]?.[2] ?? null,
            favorited: args?.[0]?.[3]?.[3] ?? null,
            updateMask: args?.[1]?.[0] ?? []
          };
        }
      }
    } catch { /* ignore malformed request body */ }
    const status = latest.response.status;
    const text = latest.response.content?.text ?? '';
    if (!status || !text) return { found: true, completed: false, rpcId, status, request };
    for (const line of text.replace(/^\)\]\}'\s*/, '').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('[[')) continue;
      try {
        const outer = JSON.parse(trimmed);
        for (const item of outer) {
          if (!Array.isArray(item) || item[0] !== 'wrb.fr' || item[1] !== rpcId) continue;
          if (item[2] == null && Array.isArray(item[5])) {
            return { found: true, completed: true, ok: false, rpcId, status, request, response: { errorCode: item[5][0], errorMessage: item[5][1] ?? null } };
          }
          const data = typeof item[2] === 'string' ? JSON.parse(item[2]) : item[2];
          if (rpcId === 'ogiZ0b' && Array.isArray(data?.[0])) {
            return {
              found: true, completed: true, ok: true, rpcId, status, request,
              response: {
                count: data[0].length,
                items: data[0].map((entry: any) => ({
                  id: entry?.[0] ?? null,
                  workflowId: entry?.[2] ?? null,
                  seed: entry?.[6]?.[0]?.[1] ?? null,
                  aspectRatioCode: entry?.[6]?.[0]?.[14] ?? null,
                  url: entry?.[6]?.[0]?.[13] ?? null
                }))
              }
            };
          }
          if (rpcId === 'as29s' && Array.isArray(data)) {
            return {
              found: true, completed: true, ok: true, rpcId, status, request,
              response: {
                assetId: data[0] ?? null,
                projectId: data[1] ?? null,
                workflowId: data[2] ?? null,
                dimensions: data[6]?.[2] ?? null,
                url: data[5]?.[10] ?? data[6]?.[0]?.[13] ?? null
              }
            };
          }
          if (rpcId === 'mYWVGd' && Array.isArray(data)) {
            return {
              found: true, completed: true, ok: true, rpcId, status, request,
              response: {
                workflowId: data[0] ?? null,
                assetId: data[3]?.[4] ?? null,
                displayName: data[3]?.[0] ?? null
              }
            };
          }
          if (rpcId === 'jHPbke' && Array.isArray(data)) {
            return { found: true, completed: true, ok: true, rpcId, status, request, response: { projectId: data[0] ?? null, title: data[1]?.[0] ?? null } };
          }
          if (rpcId === 'o8DA4' && Array.isArray(data)) {
            return { found: true, completed: true, ok: true, rpcId, status, request, response: { title: data[0] ?? null } };
          }
          if (rpcId === 'UpteDb' && Array.isArray(data?.[0])) {
            return {
              found: true, completed: true, ok: true, rpcId, status, request,
              response: { count: data[0].length, projects: data[0].map((p: any) => ({ id: p?.[0] ?? null, title: p?.[1]?.[0] ?? null })) }
            };
          }
          return { found: true, completed: true, ok: true, rpcId, status, request };
        }
      } catch { /* ignore non-JSON frame lines */ }
    }
    return { found: true, completed: true, ok: status >= 200 && status < 300, rpcId, status, request };
  }
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
    const before = await this.inspect();
    const network = await this.listNetwork();
    const trace: StudioSession['actionTrace'][number] = { startedAt: new Date().toISOString(), step, beforeUrl: before.url, outcome: 'started' };
    this.actionTrace.push(trace);
    const actionId = String(this.actionTrace.length).padStart(4, '0');
    trace.beforeSnapshot = `actions/${actionId}-before.json`;
    await writeJson(join(this.dir, trace.beforeSnapshot), before);
    await writeJson(join(this.dir, 'action-trace.json'), { note: 'Temporal correlation only; background and delayed requests may fall outside action windows. Input values are omitted. A started/unknown write must be checked on the UI before retry.', actions: this.actionTrace });
    try {
      const result = await this.performStep(step, value);
      trace.afterSnapshot = `actions/${actionId}-after.json`;
      await writeJson(join(this.dir, trace.afterSnapshot), result);
      trace.afterUrl = result.url; trace.completedAt = new Date().toISOString(); trace.outcome = 'completed';
      trace.requests = (await this.listNetwork()).slice(network.length);
      return result;
    } catch (error) { trace.outcome = 'unknown-check-ui-before-retry'; trace.completedAt = new Date().toISOString(); throw error; }
    finally { await writeJson(join(this.dir, 'action-trace.json'), { note: 'Temporal correlation, not proof of causality. Check delayed responses and final UI before claiming success. No input values stored.', actions: this.actionTrace }); }
  }
  private async performStep(step: Step, value?: string) {
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
      this.captureSaved = true;
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
    const closed = await this.close();
    return { output, site: closed.site, artifacts: this.dir, apiPaths: Object.keys(spec.paths).length, workflows: this.workflows.map(w => w.name), next: 'Trong thư mục output: npm install && npm run build. Nạp client-config.json vào AI client. Dùng MCP_BROWSER_CDP để chọn trình duyệt cho workflow.' };
  }
  async close() {
    let site;
    try {
      if (this.active && this.dir && this.extensionMode && !this.captureSaved && this.bridge.connected) {
        await storeCapture(await this.bridge.rpc('capture'), this.dir);
        this.captureSaved = true;
      }
      if (this.finishRecording) await this.finishRecording(join(this.dir, 'traffic.har'));
      if (this.active && this.dir && this.target) site = await syncSiteKnowledge(this.root, this.dir, this.target);
    }
    finally { this.finishRecording = undefined; await this.browser?.close(); this.browser = undefined; this.page = undefined; this.active = false; await this.bridge.close(); }
    return { closed: true, site, artifacts: this.dir, message: 'Đã lưu dữ liệu và skill/rule website, ngắt kết nối Studio; trình duyệt vẫn mở.' };
  }
}

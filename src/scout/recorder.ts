import type { Page, Request } from 'playwright';
import { writeJson, type Entry } from '../core.js';

/** An existing browser context cannot be retrofitted with recordHar. */
export function recordPage(page: Page) {
  const entries: Entry[] = [];
  const pending = new Set<Promise<void>>();
  const warnings: string[] = [];
  let count = 0;
  let totalBytes = 0;
  const record = async (request: Request) => {
    if (!/^https?:/.test(request.url()) || count++ >= 2000) return;
    const response = await request.response();
    if (!response) return;
    const mimeType = response.headers()['content-type'] ?? '';
    let text: string | undefined;
    if (/json|text|javascript|xml/i.test(mimeType) && totalBytes < 20_000_000) {
      const length = Number(response.headers()['content-length']);
      if (!length || length <= 2_000_000) {
        try { const body = await response.body(); if (body.length <= 2_000_000) { text = body.toString('utf8'); totalBytes += body.length; } }
        catch { warnings.push('Không đọc được một response body (có thể do chuyển trang hoặc redirect).'); }
      }
    }
    entries.push({
      startedDateTime: new Date().toISOString(), time: 0,
      request: { url: request.url(), method: request.method(), headers: await request.headersArray(), queryString: [...new URL(request.url()).searchParams].map(([name, value]) => ({ name, value })), ...(request.postData() !== null ? { postData: { mimeType: request.headers()['content-type'] ?? 'text/plain', text: request.postData()! } } : {}) },
      response: { status: response.status(), headers: await response.headersArray(), content: { mimeType, ...(text === undefined ? {} : { text }) } }
    });
  };
  const listener = (request: Request) => {
    const task = record(request).catch(() => { warnings.push('Một yêu cầu không được ghi đầy đủ.'); }).finally(() => pending.delete(task));
    pending.add(task);
  };
  page.on('requestfinished', listener);
  return async (path: string) => {
    page.off('requestfinished', listener);
    await Promise.all(pending);
    await writeJson(path, { log: { version: '1.2', creator: { name: 'Web-to-MCP CDP recorder', version: '0.1.0' }, entries, _warnings: [...new Set(warnings)], _limits: '2000 requests; 2 MB per response; 20 MB total response text. In-flight requests at stop are excluded.' } });
  };
}

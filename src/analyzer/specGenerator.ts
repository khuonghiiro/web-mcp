import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { httpUrl, readJson, writeJson, type Har, type Schema, type Spec } from '../core.js';
import { filterHar } from './harFilter.js';

export function inferSchema(value: unknown): Schema {
  if (value === null) return {};
  if (Array.isArray(value)) return { type: 'array', items: value.length ? inferSchema(value[0]) : {} };
  if (typeof value === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, inferSchema(item)])) };
  return { type: typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value };
}
export function makeSpec(har: Har, origin: string, name: string): Spec {
  const spec: Spec = { openapi: '3.0.3', info: { title: name, version: '0.1.0' }, servers: [{ url: origin }], paths: {} };
  for (const entry of har.log.entries) {
    const url = new URL(entry.request.url);
    const method = entry.request.method.toLowerCase();
    if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;
    const paths = spec.paths[url.pathname] ??= {};
    const op = paths[method] ??= {
      operationId: method + '_' + url.pathname.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 42) + '_' + createHash('sha256').update(method + url.pathname).digest('hex').slice(0, 8),
      summary: method.toUpperCase() + ' ' + url.pathname,
      parameters: [], responses: {}, 'x-auth-headers': []
    };
    for (const key of new Set(url.searchParams.keys())) if (!op.parameters.some(p => p.name === key)) op.parameters.push({ name: key, in: 'query', required: false, schema: { type: 'string' } });
    for (const header of entry.request.headers) if (/^(authorization|cookie|x-csrf-token|x-xsrf-token|x-api-key)$/i.test(header.name) && !op['x-auth-headers'].includes(header.name.toLowerCase())) op['x-auth-headers'].push(header.name.toLowerCase());
    const body = entry.request.postData;
    if (body && /json/i.test(body.mimeType) && body.text) {
      try { op.requestBody = { required: true, content: { 'application/json': { schema: inferSchema(JSON.parse(body.text)) } } }; }
      catch { op.requestBody = { required: true, content: { [body.mimeType]: { schema: { type: 'string' } } } }; }
    } else if (body) op.requestBody = { required: true, content: { [body.mimeType]: { schema: { type: 'string' } } } };
    op.responses[String(entry.response.status)] = { description: 'Observed HTTP ' + entry.response.status };
  }
  return spec;
}
export async function analyze(dir: string, name: string, explicitOrigin?: string) {
  const origin = explicitOrigin ? httpUrl(explicitOrigin).origin : z.object({ targetOrigin: z.string().url() }).parse(await readJson(join(dir, 'session.json'))).targetOrigin;
  const filtered = filterHar(await readJson(join(dir, 'traffic.har')), origin);
  const spec = makeSpec(filtered, origin, name);
  if (!Object.keys(spec.paths).length) throw new Error('Chưa tìm thấy yêu cầu API. Hãy thao tác thêm trên website hoặc nhập địa chỉ máy chủ API riêng bằng --origin.');
  await writeJson(join(dir, 'api-spec.json'), spec);
  await writeJson(join(dir, 'analysis.json'), { origin, keptRequests: filtered.log.entries.length, operations: Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0), note: 'Schemas inferred from observations; required fields and endpoint semantics need review.' });
  return spec;
}

import { readdir } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { harSchema, readJson } from '../core.js';
import { exists, siteDomain } from '../storage/artifacts.js';

const identifier = /^[a-zA-Z_$][a-zA-Z0-9_.$-]{0,80}$/;
const sensitive = /^(authorization|cookie|set-cookie|.*token.*|.*secret.*|.*password.*|.*session.*|api[-_]?key|at|f\.sid)$/i;
const nonBusinessPath = /(?:\.(?:js|css|png|svg|jpg|jpeg|gif|webp|ico|woff2?|ttf|map)$|\/(?:cspreport|jserror|manifest\.json|favicon\.ico)(?:$|\?)|^\/cdn-cgi\/challenge-platform\/|^\/cdn\/assets\/|^\/asb\/|^\/ces\/v1\/)/i;
const telemetryRpc = /^(WuwhI|LPzVkd|NfrxTb|KV2T2d|DA4VGb|qJcgMc|tRARke|ve2Lsc|DTaVef|nzlxg|o30O0e|mrlkwd)$/;
export const safePath = (path: string) => path.split('/').map(p => /[a-f0-9]{24,}/i.test(p.replace(/-/g, '')) || p.length > 48 || /@|%40/i.test(p) ? '{id}' : p).join('/');
export type Shape = { type: string; properties?: Record<string, Shape>; tuple?: Shape[]; decodedJson?: Shape; truncated?: boolean };
// Schema only: no defaults, examples, enums or captured scalar values.
export function shape(value: unknown, depth = 0): Shape {
  if (depth > 12) return { type: 'unknown', truncated: true };
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array', tuple: value.slice(0, 32).map(v => shape(v, depth + 1)), ...(value.length > 32 ? { truncated: true } : {}) };
  if (typeof value === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).map(([k, v]) => [identifier.test(k) && !/[a-f0-9]{24}/i.test(k) ? k : '{dynamic-key}', sensitive.test(k) ? { type: 'local-credential' } : shape(v, depth + 1)])) };
  return { type: typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value };
}
function rpcShape(text: string): Shape {
  try {
    const envelope = JSON.parse(text), schema = shape(envelope);
    if (Array.isArray(envelope)) envelope.slice(0, 32).forEach((group, gi) => {
      if (Array.isArray(group)) group.slice(0, 32).forEach((call, ci) => {
        const payload = schema.tuple?.[gi].tuple?.[ci].tuple?.[1];
        if (payload && Array.isArray(call) && /^[a-zA-Z0-9]{1,16}$/.test(call[0]) && typeof call[1] === 'string') {
          try { payload.decodedJson = shape(JSON.parse(call[1])); } catch { /* Unknown RPC encoding. */ }
        }
      });
    });
    return { type: 'string', decodedJson: schema };
  } catch { return { type: 'string' }; }
}
export type Parameter = { name: string; location: string; type: string; localOnly: boolean; required: 'unknown' };
export type Endpoint = { id: string; origin: string; method: string; path: string; rpcId?: string; parameterGroup?: string; parameters: Parameter[]; body?: { mimeType: string; schema: Shape }; statuses: number[]; verification: 'observed-only' };
export type BrowserFlow = { name: string; startPath: string; parameters: string[]; steps: { type: string; parameter?: string }[]; verification: 'recorded-not-replayed' };
export type Observation = { session: string; evidence: string; endpoints: Endpoint[]; workflows: BrowserFlow[] };
export type CompactObservation = { session: string; evidence: string; endpointIds: string[]; workflowNames: string[] };

export function compactEndpoints(endpoints: Endpoint[]) {
  const counts = new Map<string, { id: string; params: Parameter[]; count: number }>();
  for (const e of endpoints) {
    if (e.parameters.length < 2) continue;
    const key = JSON.stringify(e.parameters);
    const id = 'params-' + createHash('sha256').update(key).digest('hex').slice(0, 8);
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { id, params: e.parameters, count: 1 });
  }
  const parameterGroups: Record<string, Parameter[]> = {};
  const keyToGroup = new Map<string, string>();
  for (const [key, group] of counts) {
    if (group.count > 1) {
      parameterGroups[group.id] = group.params;
      keyToGroup.set(key, group.id);
    }
  }
  const compacted = endpoints.map(e => {
    const group = keyToGroup.get(JSON.stringify(e.parameters));
    return group ? { ...e, parameterGroup: group, parameters: [] } : e;
  });
  return { parameterGroups, endpoints: compacted };
}

export async function observe(root: string, dir: string, domain: string): Promise<Observation> {
  const evidence = relative(resolve(root), resolve(dir)).replace(/\\/g, '/');
  if (isAbsolute(evidence) || evidence.startsWith('../')) throw new Error('Capture must reside inside workspace.');
  let input: unknown;
  if (await exists(join(dir, 'traffic.har'))) input = await readJson(join(dir, 'traffic.har'));
  else for (const file of await readdir(dir)) if (file.endsWith('.web-mcp.json')) { input = (await readJson(join(dir, file)) as { har?: unknown }).har; if (input) break; }
  const paths = new Map<string, Endpoint>();
  // API origin explicitly selected during analysis may differ from the UI host.
  const origins = new Set<string>();
  if (await exists(join(dir, 'analysis.json'))) {
    const origin = (await readJson(join(dir, 'analysis.json')) as { origin?: string }).origin;
    if (origin && /^https?:\/\//.test(origin)) origins.add(new URL(origin).origin);
  }
  if (input) for (const e of harSchema.parse(input).log.entries) {
    const url = new URL(e.request.url);
    if ((siteDomain(url.href) !== domain && !origins.has(url.origin)) || !/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(e.request.method) || nonBusinessPath.test(url.pathname)) continue;
    if (e.request.method === 'GET' && url.pathname === '/') continue;
    const rpc = url.searchParams.get('rpcids');
    const rpcId = rpc && /^[a-zA-Z0-9]{1,16}$/.test(rpc) ? rpc : undefined;
    if (rpcId && telemetryRpc.test(rpcId)) continue;
    const path = safePath(url.pathname), key = [url.origin, e.request.method, path, rpcId].join('|');
    const op: Endpoint = paths.get(key) ?? { id: createHash('sha256').update(key).digest('hex').slice(0, 12), origin: url.origin, method: e.request.method, path, ...(rpcId ? { rpcId } : {}), parameters: [], statuses: [], verification: 'observed-only' };
    const parameter = (name: string, location: string) => { if (identifier.test(name) && !op.parameters.some(p => p.name === name && p.location === location)) op.parameters.push({ name, location, type: 'string', localOnly: sensitive.test(name), required: 'unknown' }); };
    for (const name of url.searchParams.keys()) parameter(name, 'query');
    for (const h of e.request.headers) if (sensitive.test(h.name) || /^x-(csrf|xsrf)/i.test(h.name)) parameter(h.name, 'header');
    const body = e.request.postData;
    if (body) {
      let schema: Shape = { type: 'string' };
      if (/json/i.test(body.mimeType) && body.text) { try { schema = shape(JSON.parse(body.text)); } catch { /* Unknown body format. */ } }
      else if (/x-www-form-urlencoded/i.test(body.mimeType) && body.text) {
        const properties: Record<string, Shape> = {};
        for (const [name, value] of new URLSearchParams(body.text)) if (identifier.test(name)) { parameter(name, 'form'); properties[name] = sensitive.test(name) ? { type: 'local-credential' } : name === 'f.req' ? rpcShape(value) : shape(value); }
        schema = { type: 'object', properties };
      }
      op.body = { mimeType: body.mimeType.split(';')[0], schema };
    }
    op.statuses = [...new Set([...op.statuses, e.response.status])].sort(); paths.set(key, op);
  }
  const workflows: BrowserFlow[] = [];
  if (await exists(join(dir, 'workflows.json'))) {
    const data = await readJson(join(dir, 'workflows.json'));
    if (!Array.isArray(data)) throw new Error('workflows.json must be an array.');
    for (const flow of data) {
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(flow.name) || !Array.isArray(flow.steps)) continue;
      const steps = flow.steps.filter((s: any) => ['fill', 'click', 'wait', 'scroll'].includes(s.type)).map((s: any) => ({ type: s.type, ...(identifier.test(s.parameter) ? { parameter: s.parameter } : {}) }));
      workflows.push({ name: flow.name, startPath: safePath(new URL(flow.startUrl).pathname), parameters: [...new Set<string>(steps.flatMap((s: any) => s.parameter ? [s.parameter] : []))], steps, verification: 'recorded-not-replayed' });
    }
  }
  return { session: basename(dir), evidence, endpoints: [...paths.values()], workflows };
}

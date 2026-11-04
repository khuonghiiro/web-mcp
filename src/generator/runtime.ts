import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, type ZodTypeAny } from 'zod';

// This self-contained file is copied into each generated project.
type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema; required?: string[] };
type Operation = { operationId: string; summary: string; parameters: { name: string; required: boolean; schema: Schema }[]; requestBody?: { required: boolean; content: Record<string, { schema: Schema }> } };
type Spec = { info: { title: string; version: string }; servers: { url: string }[]; paths: Record<string, Record<string, Operation>> };
function validator(schema: Schema): ZodTypeAny {
  if (schema.type === 'string') return z.string();
  if (schema.type === 'integer') return z.number().int();
  if (schema.type === 'number') return z.number();
  if (schema.type === 'boolean') return z.boolean();
  if (schema.type === 'array') return z.array(validator(schema.items ?? {}));
  if (schema.type === 'object') return z.object(Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, schema.required?.includes(key) ? validator(value) : validator(value).optional()]))).passthrough();
  return z.unknown();
}
async function authHeaders(url: URL): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (process.env.MCP_AUTH_HEADERS_FILE) {
    const config = z.record(z.string(), z.record(z.string(), z.string())).parse(JSON.parse(await readFile(process.env.MCP_AUTH_HEADERS_FILE, 'utf8')));
    Object.assign(headers, config[url.origin] ?? {});
  }
  if (process.env.MCP_AUTH_STATE) {
    const cookie = z.object({ name: z.string(), value: z.string(), domain: z.string(), path: z.string(), expires: z.number(), secure: z.boolean() });
    const state = z.object({ cookies: z.array(cookie) }).parse(JSON.parse(await readFile(process.env.MCP_AUTH_STATE, 'utf8')));
    const cookies = state.cookies.filter(c => {
      const domain = c.domain.replace(/^\./, '');
      const domainMatch = c.domain.startsWith('.') ? url.hostname === domain || url.hostname.endsWith('.' + domain) : url.hostname === domain;
      const pathMatch = url.pathname === c.path || (url.pathname.startsWith(c.path) && (c.path.endsWith('/') || url.pathname[c.path.length] === '/'));
      return domainMatch && pathMatch && (!c.secure || url.protocol === 'https:') && (c.expires === -1 || c.expires > Date.now() / 1000);
    });
    if (cookies.length) headers.cookie = cookies.map(c => c.name + '=' + c.value).join('; ');
  }
  return headers;
}
export async function startServer() {
  const spec = JSON.parse(await readFile(new URL('../api-spec.json', import.meta.url), 'utf8')) as Spec;
  const base = new URL(spec.servers[0].url);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid API origin');
  const server = new McpServer({ name: spec.info.title, version: spec.info.version });
  for (const [path, methods] of Object.entries(spec.paths)) for (const [method, op] of Object.entries(methods)) {
    const readOnly = ['get', 'head', 'options'].includes(method);
    const shape: Record<string, ZodTypeAny> = {};
    if (op.parameters.length) shape.query = z.object(Object.fromEntries(op.parameters.map(p => [p.name, p.required ? validator(p.schema) : validator(p.schema).optional()]))).strict().optional();
    const content = Object.entries(op.requestBody?.content ?? {})[0];
    if (content) shape.body = op.requestBody?.required ? validator(content[1].schema) : validator(content[1].schema).optional();
    server.registerTool(op.operationId, { description: op.summary, inputSchema: shape, annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: true } }, async args => {
      try {
        if (!readOnly && process.env.MCP_ALLOW_WRITES !== 'true') throw new Error('Write operations disabled. Set MCP_ALLOW_WRITES=true to enable.');
        const url = new URL(base.origin);
        url.pathname = path;
        const input = args as { query?: Record<string, unknown>; body?: unknown };
        for (const [key, value] of Object.entries(input.query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
        const headers = await authHeaders(url);
        if (content) headers['content-type'] = content[0];
        const response = await fetch(url, { method: method.toUpperCase(), headers, redirect: 'error', signal: AbortSignal.timeout(30000), body: input.body === undefined ? undefined : content?.[0].includes('json') ? JSON.stringify(input.body) : String(input.body) });
        // Stream with a hard bound rather than buffering an arbitrarily large response.
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        if (reader) try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2_000_000) { await reader.cancel(); throw new Error('Response exceeds 2 MB limit'); } chunks.push(part.value); } } finally { reader.releaseLock(); }
        const text = Buffer.concat(chunks).toString('utf8');
        return { isError: !response.ok, content: [{ type: 'text' as const, text: JSON.stringify({ status: response.status, body: text }) }] };
      } catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Request failed' }] }; }
    });
  }
  await server.connect(new StdioServerTransport());
}

import { stat, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { harSchema, httpUrl, readJson, writeJson } from '../core.js';

const captureSchema = z.object({
  format: z.literal('web-to-mcp-capture-v1'),
  targetUrl: z.string().url(), capturedAt: z.string(), har: harSchema,
  dom: z.string().max(5_000_000).default(''), auth: z.record(z.unknown()).default({}),
  authState: z.object({ cookies: z.array(z.object({ name: z.string(), value: z.string(), domain: z.string(), path: z.string(), expires: z.number(), httpOnly: z.boolean(), secure: z.boolean(), sameSite: z.enum(['Strict', 'Lax', 'None']) })), origins: z.array(z.object({ origin: z.string().url(), localStorage: z.array(z.object({ name: z.string(), value: z.string() })) })) }),
  warnings: z.array(z.string()).default([])
});
export async function importCapture(file: string, dir: string) {
  return storeCapture(await readCapture(file), dir, true);
}
export async function readCapture(file: string) {
  if ((await stat(file)).size > 50_000_000) throw new Error('File thu thập vượt giới hạn 50 MB.');
  return captureSchema.parse(await readJson(file));
}
export async function storeCapture(input: unknown, dir: string, create = false) {
  const data = captureSchema.parse(input);
  const target = httpUrl(data.targetUrl);
  for (const entry of data.har.log.entries) httpUrl(entry.request.url);
  data.authState.origins = data.authState.origins.filter(item => item.origin === target.origin);
  data.authState.cookies = data.authState.cookies.filter(cookie => { const domain = cookie.domain.replace(/^\./, ''); return cookie.domain.startsWith('.') ? target.hostname === domain || target.hostname.endsWith('.' + domain) : target.hostname === domain; });
  await mkdir(join(dir, '..'), { recursive: true });
  if (create) await mkdir(dir); // Refuse to overwrite previous captures.
  await writeJson(join(dir, 'traffic.har'), data.har);
  await writeJson(join(dir, 'auth-state.json'), data.authState);
  await writeJson(join(dir, 'auth.json'), data.auth);
  await writeJson(join(dir, 'session.json'), { targetOrigin: target.origin, capturedAt: data.capturedAt, mode: 'extension', warnings: data.warnings });
  await writeFile(join(dir, 'dom.html'), data.dom, { mode: 0o600 });
}

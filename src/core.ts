import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';

export function projectPath(root: string, name: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) throw new Error('Name must contain 1–64 lowercase letters, digits, _ or -.');
  return resolve(root, name);
}
export function httpUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Expected HTTP(S) URL without credentials.');
  return url;
}
export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')); }
export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}
const pair = z.object({ name: z.string(), value: z.string() });
export const harSchema = z.object({ log: z.object({ entries: z.array(z.object({
  request: z.object({ url: z.string(), method: z.string(), headers: z.array(pair).default([]), queryString: z.array(pair).default([]), postData: z.object({ mimeType: z.string(), text: z.string().optional() }).passthrough().optional() }).passthrough(),
  response: z.object({ status: z.number(), content: z.object({ mimeType: z.string().default(''), text: z.string().optional() }).passthrough() }).passthrough(),
}).passthrough()) }).passthrough() });
export type Har = z.infer<typeof harSchema>;
export type Entry = Har['log']['entries'][number];
export type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema; required?: string[] };
export type Operation = { operationId: string; summary: string; parameters: { name: string; in: 'query'; required: boolean; schema: Schema }[]; requestBody?: { required: boolean; content: Record<string, { schema: Schema }> }; responses: Record<string, { description: string }>; 'x-auth-headers': string[] };
export type Spec = { openapi: '3.0.3'; info: { title: string; version: string }; servers: { url: string }[]; paths: Record<string, Record<string, Operation>> };

import { readdir, readFile, lstat, mkdir, rename, realpath } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { httpUrl, projectPath, readJson, writeJson } from '../core.js';

export function siteDomain(value: string): string {
  return httpUrl(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/\.$/, '');
}
export function domainFolder(domain: string): string {
  const host = siteDomain(domain);
  if (host.startsWith('[')) return 'ipv6-' + host.slice(1, -1).replace(/:/g, '-');
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(host)) throw new Error('Domain không hợp lệ.');
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(host) ? '_' + host : host;
}
export function artifactPath(root: string, url: string, name: string): string {
  return projectPath(join(resolve(root), domainFolder(url)), name);
}
export async function exists(path: string) {
  try { await lstat(path); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
}
// CLI compatibility: a bare name is accepted only when it identifies one capture.
export async function resolveArtifact(root: string, name: string, domain?: string): Promise<string> {
  projectPath(root, name);
  if (domain) {
    const dir = artifactPath(root, domain, name);
    if (!await exists(dir)) throw new Error(`Không tìm thấy phiên ${name} của ${siteDomain(domain)}.`);
    return dir;
  }
  const matches: string[] = [];
  const legacy = projectPath(root, name);
  if (await exists(join(legacy, 'session.json'))) matches.push(legacy);
  for (const item of await readdir(root, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return []; throw e; })) {
    if (item.isDirectory() && await exists(join(root, item.name, name, 'session.json'))) matches.push(resolve(root, item.name, name));
  }
  if (matches.length !== 1) throw new Error(matches.length ? 'Tên phiên trùng ở nhiều website. Thêm --domain <domain>.' : `Không tìm thấy phiên ${name}.`);
  return matches[0];
}

// Only explicit capture metadata selects a domain, never arbitrary network/CDN traffic.
export async function captureTarget(dir: string): Promise<string | undefined> {
  for (const name of ['session.json', 'before.json', 'list.json', 'new-project.json', 'result.json', 'page-data.json', 'search-dialog.json', 'runtime.json']) {
    try {
      const value = await readJson(join(dir, name)) as Record<string, unknown>;
      const url = value.targetOrigin ?? value.targetUrl ?? value.url;
      if (typeof url === 'string') return httpUrl(url).href;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
  }
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.web-mcp.json')) continue;
    const value = JSON.parse(await readFile(join(dir, entry.name), 'utf8'));
    if (value.format === 'web-to-mcp-capture-v1' && typeof value.targetUrl === 'string') return httpUrl(value.targetUrl).href;
  }
}

export async function migrateArtifacts(root: string, apply = false) {
  const base = await realpath(resolve(root));
  const report: { source: string; destination?: string; status: string; target?: string }[] = [];
  for (const item of await readdir(base, { withFileTypes: true })) {
    if (!item.isDirectory() || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(item.name) || /^(browsers|tmp|compiled-cli)$/.test(item.name)) continue;
    const source = join(base, item.name);
    const target = await captureTarget(source);
    if (!target) { report.push({ source, status: 'unknown-domain' }); continue; }
    const destination = artifactPath(base, target, item.name);
    const rel = relative(base, destination);
    if (isAbsolute(rel) || rel.startsWith('..')) throw new Error('Đường dẫn di chuyển vượt thư mục artifacts.');
    const parent = join(base, domainFolder(target));
    if (await exists(parent) && (await lstat(parent)).isSymbolicLink()) throw new Error('Không di chuyển qua liên kết thư mục: ' + parent);
    if (await exists(destination)) { report.push({ source, destination, target, status: 'conflict-kept' }); continue; }
    if (apply) { await mkdir(parent, { recursive: true }); await rename(source, destination); }
    report.push({ source, destination, target, status: apply ? 'moved' : 'planned' });
  }
  if (apply) await writeJson(join(base, '_migration', 'report.json'), report);
  return report;
}

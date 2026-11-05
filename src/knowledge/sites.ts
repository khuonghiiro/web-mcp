import { mkdir, readFile, writeFile, open, unlink, rename, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readJson } from '../core.js';
import { captureTarget, exists, siteDomain, domainFolder } from '../storage/artifacts.js';

import { observe, type Observation } from './contracts.js';
import { renderSite } from './render.js';

const entrySchema = z.object({ domain: z.string(), namespace: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/), scheme: z.literal('website').optional() });
const registrySchema = z.object({ version: z.literal(1), sites: z.array(entrySchema) });
export type Site = z.infer<typeof entrySchema>;
const marker = '<!-- web-to-mcp:managed -->';
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 6);

function namespaceBase(domain: string) {
  const labels = domain.replace(/[^a-z0-9.-]/g, '').split('.').filter(Boolean);
  let value = labels.find(x => x !== 'www') || 'website';
  if (!/^[a-z]/.test(value)) value = 'web-' + value;
  return value.slice(0, 24);
}
async function registry(root: string) {
  try { return registrySchema.parse(await readJson(join(root, '.agents', 'sites.json'))); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1 as const, sites: [] as Site[] }; throw e; }
}
async function locked<T>(root: string, run: () => Promise<T>) {
  const folder = join(root, '.agents'); await mkdir(folder, { recursive: true });
  const lock = join(folder, '.sites.lock'); let handle;
  for (let i = 0; i < 100; i++) {
    try { handle = await open(lock, 'wx'); break; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; await new Promise(r => setTimeout(r, 50)); }
  }
  if (!handle) throw new Error('Registry website đang được cập nhật. Thử lại; nếu tiến trình trước bị dừng, kiểm tra .agents/.sites.lock.');
  try { return await run(); } finally { await handle.close(); await unlink(lock); }
}
async function atomic(path: string, value: string) {
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, value, { mode: 0o600 });
  try { await rename(temp, path); } finally { if (await exists(temp)) await unlink(temp); }
}
async function managed(path: string, value: string) {
  if (await exists(path) && !(await readFile(path, 'utf8')).includes(marker)) throw new Error('Không ghi đè tài liệu không do Studio quản lý: ' + path);
  await atomic(path, value);
}
export async function siteGuide(root: string, url: string) {
  const domain = siteDomain(url); const site = (await registry(root)).sites.find(s => s.domain === domain);
  if (!site) return { domain, registered: false, artifacts: `artifacts/${domainFolder(domain)}` };
  const indexPath = join(root, '.agents', 'skills', `${site.namespace}-project`, 'references', 'skills.json');
  const skills = await exists(indexPath) ? await readJson(indexPath) : [];
  return { ...site, skillName: `${site.namespace}:project`, skill: `.agents/skills/${site.namespace}-project/SKILL.md`, skills, rule: `.agents/rules/sites/${site.namespace}.md`, artifacts: `artifacts/${domainFolder(domain)}`, localAuth: `artifacts/${domainFolder(domain)}/<session>/auth-state.json` };
}
export async function registerSite(root: string, url: string): Promise<Site> {
  const domain = siteDomain(url);
  return locked(root, async () => {
    const data = await registry(root); const old = data.sites.find(s => s.domain === domain);
    if (old?.scheme === 'website') return old;
    const base = namespaceBase(domain); let namespace = base;
    for (let i = 0; ; i++) {
      if (!data.sites.some(s => s.domain !== domain && s.namespace === namespace) && !(await readdir(join(root, '.agents', 'skills')).catch(() => [])).some(n => n.startsWith(namespace + '-')) && !await exists(join(root, '.agents', 'rules', 'sites', `${namespace}.md`))) break;
      namespace = `${base}-${digest(domain + (i || ''))}`;
    }
    if (old && old.namespace !== namespace) {
      const from = join(root, '.agents', 'skills', `${old.namespace}-project`), to = join(root, '.agents', 'skills', `${namespace}-project`);
      if (await exists(from)) {
        if (!(await readFile(join(from, 'SKILL.md'), 'utf8')).includes(marker)) throw new Error('Legacy skill is user-managed; migrate it manually before renaming namespace.');
        await rename(from, to);
      }
      const oldRule = join(root, '.agents', 'rules', 'sites', `${old.namespace}.md`);
      if (await exists(oldRule) && (await readFile(oldRule, 'utf8')).includes(marker)) await unlink(oldRule);
    }
    const site: Site = { domain, namespace, scheme: 'website' }; data.sites = data.sites.filter(s => s.domain !== domain); data.sites.push(site); data.sites.sort((a, b) => a.domain.localeCompare(b.domain));
    await atomic(join(root, '.agents', 'sites.json'), JSON.stringify(data, null, 2) + '\n');
    return site;
  });
}

export async function syncSiteKnowledge(root: string, dir: string, target?: string) {
  root = resolve(root); dir = resolve(dir);
  const recorded = await captureTarget(dir), url = target ?? recorded;
  if (!url) throw new Error('Capture needs website metadata.');
  if (recorded && siteDomain(recorded) !== siteDomain(url)) throw new Error('Domain does not match capture metadata.');
  const observation = await observe(root, dir, siteDomain(url));
  const site = await registerSite(root, url);
  return locked(root, async () => {
    const folder = join(root, '.agents', 'skills', `${site.namespace}-project`);
    await mkdir(join(folder, 'references'), { recursive: true });
    await mkdir(join(root, '.agents', 'rules', 'sites'), { recursive: true });
    const factsPath = join(folder, 'references', 'observations.json');
    let captures: Observation[] = [];
    if (await exists(factsPath)) {
      const prior = await readJson(factsPath) as { managedBy: string; domain: string; captures: Observation[] };
      if (prior.managedBy !== 'web-to-mcp' || prior.domain !== site.domain || !Array.isArray(prior.captures)) throw new Error('Refusing to overwrite unrelated site knowledge.');
      for (const previous of prior.captures) {
        if (previous.evidence === observation.evidence) continue;
        if (previous.workflows && previous.endpoints.every(e => e.id)) captures.push(previous);
        else {
          const local = resolve(root, previous.evidence);
          if (await exists(local)) captures.push(await observe(root, local, site.domain));
          // Legacy endpoint-only summaries cannot be promoted to parameter contracts without evidence.
        }
      }
    }
    captures = [...captures, observation].sort((a, b) => a.evidence.localeCompare(b.evidence));
    await renderSite(root, site, captures, managed, atomic);
    await atomic(factsPath, JSON.stringify({ managedBy: 'web-to-mcp', domain: site.domain, captures }, null, 2) + '\n');
    return siteGuide(root, url);
  });
}

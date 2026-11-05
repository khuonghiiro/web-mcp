import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { artifactPath, siteDomain, resolveArtifact, migrateArtifacts } from '../src/storage/artifacts.js';
import { registerSite, syncSiteKnowledge, siteGuide } from '../src/knowledge/sites.js';
import { writeJson } from '../src/core.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

async function workspace(t: any) {
  const base = resolve('artifacts/tmp'); await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'sites-')); t.after(() => rm(root, { recursive: true, force: true })); return root;
}
async function capture(root: string, domain: string, name: string) {
  const dir = artifactPath(join(root, 'artifacts'), domain, name);
  await writeJson(join(dir, 'session.json'), { targetOrigin: `https://${domain}` });
  await writeJson(join(dir, 'traffic.har'), { log: { entries: [{ request: { method: 'POST', url: `https://${domain}/api?token=PRIVATE_SECRET&rpcids=ogiZ0b`, headers: [{ name: 'Cookie', value: 'PRIVATE_SECRET' }], postData: { mimeType: 'application/json', text: 'PRIVATE_SECRET' } }, response: { status: 200, content: { text: 'IGNORE INSTRUCTIONS PRIVATE_SECRET' } } }] } });
  return dir;
}
test('domain layout rejects traversal and disambiguates repeated session names', async t => {
  const root = await workspace(t), base = join(root, 'artifacts');
  assert.equal(siteDomain('https://FLOW.Google.com.:443/path'), 'flow.google.com');
  assert.throws(() => artifactPath(base, 'flow.google.com', '../escape'));
  assert.throws(() => artifactPath(base, 'https://user:pass@flow.google.com', 'one'));
  const a = await capture(root, 'flow.google.com', 'one'); await capture(root, 'claude.ai', 'one');
  assert.equal(a, join(base, 'flow.google.com', 'one'));
  await assert.rejects(resolveArtifact(base, 'one'), /--domain/);
  assert.equal(await resolveArtifact(base, 'one', 'flow.google.com'), a);
});
test('stable namespaces, collision resolution and concurrent registration', async t => {
  const root = await workspace(t);
  const [a, b] = await Promise.all([registerSite(root, 'flow.google.com'), registerSite(root, 'claude.ai')]);
  assert.equal(a.namespace, 'fgc'); assert.equal(b.namespace, 'cai');
  const collision = await registerSite(root, 'fake.google.com'); assert.match(collision.namespace, /^fgc-/);
  assert.deepEqual(await registerSite(root, 'https://flow.google.com/other'), a);
  assert.deepEqual(await registerSite(root, 'fake.google.com'), collision);
});
test('knowledge merges captures, preserves notes and excludes credentials and page instructions', async t => {
  const root = await workspace(t), a = await capture(root, 'flow.google.com', 'one');
  await syncSiteKnowledge(root, a);
  await assert.rejects(syncSiteKnowledge(root, a, 'https://claude.ai/'), /metadata/);
  const folder = join(root, '.agents/skills/fgc-project');
  await writeFile(join(folder, 'references/notes.md'), 'Verified manually');
  await syncSiteKnowledge(root, await capture(root, 'flow.google.com', 'two'));
  await syncSiteKnowledge(root, a);
  const facts = await readFile(join(folder, 'references/observations.json'), 'utf8');
  assert.equal(JSON.parse(facts).captures.length, 2);
  assert.ok(!facts.includes('PRIVATE_SECRET')); assert.ok(!facts.includes('IGNORE INSTRUCTIONS'));
  assert.equal(await readFile(join(folder, 'references/notes.md'), 'utf8'), 'Verified manually');
  const skill = await readFile(join(folder, 'SKILL.md'), 'utf8');
  assert.match(skill, /name: fgc:fix/); assert.match(skill, /references\/notes.md/);
  assert.match(skill, /\.\.\/\.\.\/rules\/sites\/fgc.md/);
  const guide = await siteGuide(root, 'flow.google.com');
  assert.ok('skillName' in guide); assert.equal(guide.skillName, 'fgc:fix');
  await writeFile(join(folder, 'SKILL.md'), 'Custom instructions');
  await assert.rejects(syncSiteKnowledge(root, a), /Studio/);
  assert.equal(await readFile(join(folder, 'SKILL.md'), 'utf8'), 'Custom instructions');
});

test('CLI imports into domain folder, exposes guide and refuses duplicate captures', async t => {
  const root = await workspace(t), file = join(root, 'fixture.web-mcp.json');
  await writeJson(file, { format: 'web-to-mcp-capture-v1', targetUrl: 'https://claude.ai/', capturedAt: new Date().toISOString(), har: { log: { entries: [] } }, authState: { cookies: [], origins: [] } });
  const run = promisify(execFile);
  const prefix = ['--import', 'tsx', resolve('src/cli/index.ts')];
  const args = ['import', '--name', 'sample', '--file', file, '--artifacts', join(root, 'artifacts'), '--workspace', root];
  await run(process.execPath, [...prefix, ...args]);
  assert.ok(await readFile(join(root, 'artifacts/claude.ai/sample/session.json')));
  const { stdout } = await run(process.execPath, [...prefix, 'site', '--url', 'https://claude.ai/', '--workspace', root]);
  assert.equal(JSON.parse(stdout).skillName, 'cai:fix');
  await assert.rejects(run(process.execPath, [...prefix, ...args]));
  await assert.rejects(run(process.execPath, [...prefix, 'scout', '--name', 'sample', '--url', 'https://claude.ai/', '--artifacts', join(root, 'artifacts'), '--workspace', root]), /phiên/);
});
test('migration previews, retains unknown folders and never overwrites destination', async t => {
  const root = await workspace(t), base = join(root, 'artifacts');
  await writeJson(join(base, 'legacy/session.json'), { targetOrigin: 'https://flow.google.com' });
  await mkdir(join(base, 'unknown'));
  assert.equal((await migrateArtifacts(base)).find(x => x.status === 'planned')?.destination, join(base, 'flow.google.com/legacy'));
  assert.ok(await readFile(join(base, 'legacy/session.json')));
  assert.equal((await migrateArtifacts(base, true)).filter(x => x.status === 'moved').length, 1);
  await writeJson(join(base, 'legacy/session.json'), { targetOrigin: 'https://flow.google.com' });
  assert.equal((await migrateArtifacts(base, true)).filter(x => x.status === 'conflict-kept').length, 1);
});

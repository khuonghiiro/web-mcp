#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ORIGIN = 'https://flow.google.com';
const ENDPOINT = '/_/AiSandboxAngularFrontend/data/batchexecute';

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Load the freshest valid local session from artifacts/flow.google.com/
 * Extracts origin cookies from auth-state.json and query/form auth (f.sid, bl, hl, at) from traffic.har or capture.web-mcp.json.
 */
export async function loadLocalFlowAuth(artifactsRoot = resolve('artifacts/flow.google.com')) {
  if (!(await exists(artifactsRoot))) {
    throw new Error('AUTH_MISSING: No local artifacts/flow.google.com directory found. Run flow:auth via browser first.');
  }
  const entries = await readdir(artifactsRoot, { withFileTypes: true });
  const candidates = [artifactsRoot];
  for (const e of entries) {
    if (e.isDirectory()) candidates.push(join(artifactsRoot, e.name));
  }
  const ranked = [];
  for (const dir of candidates) {
    const authStatePath = join(dir, 'auth-state.json');
    const harPath = join(dir, 'traffic.har');
    const bundlePath = join(dir, 'capture.web-mcp.json');
    if (!(await exists(authStatePath)) && !(await exists(bundlePath))) continue;
    const mtime = (await stat(await exists(authStatePath) ? authStatePath : bundlePath)).mtimeMs;
    ranked.push({ dir, mtime, authStatePath, harPath, bundlePath });
  }
  ranked.sort((a, b) => b.mtime - a.mtime);

  for (const item of ranked) {
    try {
      let state = null;
      let harEntries = [];
      if (await exists(item.authStatePath)) {
        state = JSON.parse(await readFile(item.authStatePath, 'utf8'));
      }
      if (await exists(item.harPath)) {
        harEntries = JSON.parse(await readFile(item.harPath, 'utf8')).log?.entries ?? [];
      } else if (await exists(item.bundlePath)) {
        const bundle = JSON.parse(await readFile(item.bundlePath, 'utf8'));
        state = state ?? bundle.authState;
        harEntries = bundle.har?.log?.entries ?? [];
      }
      if (!state?.cookies?.length) continue;

      const nowSec = Date.now() / 1000;
      const validCookies = state.cookies.filter(c => {
        const d = c.domain.replace(/^\./, '');
        const hostMatch = 'flow.google.com' === d || (c.domain.startsWith('.') && 'flow.google.com'.endsWith('.' + d));
        return hostMatch && (c.expires <= 0 || c.expires > nowSec);
      });
      if (!validCookies.length) continue;

      const batchEntry = [...harEntries].reverse().find(e => {
        try {
          const u = new URL(e.request.url);
          return u.origin === ORIGIN && u.pathname === ENDPOINT && e.request.postData?.text && new URLSearchParams(e.request.postData.text).has('at');
        } catch { return false; }
      });
      if (!batchEntry) continue;

      const u = new URL(batchEntry.request.url);
      const form = new URLSearchParams(batchEntry.request.postData.text);
      const at = form.get('at');
      if (!at) continue;

      return {
        sessionDir: item.dir,
        cookieHeader: validCookies.map(c => `${c.name}=${c.value}`).join('; '),
        at,
        query: {
          bl: u.searchParams.get('bl') || '',
          'f.sid': u.searchParams.get('f.sid') || '',
          hl: u.searchParams.get('hl') || 'vi',
          rt: u.searchParams.get('rt') || 'c'
        }
      };
    } catch { continue; }
  }
  throw new Error('AUTH_EXPIRED_OR_INCOMPLETE: Could not find valid cookies and `at` token in local artifacts. Connect browser via flow:auth to refresh session.');
}

/**
 * Execute a Google Flow batchexecute RPC using local auth/cookies.
 */
export async function callFlowRpc(rpcId, argsArray, sourcePath = '/', authOverride = null) {
  const auth = authOverride ?? await loadLocalFlowAuth();
  const url = new URL(ORIGIN + ENDPOINT);
  url.searchParams.set('rpcids', rpcId);
  url.searchParams.set('source-path', sourcePath);
  if (auth.query.bl) url.searchParams.set('bl', auth.query.bl);
  if (auth.query['f.sid']) url.searchParams.set('f.sid', auth.query['f.sid']);
  if (auth.query.hl) url.searchParams.set('hl', auth.query.hl);
  url.searchParams.set('_reqid', String(Math.floor(100000 + Math.random() * 900000)));
  if (auth.query.rt) url.searchParams.set('rt', auth.query.rt);

  const envelope = [[[rpcId, JSON.stringify(argsArray), null, 'generic']]];
  const body = new URLSearchParams({ 'f.req': JSON.stringify(envelope), at: auth.at });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Origin': ORIGIN,
      'Referer': ORIGIN + sourcePath,
      'X-Same-Domain': '1',
      'Cookie': auth.cookieHeader
    },
    body: body.toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)) {
    throw new Error(`AUTH_REQUIRED: HTTP ${response.status} from Flow batchexecute. Refresh session on browser via flow:auth.`);
  }

  const text = await response.text();
  if (/PUBLIC_ERROR_UNUSUAL_ACTIVITY/i.test(text)) {
    throw new Error(`VERIFICATION_REQUIRED: RPC ${rpcId} rejected with PUBLIC_ERROR_UNUSUAL_ACTIVITY (reCAPTCHA Enterprise required). Switch to flow:browser-* skill.`);
  }

  let decoded = null;
  let rpcError = null;
  for (const line of text.split('\n')) {
    if (!line.startsWith('[[')) continue;
    try {
      for (const row of JSON.parse(line)) {
        if (row[0] === 'wrb.fr' && row[1] === rpcId) {
          if (typeof row[2] === 'string') decoded = JSON.parse(row[2]);
          if (row[5]) rpcError = row[5];
        }
      }
    } catch { /* ignore framing lines */ }
  }

  if ( decoded === null && rpcError ) {
    throw new Error(`RPC_ERROR: ${rpcId} returned error ${JSON.stringify(rpcError)}`);
  }
  return { rpcId, status: response.status, decoded, sessionDir: auth.sessionDir };
}

/**
 * List Flow projects (RPC UpteDb).
 */
export async function listProjects({ limit = 21 } = {}) {
  const res = await callFlowRpc('UpteDb', ['projects/*', limit, null, null, null, null, [1]], '/');
  const rawList = Array.isArray(res.decoded?.[0]) ? res.decoded[0] : [];
  const projects = rawList.map(item => ({
    id: item?.[0],
    title: item?.[1]?.[0] ?? null,
    resourceName: item?.[4] ?? (item?.[0] ? `projects/${item[0]}` : null)
  })).filter(p => p.id);
  return { ok: true, count: projects.length, projects, sessionDir: res.sessionDir };
}

/**
 * Create a new Flow project (RPC jHPbke) and optionally rename it immediately if needed.
 */
export async function createProject({ name }) {
  if (!name || typeof name !== 'string') throw new Error('Parameter `name` is required.');
  const res = await callFlowRpc('jHPbke', ['projects/*', [null, [name]], [null, 22]], '/');
  const projectId = res.decoded?.[0];
  const createdTitle = res.decoded?.[1]?.[0] ?? name;
  return { ok: Boolean(projectId), projectId, title: createdTitle, url: projectId ? `${ORIGIN}/project/${projectId}` : null, sessionDir: res.sessionDir };
}

/**
 * Rename an existing Flow project (RPC o8DA4). Reusable after createProject or on any projectId.
 */
export async function renameProject({ projectId, name }) {
  if (!projectId || !name) throw new Error('Parameters `projectId` and `name` are required.');
  const cleanId = projectId.replace(/^projects\//, '');
  const res = await callFlowRpc(
    'o8DA4',
    [`projects/${cleanId}`, [name], [['project_title']], [null, 22]],
    `/project/${cleanId}`
  );
  const updatedTitle = res.decoded?.[0] ?? null;
  return { ok: updatedTitle === name, projectId: cleanId, title: updatedTitle, sessionDir: res.sessionDir };
}

/**
 * Get project metadata (RPC ngNC2) and asset/scene state (RPC Zzl0ze).
 */
export async function getProject({ projectId }) {
  if (!projectId) throw new Error('Parameter `projectId` is required.');
  const cleanId = projectId.replace(/^projects\//, '');
  const meta = await callFlowRpc('ngNC2', [`tools/PINHOLE/projects/${cleanId}`], `/project/${cleanId}`);
  const state = await callFlowRpc('Zzl0ze', [`projects/${cleanId}`, null, null, null, [1]], `/project/${cleanId}`);
  return { ok: true, projectId: cleanId, metadata: meta.decoded, state: state.decoded, sessionDir: meta.sessionDir };
}

/**
 * Fetch live model & dependent configuration catalog (RPC HTrJv) and model status (RPC yBhWQ).
 */
export async function getModelConfig() {
  const catalog = await callFlowRpc('HTrJv', [], '/');
  const status = await callFlowRpc('yBhWQ', [], '/');
  const root = catalog.decoded?.[0] ?? [];
  const videoModels = (root[4] ?? []).map(m => ({
    displayName: m[0],
    familyId: m[3],
    variants: (m[1] ?? []).map(v => ({
      code: v[0],
      creditCost: v[4]?.[0]?.[1]?.[0]?.[1] ?? null,
      aspectRatios: v[12]?.[0] ?? [],
      durationSeconds: v[16] ?? null
    }))
  }));
  const imageModels = (root[5] ?? []).map(m => ({
    displayName: m[0],
    familyId: m[3],
    code: m[1]?.[0]?.[0] ?? null,
    creditCost: m[1]?.[0]?.[4]?.[0]?.[1]?.[0]?.[1] ?? 0
  }));
  return { ok: true, imageModels, videoModels, modelStatus: status.decoded?.[0] ?? [], sessionDir: catalog.sessionDir };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('api-client.mjs')) {
  const [action, ...rest] = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const k = rest[i].slice(2);
      flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
    }
  }
  (async () => {
    if (action === 'list-projects') console.log(JSON.stringify(await listProjects({ limit: Number(flags.limit || 21) }), null, 2));
    else if (action === 'create-project') console.log(JSON.stringify(await createProject({ name: flags.name }), null, 2));
    else if (action === 'rename-project') console.log(JSON.stringify(await renameProject({ projectId: flags.projectId || flags.id, name: flags.name }), null, 2));
    else if (action === 'get-project') console.log(JSON.stringify(await getProject({ projectId: flags.projectId || flags.id }), null, 2));
    else if (action === 'get-models') console.log(JSON.stringify(await getModelConfig(), null, 2));
    else {
      console.log(JSON.stringify({
        usage: 'node .agents/skills/flow-project/references/api-client.mjs <action> [--flags]',
        actions: ['list-projects [--limit 21]', 'create-project --name <title>', 'rename-project --id <projectId> --name <newTitle>', 'get-project --id <projectId>', 'get-models']
      }, null, 2));
    }
  })().catch(err => {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    process.exitCode = 1;
  });
}

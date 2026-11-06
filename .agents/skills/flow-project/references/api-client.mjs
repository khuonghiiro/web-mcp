#!/usr/bin/env node
import dns from 'node:dns';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

dns.setDefaultResultOrder('ipv4first');

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

  let freshestCookies = null;
  let freshestDir = null;

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
      if (state?.cookies?.length && !freshestCookies) {
        const nowSec = Date.now() / 1000;
        const valid = state.cookies.filter(c => {
          const d = c.domain.replace(/^\./, '');
          const hostMatch = 'flow.google.com' === d || (c.domain.startsWith('.') && 'flow.google.com'.endsWith('.' + d));
          return hostMatch && (c.expires <= 0 || c.expires > nowSec);
        });
        if (valid.length) {
          freshestCookies = valid.map(c => `${c.name}=${c.value}`).join('; ');
          freshestDir = item.dir;
        }
      }

      const domPath = join(item.dir, 'dom.html');
      if (freshestCookies && await exists(domPath)) {
        const dom = await readFile(domPath, 'utf8');
        const atMatch = dom.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
        const sidMatch = dom.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
        const blMatch = dom.match(/"cfb2h"\s*:\s*"([^"]+)"/);
        if (atMatch?.[1]) {
          return {
            sessionDir: freshestDir,
            cookieHeader: freshestCookies,
            at: atMatch[1],
            query: {
              bl: blMatch?.[1] || '',
              'f.sid': sidMatch?.[1] || '',
              hl: 'vi',
              rt: 'c'
            }
          };
        }
      }

      const batchEntry = [...harEntries].reverse().find(e => {
        try {
          const u = new URL(e.request.url);
          return u.origin === ORIGIN && u.pathname === ENDPOINT && e.request.postData?.text && new URLSearchParams(e.request.postData.text).has('at');
        } catch { return false; }
      });
      if (!batchEntry || !freshestCookies) continue;

      const u = new URL(batchEntry.request.url);
      const form = new URLSearchParams(batchEntry.request.postData.text);
      const at = form.get('at');
      if (!at) continue;

      return {
        sessionDir: freshestDir,
        cookieHeader: freshestCookies,
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
 * Refresh local Flow cookies (`auth-state.json`) and XSRF token (`at` in `dom.html`) automatically
 * from the armed Chrome/Edge extension tab (`flow:auth` fallback) when local cookies/tokens expire (401/403).
 */
export async function refreshFlowAuthFromBrowser(artifactsRoot = resolve('artifacts/flow.google.com')) {
  const token = randomBytes(32).toString('hex');
  let poll = null;
  let connected = false;
  let captureResolve = null;
  let captureReject = null;
  let captureReqId = null;

  const server = createServer((req, res) => {
    const auth = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const origin = req.headers.origin;
    if (req.method === 'GET' && req.url === '/pairing') {
      const ext = req.headers['x-studio-extension'];
      if (typeof ext !== 'string' || !/^[a-p]{32}$/.test(ext) || req.headers.host !== '127.0.0.1:43119') {
        res.writeHead(403).end(); return;
      }
      if (connected) { res.writeHead(409).end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ pairingUrl: `http://127.0.0.1:43119/#${token}` }));
      return;
    }
    if ((origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) || !/^[a-f0-9]{64}$/.test(auth) || !timingSafeEqual(Buffer.from(auth), Buffer.from(token))) {
      res.writeHead(403).end(); return;
    }
    const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data)); };
    if (req.method === 'GET' && req.url === '/next') {
      if (!captureReqId) {
        captureReqId = randomBytes(12).toString('hex');
        send({ id: captureReqId, type: 'capture', args: {} });
        return;
      }
      poll = res;
      return;
    }
    let bytes = 0; const chunks = [];
    req.on('data', c => { bytes += c.length; if (bytes <= 50_000_000) chunks.push(c); });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (req.url === '/hello') {
          connected = true;
          send({ ok: true });
        } else if (req.url === '/result' && body.id === captureReqId) {
          send({ ok: true });
          if (poll) { try { poll.end(JSON.stringify({ type: 'disconnect' })); } catch {} poll = null; }
          if (body.ok) captureResolve?.(body.result);
          else captureReject?.(new Error(String(body.error)));
        } else {
          send({ ok: true });
        }
      } catch (e) { send({ error: String(e) }, 400); }
    });
  });

  await new Promise((res, rej) => {
    server.once('error', rej).once('listening', res).listen(43119, '127.0.0.1');
  });

  try {
    const capture = await new Promise((res, rej) => {
      captureResolve = res;
      captureReject = rej;
      const t = setTimeout(() => rej(new Error('AUTH_REFRESH_TIMEOUT: Extension tab did not auto-connect within 35s.')), 35000);
      captureResolve = (val) => { clearTimeout(t); res(val); };
      captureReject = (err) => { clearTimeout(t); rej(err); };
    });

    const dir = join(artifactsRoot, `flow-auth-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'auth-state.json'), JSON.stringify(capture.authState, null, 2));

    let freshDom = capture.dom || '';
    const nowSec = Date.now() / 1000;
    const validCookies = (capture.authState?.cookies ?? []).filter(c => {
      const d = c.domain.replace(/^\./, '');
      const hostMatch = 'flow.google.com' === d || (c.domain.startsWith('.') && 'flow.google.com'.endsWith('.' + d));
      return hostMatch && (c.expires <= 0 || c.expires > nowSec);
    });
    if (validCookies.length) {
      try {
        const cookieHeader = validCookies.map(c => `${c.name}=${c.value}`).join('; ');
        const pageRes = await fetch(`${ORIGIN}/`, {
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(15000)
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          if (/"SNlM0e"\s*:\s*"([^"]+)"/.test(html)) {
            freshDom = html;
          }
        }
      } catch { /* fallback to capture.dom */ }
    }

    await writeFile(join(dir, 'dom.html'), freshDom);
    await writeFile(join(dir, 'traffic.har'), JSON.stringify(capture.har || { log: { version: '1.2', entries: [] } }, null, 2));
    return await loadLocalFlowAuth(artifactsRoot);
  } finally {
    await new Promise(r => server.close(() => r()));
  }
}

let cachedRefreshedAuth = null;

/**
 * Execute a Google Flow batchexecute RPC using local auth/cookies.
 * Automatically refreshes cookies/tokens from the browser extension (`flow:auth`) on HTTP 400/401/403.
 */
export async function callFlowRpc(rpcId, argsArray, sourcePath = '/', authOverride = null, _retried = false) {
  const auth = authOverride ?? cachedRefreshedAuth ?? await loadLocalFlowAuth();
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
      'Cookie': auth.cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    },
    body: body.toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(30000)
  });

  if ((response.status === 400 || response.status === 401 || response.status === 403) && !_retried && !authOverride) {
    cachedRefreshedAuth = await refreshFlowAuthFromBrowser();
    return callFlowRpc(rpcId, argsArray, sourcePath, cachedRefreshedAuth, true);
  }

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

/**
 * Get single asset metadata, workflowId, dimensions, and fresh signed 1K download URL (RPC as29s).
 */
export async function getAsset({ assetId, projectId }) {
  if (!assetId) throw new Error('Parameter `assetId` is required.');
  const cleanProjectId = projectId ? projectId.replace(/^projects\//, '') : null;
  const res = await callFlowRpc('as29s', [assetId], cleanProjectId ? `/project/${cleanProjectId}` : '/');
  const d = res.decoded ?? [];
  return {
    ok: Boolean(d[0]),
    assetId: d[0] ?? assetId,
    projectId: d[1] ?? cleanProjectId,
    workflowId: d[2] ?? null,
    prompt: d[6]?.[0]?.[7] ?? d[5]?.[6]?.[2]?.[0]?.[0] ?? null,
    dimensions: d[6]?.[2] ?? null,
    downloadUrl1K: d[5]?.[10] ?? d[6]?.[0]?.[13] ?? null,
    sessionDir: res.sessionDir
  };
}

/**
 * Rename an image or video asset/workflow (RPC mYWVGd).
 * Accepts either `workflowId` + `projectId`, or `assetId` (which auto-resolves `workflowId` and `projectId` via `as29s`).
 */
export async function renameAsset({ projectId, workflowId, assetId, name }) {
  if (!name) throw new Error('Parameter `name` is required.');
  let resolvedProjectId = projectId ? projectId.replace(/^projects\//, '') : null;
  let resolvedWorkflowId = workflowId || null;
  if (!resolvedWorkflowId || !resolvedProjectId) {
    if (!assetId) throw new Error('Provide either (`projectId` + `workflowId`) or `assetId`.');
    const info = await getAsset({ assetId, projectId: resolvedProjectId });
    resolvedWorkflowId = resolvedWorkflowId || info.workflowId;
    resolvedProjectId = resolvedProjectId || info.projectId;
  }
  const res = await callFlowRpc(
    'mYWVGd',
    [[resolvedWorkflowId, null, null, [name], resolvedProjectId], [['metadata.display_name']]],
    `/project/${resolvedProjectId}/edit/${resolvedWorkflowId}`
  );
  const updatedName = res.decoded?.[3]?.[0] ?? name;
  return {
    ok: updatedName === name,
    projectId: resolvedProjectId,
    workflowId: resolvedWorkflowId,
    assetId: assetId ?? res.decoded?.[3]?.[4] ?? null,
    name: updatedName,
    sessionDir: res.sessionDir
  };
}

/**
 * Trash (archive) or restore an image/video asset/workflow (RPC mYWVGd).
 */
export async function trashAsset({ projectId, workflowId, assetId, archived = true }) {
  let resolvedProjectId = projectId ? projectId.replace(/^projects\//, '') : null;
  let resolvedWorkflowId = workflowId || null;
  if (!resolvedWorkflowId || !resolvedProjectId) {
    if (!assetId) throw new Error('Provide either (`projectId` + `workflowId`) or `assetId`.');
    const info = await getAsset({ assetId, projectId: resolvedProjectId });
    resolvedWorkflowId = resolvedWorkflowId || info.workflowId;
    resolvedProjectId = resolvedProjectId || info.projectId;
  }
  const res = await callFlowRpc(
    'mYWVGd',
    [[resolvedWorkflowId, null, null, [null, null, archived ? 1 : 0], resolvedProjectId], [['metadata.archived']]],
    `/project/${resolvedProjectId}`
  );
  return {
    ok: true,
    projectId: resolvedProjectId,
    workflowId: resolvedWorkflowId,
    archived: Boolean(archived),
    sessionDir: res.sessionDir
  };
}

/**
 * Download an image at 1K original resolution via RPC as29s signed URL.
 * (2K and 4K upsampling require GEM_PIX_2_UPSAMPLE_2K / GEM_PIX_2_UPSAMPLE_4K with reCAPTCHA Enterprise via browser UI.)
 */
export async function downloadAsset1K({ assetId, projectId, outputPath }) {
  const info = await getAsset({ assetId, projectId });
  if (!info.downloadUrl1K) throw new Error(`No 1K download URL returned for asset ${assetId}`);
  if (!outputPath) return { ok: true, assetId: info.assetId, resolution: '1K', dimensions: info.dimensions, downloadUrl: info.downloadUrl1K };
  const resp = await fetch(info.downloadUrl1K, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`Failed to download 1K image: HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const out = resolve(outputPath);
  await writeFile(out, buf);
  return { ok: true, assetId: info.assetId, resolution: '1K', dimensions: info.dimensions, bytes: buf.length, outputPath: out };
}

/**
 * Extract ONLY target business fields from BOTH request and response of a captured Flow batchexecute HAR entry
 * to avoid reading unrelated HAR entries, raw f.req tuples, reCAPTCHA strings, or verbose wrb.fr wrappers (token-efficient).
 */
export function extractRpcSummary(rpcId, entryOrText) {
  const isEntry = typeof entryOrText === 'object' && entryOrText !== null;
  const text = isEntry ? (entryOrText.response?.content?.text ?? '') : String(entryOrText || '');
  const status = isEntry ? entryOrText.response?.status : 200;
  let request = undefined;
  if (isEntry && entryOrText.request?.postData?.text) {
    try {
      const fReq = JSON.parse(new URLSearchParams(entryOrText.request.postData.text).get('f.req') || '[]');
      const args = JSON.parse(fReq?.[0]?.[0]?.[1] || 'null');
      if (rpcId === 'ogiZ0b' && Array.isArray(args?.[1])) {
        const first = args[1][0];
        const refIds = Array.isArray(first?.[2]) ? first[2].map(r => r?.[0]).filter(Boolean) : [];
        request = {
          count: args[1].length,
          modelCode: first?.[5] ?? null,
          aspectRatioCode: first?.[4] ?? null,
          referenceImageIds: refIds,
          prompt: first?.[8]?.[0]?.[0]?.[0] ?? null,
          projectId: first?.[7]?.[5] ?? null,
          hasRecaptchaToken: Boolean(first?.[7]?.[10]?.[0])
        };
      } else if (rpcId === 'jHPbke') {
        request = { title: args?.[1]?.[1]?.[0] ?? null };
      } else if (rpcId === 'o8DA4') {
        request = { projectId: String(args?.[0] ?? '').replace(/^projects\//, '') || null, title: args?.[1]?.[0] ?? null };
      } else if (rpcId === 'UpteDb') {
        request = { limit: args?.[1] ?? null };
      } else if (rpcId === 'ngNC2' || rpcId === 'Zzl0ze') {
        request = { projectId: String(args?.[0] ?? '').replace(/^(tools\/PINHOLE\/)?projects\//, '') || null };
      } else if (rpcId === 'as29s') {
        request = { assetId: args?.[0] ?? null };
      } else if (rpcId === 'mYWVGd') {
        request = {
          workflowId: args?.[0]?.[0] ?? null,
          projectId: args?.[0]?.[4] ?? null,
          displayName: args?.[0]?.[3]?.[0] ?? null,
          archived: args?.[0]?.[3]?.[2] ?? null,
          favorited: args?.[0]?.[3]?.[3] ?? null,
          updateMask: args?.[1]?.[0] ?? []
        };
      }
    } catch { /* ignore */ }
  }
  for (const line of text.replace(/^\)\]\}'\s*/, '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('[[')) continue;
    try {
      for (const row of JSON.parse(trimmed)) {
        if (!Array.isArray(row) || row[0] !== 'wrb.fr' || row[1] !== rpcId) continue;
        if (row[2] == null && Array.isArray(row[5])) {
          return {
            ok: false,
            rpcId,
            status,
            ...(request ? { request } : {}),
            response: { errorCode: row[5][0], errorMessage: row[5][1] ?? null }
          };
        }
        const data = typeof row[2] === 'string' ? JSON.parse(row[2]) : row[2];
        if (rpcId === 'ogiZ0b' && Array.isArray(data?.[0])) {
          return {
            ok: true,
            rpcId,
            status,
            ...(request ? { request } : {}),
            response: {
              count: data[0].length,
              items: data[0].map(item => ({
                id: item?.[0] ?? null,
                workflowId: item?.[2] ?? null,
                seed: item?.[6]?.[0]?.[1] ?? null,
                aspectRatioCode: item?.[6]?.[0]?.[14] ?? null,
                url: item?.[6]?.[0]?.[13] ?? null
              }))
            }
          };
        }
        if (rpcId === 'as29s' && Array.isArray(data)) {
          return {
            ok: true,
            rpcId,
            status,
            ...(request ? { request } : {}),
            response: {
              assetId: data[0] ?? null,
              projectId: data[1] ?? null,
              workflowId: data[2] ?? null,
              dimensions: data[6]?.[2] ?? null,
              url: data[5]?.[10] ?? data[6]?.[0]?.[13] ?? null
            }
          };
        }
        if (rpcId === 'mYWVGd' && Array.isArray(data)) {
          return {
            ok: true,
            rpcId,
            status,
            ...(request ? { request } : {}),
            response: {
              workflowId: data[0] ?? null,
              assetId: data[3]?.[4] ?? null,
              displayName: data[3]?.[0] ?? null
            }
          };
        }
        if (rpcId === 'jHPbke' && Array.isArray(data)) {
          return { ok: true, rpcId, status, ...(request ? { request } : {}), response: { projectId: data[0] ?? null, title: data[1]?.[0] ?? null } };
        }
        if (rpcId === 'o8DA4' && Array.isArray(data)) {
          return { ok: true, rpcId, status, ...(request ? { request } : {}), response: { title: data[0] ?? null } };
        }
        if (rpcId === 'UpteDb' && Array.isArray(data?.[0])) {
          return {
            ok: true,
            rpcId,
            status,
            ...(request ? { request } : {}),
            response: { count: data[0].length, projects: data[0].map(p => ({ id: p?.[0] ?? null, title: p?.[1]?.[0] ?? null })) }
          };
        }
        return { ok: true, rpcId, status, ...(request ? { request } : {}) };
      }
    } catch { /* ignore framing lines */ }
  }
  return { ok: false, rpcId, status, ...(request ? { request } : {}), completed: Boolean(text) };
}

if (process.argv[1] && (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('api-client.mjs'))) {
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
    else if (action === 'get-asset') console.log(JSON.stringify(await getAsset({ assetId: flags.assetId || flags.id, projectId: flags.projectId }), null, 2));
    else if (action === 'rename-asset') console.log(JSON.stringify(await renameAsset({ projectId: flags.projectId, workflowId: flags.workflowId, assetId: flags.assetId || flags.id, name: flags.name }), null, 2));
    else if (action === 'trash-asset') console.log(JSON.stringify(await trashAsset({ projectId: flags.projectId, workflowId: flags.workflowId, assetId: flags.assetId || flags.id, archived: flags.restore !== 'true' }), null, 2));
    else if (action === 'download-asset') console.log(JSON.stringify(await downloadAsset1K({ assetId: flags.assetId || flags.id, projectId: flags.projectId, outputPath: flags.out || flags.output }), null, 2));
    else if (action === 'parse-rpc') {
      const rpcId = flags.rpc || 'ogiZ0b';
      const auth = await loadLocalFlowAuth();
      const harPath = join(flags.session ? resolve(flags.session) : auth.sessionDir, 'traffic.har');
      const har = JSON.parse(await readFile(harPath, 'utf8'));
      const matches = (har.log?.entries ?? []).filter(e => e.request?.url?.includes(`rpcids=${rpcId}`));
      const latest = matches[matches.length - 1];
      console.log(JSON.stringify(latest ? extractRpcSummary(rpcId, latest) : { ok: false, found: false, rpcId }, null, 2));
    }
    else {
      console.log(JSON.stringify({
        usage: 'node .agents/skills/flow-project/references/api-client.mjs <action> [--flags]',
        actions: [
          'list-projects [--limit 21]',
          'create-project --name <title>',
          'rename-project --id <projectId> --name <newTitle>',
          'get-project --id <projectId>',
          'get-models',
          'get-asset --id <assetId> [--projectId <projectId>]',
          'rename-asset --id <assetId> --name <newTitle> [--workflowId <id> --projectId <id>]',
          'trash-asset --id <assetId> [--restore true]',
          'download-asset --id <assetId> [--out <filePath>]',
          'parse-rpc --rpc <rpcId> [--session <dir>]'
        ]
      }, null, 2));
    }
  })().catch(err => {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    process.exitCode = 1;
  });
}

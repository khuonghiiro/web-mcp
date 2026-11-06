#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ORIGIN = 'https://chatgpt.com';

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Load the freshest valid local session from artifacts/chatgpt.com/
 */
export async function loadLocalChatgptAuth(artifactsRoot = resolve('artifacts/chatgpt.com')) {
  if (!(await exists(artifactsRoot))) {
    throw new Error('AUTH_MISSING: No local artifacts/chatgpt.com directory found. Run chatgpt:auth via browser first.');
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
    const headersPath = join(dir, 'auth-headers.json');
    if (!(await exists(authStatePath)) && !(await exists(harPath))) continue;
    const mtime = (await stat(await exists(authStatePath) ? authStatePath : harPath)).mtimeMs;
    ranked.push({ dir, mtime, authStatePath, harPath, headersPath });
  }
  ranked.sort((a, b) => b.mtime - a.mtime);

  for (const item of ranked) {
    try {
      const state = await exists(item.authStatePath) ? JSON.parse(await readFile(item.authStatePath, 'utf8')) : null;
      const harEntries = await exists(item.harPath) ? JSON.parse(await readFile(item.harPath, 'utf8')).log?.entries ?? [] : [];
      const customHeaders = await exists(item.headersPath) ? JSON.parse(await readFile(item.headersPath, 'utf8'))[ORIGIN] ?? {} : {};

      const nowSec = Date.now() / 1000;
      const validCookies = (state?.cookies ?? []).filter(c => {
        const d = c.domain.replace(/^\./, '');
        const hostMatch = 'chatgpt.com' === d || (c.domain.startsWith('.') && 'chatgpt.com'.endsWith('.' + d));
        return hostMatch && (c.expires <= 0 || c.expires > nowSec);
      });

      let bearer = customHeaders.Authorization || customHeaders.authorization || null;
      if (!bearer) {
        const authEntry = [...harEntries].reverse().find(e => {
          try {
            return new URL(e.request.url).origin === ORIGIN && e.request.headers?.some(h => h.name.toLowerCase() === 'authorization' && /^Bearer /i.test(h.value));
          } catch { return false; }
        });
        bearer = authEntry?.request.headers.find(h => h.name.toLowerCase() === 'authorization')?.value ?? null;
      }

      if (!validCookies.length && !bearer) continue;
      return {
        sessionDir: item.dir,
        cookieHeader: validCookies.map(c => `${c.name}=${c.value}`).join('; '),
        authorization: bearer
      };
    } catch { continue; }
  }
  throw new Error('AUTH_EXPIRED_OR_INCOMPLETE: Could not find valid cookies/Authorization in local artifacts. Connect browser via chatgpt:auth to refresh session.');
}

/**
 * Search conversation history via POST /backend-api/global/search.
 */
export async function searchHistory({ query, limit = 10, cursor = null }) {
  if (!query || typeof query !== 'string') throw new Error('Parameter `query` is required.');
  const auth = await loadLocalChatgptAuth();
  const headers = {
    'Content-Type': 'application/json',
    'Origin': ORIGIN,
    'Referer': ORIGIN + '/',
    ...(auth.cookieHeader ? { Cookie: auth.cookieHeader } : {}),
    ...(auth.authorization ? { Authorization: auth.authorization } : {})
  };
  const body = {
    entrypoint: ' SEARCH_MODAL',
    limit: Number(limit),
    query,
    source_requests: [
      { type: 'CONVERSATION' },
      { type: 'GIZMO' },
      { type: 'LIBRARY', filters: { lanes: ['CANVAS', 'IMAGE', 'FILE'], library_providers: ['CHATGPT', 'GOOGLE_DRIVE'] } }
    ],
    cursor,
    query_id: crypto.randomUUID()
  };
  const response = await fetch(`${ORIGIN}/backend-api/global/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(30000)
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`AUTH_REQUIRED: HTTP ${response.status} from ChatGPT API. Refresh session via chatgpt:auth.`);
  }
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: text.startsWith('{') ? JSON.parse(text) : text, sessionDir: auth.sessionDir };
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
    if (action === 'search-history') console.log(JSON.stringify(await searchHistory({ query: flags.query, limit: Number(flags.limit || 10) }), null, 2));
    else console.log(JSON.stringify({ usage: 'node .agents/skills/chatgpt-project/references/api-client.mjs search-history --query <keyword> [--limit 10]' }, null, 2));
  })().catch(err => {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    process.exitCode = 1;
  });
}

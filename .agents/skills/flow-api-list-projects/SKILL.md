---
name: flow:api-list-projects
description: "Execute \"List Flow projects\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-list-projects

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `verified`; CAPTCHA: `not-observed`. 2026-11-06: standalone UpteDb call via api-client.mjs returned decoded project list including known test project without CAPTCHA challenge.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-list-projects](../flow-browser-list-projects/SKILL.md) or refresh auth first.

Inputs: `limit` (Max projects to fetch (default 21 in observed RPC).); `filter` (Optional client-side title/ID substring filter.).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `UpteDb` (params: `params-82e85614`); schema `6445f9493e1d` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs list-projects [--limit 21]` or call `listProjects()` from `api-client.mjs`.
- Underlying RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=UpteDb` (inherits shared batchexecute query/form parameterGroup in `api.json`).
- Args payload in `f.req` (`envelope[0][0][1]`): `["projects/*", 21, null, null, null, null, [1]]`. Decoded `wrb.fr` frame returns array `data[0]` where each item has `item[0]` (project UUID) and `item[1][0]` (project title).
- If local cookies or `at` token are expired (`AUTH_REQUIRED`), attach browser via `flow:auth` to refresh.

Success checks:
- Returns project IDs, titles, and `/project/<id>` URLs without leaking cookies or tokens.
- Distinguishes an empty project list from expired auth or unloaded UI.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

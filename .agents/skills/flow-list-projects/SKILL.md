---
name: flow:list-projects
description: "List and filter projects on flow.google.com via verified local API or browser UI before selecting a target project."
---

<!-- web-to-mcp:managed -->
# flow:list-projects

Website: https://flow.google.com/ (exact hostname scope).

## List Flow projects

Verification: Verified standalone API execution (`UpteDb`) and browser UI extraction on 2026-11-06.

## Execution Routing
Default: **api** — Verified API with no observed CAPTCHA gate; run via local auth/cookies.
Call `studio_site_route` with URL and task `list-projects`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-list-projects](../flow-api-list-projects/SKILL.md)
- Browser skill: [flow:browser-list-projects](../flow-browser-list-projects/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `limit`: Max projects to fetch (default 21 in observed RPC).
- `filter`: Optional client-side title/ID substring filter.

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `UpteDb` (inherits `params-82e85614`); schema `6445f9493e1d` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs list-projects [--limit 21]` or call `listProjects()` from `api-client.mjs`.
- Underlying RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=UpteDb` (inherits shared batchexecute query/form parameterGroup in `api.json`).
- Args payload in `f.req` (`envelope[0][0][1]`): `["projects/*", 21, null, null, null, null, [1]]`. Decoded `wrb.fr` frame returns array `data[0]` where each item has `item[0]` (project UUID) and `item[1][0]` (project title).
- If local cookies or `at` token are expired (`AUTH_REQUIRED`), attach browser via `flow:auth` to refresh.

## Browser Branch
1. Navigate to `https://flow.google.com/` and call `studio_inspect`; if redirected to Google login, run `flow:auth`.
2. Extract project cards/links (`a[href^="/project/"]`) using `studio_extract` to read titles and project UUIDs. Do not click the create button when only listing.
3. Scroll incrementally if additional projects need to load.

## Success Criteria
- Returns project IDs, titles, and `/project/<id>` URLs without leaking cookies or tokens.
- Distinguishes an empty project list from expired auth or unloaded UI.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

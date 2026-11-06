---
name: flow:api-create-project
description: "Execute \"Create a Flow project\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-create-project

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `verified`; CAPTCHA: `not-observed`. Authenticated jHPbke RPC creates project with custom title and returns UUID; verified with UpteDb list and o8DA4 rename.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-create-project](../flow-browser-create-project/SKILL.md) or refresh auth first.

Inputs: `name` (Desired project title (mapped to `args[1][1][0]` in `jHPbke`, or applied via `flow:rename-project` after UI creation).).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `jHPbke` (params: `params-82e85614`); schema `2b8f637713af` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `UpteDb` (params: `params-82e85614`); schema `6445f9493e1d` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `o8DA4` (params: `params-82e85614`); schema `be04875c19bb` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs create-project --name "<title>"` or import `createProject({ name })` from `api-client.mjs`.
- Underlying RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=jHPbke` using local cookies and `at` token.
- Args payload in `f.req` (`envelope[0][0][1]`): `["projects/*", [null, [name]], [null, 22]]`. Decoded `wrb.fr` response returns new `projectId` at `data[0]` and title at `data[1][0]`.
- Reusable composition: after creating a project (or if UI creation assigns a default timestamp title), call `renameProject({ projectId, name })` (`RPC o8DA4`) to set or update the title without recreating the project.
- Confirm creation via `flow:list-projects` if network response is interrupted; never retry blind writes.

Success checks:
- Returns the new `projectId` and `/project/<id>` URL confirmed by API response or list check.
- Project title matches requested `name`.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

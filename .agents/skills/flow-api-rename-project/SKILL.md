---
name: flow:api-rename-project
description: "Execute \"Rename an existing Flow project\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-rename-project

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `verified`; CAPTCHA: `not-observed`. 2026-11-06: captured RPC o8DA4 during live header rename and verified standalone execution via api-client.mjs.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-rename-project](../flow-browser-rename-project/SKILL.md) or refresh auth first.

Inputs: `projectId` (Target project UUID (e.g. from `create-project` or `list-projects`).); `name` (New project title.).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `o8DA4` (params: `params-82e85614`); schema `be04875c19bb` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs rename-project --id <projectId> --name "<newTitle>"` or import `renameProject({ projectId, name })` from `api-client.mjs`.
- Underlying RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=o8DA4` with `source-path=/project/<projectId>`.
- Args payload in `f.req` (`envelope[0][0][1]`): `["projects/<projectId>", [name], [["project_title"]], [null, 22]]`.
- Decoded `wrb.fr` response returns `[name]`, confirming the updated title immediately.

Success checks:
- API `wrb.fr` payload returns `[name]` or UI header reflects the updated title.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

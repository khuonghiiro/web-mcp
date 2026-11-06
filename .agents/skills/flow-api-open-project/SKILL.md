---
name: flow:api-open-project
description: "Execute \"Open and inspect a Flow project\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-open-project

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `verified`; CAPTCHA: `not-observed`. 2026-11-06: verified get-project and get-models via api-client.mjs and live browser navigation.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-open-project](../flow-browser-open-project/SKILL.md) or refresh auth first.

Inputs: `projectId` (Project UUID or title from `flow:list-projects`.).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `ngNC2` (params: `params-82e85614`); schema `85eaf97ce791` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `Zzl0ze` (params: `params-82e85614`); schema `e9d88ef704c2` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `HTrJv` (params: `params-82e85614`); schema `2a9f2d20c2fe` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `yBhWQ` (params: `params-82e85614`); schema `ffa8dd24e47b` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs get-project --id <projectId>` to fetch project metadata (`ngNC2`, args `["tools/PINHOLE/projects/<id>"]`) and workspace state (`Zzl0ze`, args `["projects/<id>", null, null, null, [1]]`).
- Run `node .agents/skills/flow-project/references/api-client.mjs get-models` to fetch live model families, variant codes, aspect ratios, durations, and credit costs (`HTrJv` and `yBhWQ`).

Success checks:
- API returns decoded project metadata/state, or browser reaches `/project/<projectId>` with prompt editor ready and no blocking modal.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

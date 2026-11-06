---
name: flow:open-project
description: "Load a Flow project's metadata, scene/asset state, and model catalog via API (`ngNC2`, `Zzl0ze`, `HTrJv`) or open the project workspace in browser UI."
---

<!-- web-to-mcp:managed -->
# flow:open-project

Website: https://flow.google.com/ (exact hostname scope).

## Open and inspect a Flow project

Verification: Verified both read RPCs (`ngNC2`, `Zzl0ze`, `HTrJv`, `yBhWQ`) and browser navigation on 2026-11-06.

## Execution Routing
Default: **api** — Verified API with no observed CAPTCHA gate; run via local auth/cookies.
Call `studio_site_route` with URL and task `open-project`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-open-project](../flow-api-open-project/SKILL.md)
- Browser skill: [flow:browser-open-project](../flow-browser-open-project/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `projectId`: Project UUID or title from `flow:list-projects`.

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `ngNC2` (inherits `params-82e85614`); schema `85eaf97ce791` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `Zzl0ze` (inherits `params-82e85614`); schema `e9d88ef704c2` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `HTrJv` (inherits `params-82e85614`); schema `2a9f2d20c2fe` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `yBhWQ` (inherits `params-82e85614`); schema `ffa8dd24e47b` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs get-project --id <projectId>` to fetch project metadata (`ngNC2`, args `["tools/PINHOLE/projects/<id>"]`) and workspace state (`Zzl0ze`, args `["projects/<id>", null, null, null, [1]]`).
- Run `node .agents/skills/flow-project/references/api-client.mjs get-models` to fetch live model families, variant codes, aspect ratios, durations, and credit costs (`HTrJv` and `yBhWQ`).

## Browser Branch
1. From `flow:list-projects`, click the project link `a[href="/project/<projectId>"]`.
2. Poll `studio_inspect` until `url` is `/project/<projectId>` and the prompt editor (`flow-rich-text-editor`) is rendered (navigation is asynchronous).
3. If a changelog modal (`flow-change-log-modal`) appears, dismiss it before interacting with workspace controls.

## Success Criteria
- API returns decoded project metadata/state, or browser reaches `/project/<projectId>` with prompt editor ready and no blocking modal.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

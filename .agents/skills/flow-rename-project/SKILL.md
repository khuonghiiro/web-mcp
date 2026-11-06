---
name: flow:rename-project
description: "Reusable task to rename any Flow project by ID via verified API (`o8DA4`) or the project header editable input."
---

<!-- web-to-mcp:managed -->
# flow:rename-project

Website: https://flow.google.com/ (exact hostname scope).

## Rename an existing Flow project

Verification: Captured from live UI interaction and verified standalone via `api-client.mjs` on 2026-11-06.

## Execution Routing
Default: **api** — Verified API with no observed CAPTCHA gate; run via local auth/cookies.
Call `studio_site_route` with URL and task `rename-project`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-rename-project](../flow-api-rename-project/SKILL.md)
- Browser skill: [flow:browser-rename-project](../flow-browser-rename-project/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `projectId`: Target project UUID (e.g. from `create-project` or `list-projects`).
- `name`: New project title.

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `o8DA4` (inherits `params-82e85614`); schema `be04875c19bb` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs rename-project --id <projectId> --name "<newTitle>"` or import `renameProject({ projectId, name })` from `api-client.mjs`.
- Underlying RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=o8DA4` with `source-path=/project/<projectId>`.
- Args payload in `f.req` (`envelope[0][0][1]`): `["projects/<projectId>", [name], [["project_title"]], [null, 22]]`.
- Decoded `wrb.fr` response returns `[name]`, confirming the updated title immediately.

## Browser Branch
1. Inside `/project/<projectId>`, inspect header for `flow-editable-text input`.
2. Click the input, fill with `name`, and press `Enter` (`studio_press` with `key: 'Enter'`).
3. Re-inspect header title to confirm the new name is committed.

## Success Criteria
- API `wrb.fr` payload returns `[name]` or UI header reflects the updated title.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

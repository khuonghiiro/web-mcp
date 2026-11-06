---
name: flow:create-project
description: "Create a new project on flow.google.com via verified API (`jHPbke`) or browser UI, with support for follow-up renaming (`o8DA4`)."
---

<!-- web-to-mcp:managed -->
# flow:create-project

Website: https://flow.google.com/ (exact hostname scope).

## Create a Flow project

Verification: Verified standalone API (`jHPbke`), follow-up rename (`o8DA4`), and browser creation flow.

## Execution Routing
Default: **api** — Verified API with no observed CAPTCHA gate; run via local auth/cookies.
Call `studio_site_route` with URL and task `create-project`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-create-project](../flow-api-create-project/SKILL.md)
- Browser skill: [flow:browser-create-project](../flow-browser-create-project/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `name`: Desired project title (mapped to `args[1][1][0]` in `jHPbke`, or applied via `flow:rename-project` after UI creation).

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `jHPbke` (inherits `params-82e85614`); schema `2b8f637713af` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `UpteDb` (inherits `params-82e85614`); schema `6445f9493e1d` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `o8DA4` (inherits `params-82e85614`); schema `be04875c19bb` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs create-project --name "<title>"` or import `createProject({ name })` from `api-client.mjs`.
- Underlying RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=jHPbke` using local cookies and `at` token.
- Args payload in `f.req` (`envelope[0][0][1]`): `["projects/*", [null, [name]], [null, 22]]`. Decoded `wrb.fr` response returns new `projectId` at `data[0]` and title at `data[1][0]`.
- Reusable composition: after creating a project (or if UI creation assigns a default timestamp title), call `renameProject({ projectId, name })` (`RPC o8DA4`) to set or update the title without recreating the project.
- Confirm creation via `flow:list-projects` if network response is interrupted; never retry blind writes.

## Browser Branch
1. On `https://flow.google.com/`, inspect and click the new project button (`button[aria-label='addDự án mới']` or localized equivalent) once.
2. Wait and re-inspect until URL transitions to `/project/<id>`.
3. If UI creates a default timestamp name and a custom `name` was requested, either call `flow:api-rename-project` with the new `<id>` or edit `flow-editable-text input` in the header and press `Enter`.

## Success Criteria
- Returns the new `projectId` and `/project/<id>` URL confirmed by API response or list check.
- Project title matches requested `name`.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

# Flow: Verified RPCs, Reusable APIs & reCAPTCHA Enterprise Flow

Scope: `flow.google.com`. Verified against live sessions on 2026-11-05 and 2026-11-06.

## 1. Execution Split (API vs Browser)

- **Direct Local API (`captcha: not-observed`, `api: verified`)**:
  - `list-projects` (`RPC UpteDb`): Lists user projects (`args: ["projects/*", 21, null, null, null, null, [1]]`).
  - `create-project` (`RPC jHPbke`): Creates a new project (`args: ["projects/*", [null, [name]], [null, 22]]`) and returns `projectId` at `data[0]`, title at `data[1][0]`.
  - `rename-project` (`RPC o8DA4`): Renames any project (`args: ["projects/<id>", [name], [["project_title"]], [null, 22]]`) and returns `[name]`. Can be chained right after `create-project`.
  - `open-project` / `get-models` (`RPC ngNC2`, `Zzl0ze`, `HTrJv`, `yBhWQ`): Reads project metadata, asset state, and the complete model/variant dependency catalog.
  - All verified APIs are wrapped in `.agents/skills/flow-project/references/api-client.mjs`, which automatically loads cookies and `at` / `f.sid` tokens from the newest local capture under `artifacts/flow.google.com/`. If auth expires (`401`/`403`/redirect), refresh via `flow:auth` on the browser.

- **Browser UI Execution (`captcha: required`, `api: blocked`)**:
  - `generate-image` (`RPC ogiZ0b`) and video generation require a live browser-minted **reCAPTCHA Enterprise** token.
  - Flow loads `https://www.google.com/recaptcha/enterprise.js?trustedtypes=true&render=6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV` and embeds an invisible badge iframe (`anchor?ar=1&k=6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV`).
  - When clicking the submit button (`flow-generate-icon-button button`) in the browser, the frontend executes `grecaptcha.enterprise.execute('6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV', ...)` and injects the single-use token into `args[1][i][7][10][0]` and `args[3][10][0]`.
  - Standalone API calls without a freshly minted browser token return HTTP 200 with RPC error `7 PUBLIC_ERROR_UNUSUAL_ACTIVITY`. Therefore, always execute image/video generation through the browser branch (`flow:browser-generate-image`).

## 2. Reusable API Chaining

- `api-client.mjs` exports `loadLocalFlowAuth()`, `callFlowRpc()`, `listProjects()`, `createProject()`, `renameProject()`, `getProject()`, and `getModelConfig()`.
- Example composition: create a project and later rename it by passing `--id <projectId> --name "<newTitle>"` to `rename-project` without creating duplicate projects.

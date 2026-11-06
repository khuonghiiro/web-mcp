# Web-to-MCP Studio

Read `.agents/rules/development-rules.md` when editing source code and `.agents/rules/recon-safety.md` when interacting with websites. This repository is a Node.js/TypeScript CLI + stdio MCP server + Chrome/Edge Manifest V3 extension (not Parallax Studio or Electron).

## Website Skill Routing & Execution Split (API vs Web Browser)

- **Exact Hostname Lookup**: When a task involves a URL, resolve the exact hostname in `.agents/sites.json` or call `studio_site_guide`. Never guess namespaces or apply skills from a different domain.
- **Two Execution Branches**: Every website task is split into two execution modes:
  1. **API (`<namespace>:api-<task>`)**: Fast direct HTTP/RPC execution using local cookies/auth tokens (`artifacts/<domain>/<session>/`) via the site's reusable `references/api-client.mjs`. Use immediately when `execution.api === "verified"` and `execution.captcha === "not-observed"`.
  2. **Web Browser (`<namespace>:browser-<task>`)**: Live browser UI automation via Studio/extension (`studio_inspect`, `studio_click`, `studio_fill`, `studio_press`). Use when the endpoint requires reCAPTCHA/turnstile verification (`execution.captcha === "required"` or `PUBLIC_ERROR_UNUSUAL_ACTIVITY`), when the API is unverified, or when the user explicitly requests UI interaction.
- **Auth Refresh & Composable APIs**:
  - Fresh machine or expired local auth (`401`/`403`/login redirect): run `<namespace>:auth` on the browser to refresh `auth-state.json` and `traffic.har` locally, then resume API execution. Never commit or push `artifacts/`.
  - Keep API helpers modular and reusable in `.agents/skills/<namespace>-project/references/api-client.mjs` so tasks can be chained with parameters (e.g. `create-project` followed by `rename-project --id <id> --name <newTitle>`).
- **Capture & Knowledge Hygiene (Token-Efficient)**:
  - During scouting, correlate UI actions (`before`/`after` snapshots) with network requests (`action-trace.json`) and capture dependent UI configurations (e.g., model family vs aspect ratio, resolution, duration, output count, and reCAPTCHA token generation flows).
  - When verifying task completion (such as image/video generation or project mutation), use `studio_network({ rpcId })` / `session.readRpcResult(rpcId)` or `extractRpcSummary(rpcId, entry)` in `api-client.mjs` to extract **only** the target fields from **both request** (`count`, `modelCode`, `aspectRatioCode`, `prompt`, `hasRecaptchaToken`) **and response** (`ok`, `id`, `url`, `errorCode`). Never dump raw HAR files, raw `f.req` / `postData` bodies, full `wrb.fr` strings, or full-page `innerText` into context.
  - Exclude non-business noise (telemetry, CSP/error reports, static assets, help/feedback widgets) from `api.json`.
  - Deduplicate repeated query/header/form parameters in `api.json` using `parameterGroups` + `parameterGroup` inheritance. Keep `observations.json` gitignored (`.agents/skills/*/references/observations.json`) as local-only session state so account/machine-specific capture sessions are never committed to Git.
  - Keep all `.agents/skills/` and `.agents/rules/` in concise English so AI agents parse them quickly with minimal token usage.
- **Git**: Commit in Vietnamese only when requested by the user. Never push automatically.

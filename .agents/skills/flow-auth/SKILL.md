---
name: flow:auth
description: "Initialize or refresh local authentication for flow.google.com; use on fresh clones or expired sessions."
---

<!-- web-to-mcp:managed -->
# flow:auth

Website: https://flow.google.com/ (exact hostname scope).

1. Read repository `README.md`; run `setup.bat` if needed. Start MCP Studio and load the extension from `extension/`.
2. Open https://flow.google.com/ in the user's Chrome/Edge browser. Complete login and any security challenge on the website.
3. On the target tab, enable "Auto-connect AI" and call `studio_start` with `{name: "flow-session-<timestamp>", url: "https://flow.google.com/", endpoint: "extension"}`.
4. Call `studio_inspect` to verify the authenticated UI, then trigger a read action so `studio_network` captures fresh requests and tokens. Do not assume HTTP 200 alone proves login.
5. For UI tasks, keep Studio connected. For API tasks, call `studio_close` to persist `artifacts/flow.google.com/<session>/auth-state.json`, `auth.json`, and `traffic.har`.
6. API calls require origin-matching cookies plus fresh bearer/CSRF/form tokens from local capture. Store headers only in `artifacts/flow.google.com/<session>/auth-headers.json` as `{ "https://<API-origin>": { "<header>": "<local-value>" } }`. Never print secrets in chat or commit them.
7. For generated MCP servers, set `MCP_AUTH_STATE` and `MCP_AUTH_HEADERS_FILE` to local absolute paths.
8. On 401/403, login redirect, expired token, or RPC auth rejection: connect browser via Studio, refresh the session on the web page, and re-capture auth/cookies. Never retry ambiguous write mutations before checking the UI.

All auth state, HAR, DOM, and user data stay in gitignored `artifacts/flow.google.com/`.

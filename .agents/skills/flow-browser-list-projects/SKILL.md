---
name: flow:browser-list-projects
description: "Execute \"List Flow projects\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-list-projects

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `limit` (Max projects to fetch (default 21 in observed RPC).); `filter` (Optional client-side title/ID substring filter.).

1. Navigate to `https://flow.google.com/` and call `studio_inspect`; if redirected to Google login, run `flow:auth`.
2. Extract project cards/links (`a[href^="/project/"]`) using `studio_extract` to read titles and project UUIDs. Do not click the create button when only listing.
3. Scroll incrementally if additional projects need to load.

Success checks:
- Returns project IDs, titles, and `/project/<id>` URLs without leaking cookies or tokens.
- Distinguishes an empty project list from expired auth or unloaded UI.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

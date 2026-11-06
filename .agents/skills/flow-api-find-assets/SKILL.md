---
name: flow:api-find-assets
description: "Execute \"Search and filter project assets\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-find-assets

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `observed`; CAPTCHA: `not-observed`. Project state RPC Zzl0ze and browser filter controls verified on 2026-11-06.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-find-assets](../flow-browser-find-assets/SKILL.md) or refresh auth first.

Inputs: `query` (Optional search keyword.); `filters` (Asset type (Image, Video, Collection, Scene, Character), aspect ratio, creation/upload/favorite state, duration (`4s`–`10s`), resolution (`720p`/`360p`), or sort order.).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `Zzl0ze` (params: `params-82e85614`); schema `e9d88ef704c2` in [API contract](../flow-project/references/api.json).
- Initial project assets are returned in `Zzl0ze` (`get-project` in `api-client.mjs`). Opening the filter menu and toggling filters on an empty project updates client view state without firing a separate search RPC.
- Use `getProject({ projectId })` in `api-client.mjs` to read raw project state via API, or use the browser UI filter bar.

Success checks:
- Returns matching asset cards/counts and clearly reports active filters.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

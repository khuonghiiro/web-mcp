---
name: flow:find-assets
description: "Search and filter generated images, videos, scenes, and characters inside a Flow project workspace."
---

<!-- web-to-mcp:managed -->
# flow:find-assets

Website: https://flow.google.com/ (exact hostname scope).

## Search and filter project assets

Verification: Verified filter panel controls and `Zzl0ze` project state RPC on 2026-11-06.

## Execution Routing
Default: **browser** — API is unverified or blocked; use browser UI and capture evidence.
Call `studio_site_route` with URL and task `find-assets`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-find-assets](../flow-api-find-assets/SKILL.md)
- Browser skill: [flow:browser-find-assets](../flow-browser-find-assets/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `query`: Optional search keyword.
- `filters`: Asset type (Image, Video, Collection, Scene, Character), aspect ratio, creation/upload/favorite state, duration (`4s`–`10s`), resolution (`720p`/`360p`), or sort order.

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `Zzl0ze` (inherits `params-82e85614`); schema `e9d88ef704c2` in [API contract](../flow-project/references/api.json).
- Initial project assets are returned in `Zzl0ze` (`get-project` in `api-client.mjs`). Opening the filter menu and toggling filters on an empty project updates client view state without firing a separate search RPC.
- Use `getProject({ projectId })` in `api-client.mjs` to read raw project state via API, or use the browser UI filter bar.

## Browser Branch
1. Inside `/project/<projectId>`, inspect `flow-search-bar` for the search input and filter button (`Các lựa chọn lọc và sắp xếp`).
2. Fill search input if `query` is provided, or click the filter button to open the filter popover.
3. Match checkbox/radio options by surrounding section text before clicking (Angular Material checkbox IDs `#mat-mdc-checkbox-*` are dynamic). Use the reset button (`Xoá tất cả bộ lọc`) only to clear filters.

## Success Criteria
- Returns matching asset cards/counts and clearly reports active filters.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

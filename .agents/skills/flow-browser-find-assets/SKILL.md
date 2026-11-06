---
name: flow:browser-find-assets
description: "Execute \"Search and filter project assets\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-find-assets

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `query` (Optional search keyword.); `filters` (Asset type (Image, Video, Collection, Scene, Character), aspect ratio, creation/upload/favorite state, duration (`4s`–`10s`), resolution (`720p`/`360p`), or sort order.).

1. Inside `/project/<projectId>`, inspect `flow-search-bar` for the search input and filter button (`Các lựa chọn lọc và sắp xếp`).
2. Fill search input if `query` is provided, or click the filter button to open the filter popover.
3. Match checkbox/radio options by surrounding section text before clicking (Angular Material checkbox IDs `#mat-mdc-checkbox-*` are dynamic). Use the reset button (`Xoá tất cả bộ lọc`) only to clear filters.

Success checks:
- Returns matching asset cards/counts and clearly reports active filters.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

---
name: flow:browser-rename-asset
description: "Execute \"Rename or trash an image/video asset\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-rename-asset

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `assetId` (Target asset UUID (or `workflowId` + `projectId`).); `projectId` (Optional project UUID (auto-resolved via `as29s` if omitted).); `name` (New display title for the image/video asset (makes selecting reference images in `flow-add-menu` clear and deterministic).).

1. On `/project/<projectId>`, click the target image tile (`flow-grid-tile-container flow-image-tile img`) to open `/project/<projectId>/edit/<workflowId>` (`flow-editor-page`).
2. In `flow-editor-header`, click `flow-editable-text input`, fill with the new `name` (`studio_fill`), and press `Enter` (`studio_press` with `key: 'Enter'`).
3. Click `flow-editor-header button[aria-label="Đã chỉnh sửa xong"]` (`Xong`) to return to the project grid; the tile footer immediately displays the updated title.

Success checks:
- API `mYWVGd` returns `ok: true` with `data[3][0] === name`, or browser grid tile footer / `flow-add-menu` displays the updated asset title.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

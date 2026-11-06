---
name: flow:rename-asset
description: "Rename an image or video asset (`metadata.display_name`) or move it to trash (`metadata.archived`) via verified API (`mYWVGd` + `as29s`) or the asset detail editor header (`flow-editor-header`)."
---

<!-- web-to-mcp:managed -->
# flow:rename-asset

Website: https://flow.google.com/ (exact hostname scope).

## Rename or trash an image/video asset

Verification: Verified both live in browser (`flow-editor-header`) and standalone via `api-client.mjs` (`as29s` + `mYWVGd`) on 2026-11-06.

## Execution Routing
Default: **api** — Verified API with no observed CAPTCHA gate; run via local auth/cookies.
Call `studio_site_route` with URL and task `rename-asset`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-rename-asset](../flow-api-rename-asset/SKILL.md)
- Browser skill: [flow:browser-rename-asset](../flow-browser-rename-asset/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `assetId`: Target asset UUID (or `workflowId` + `projectId`).
- `projectId`: Optional project UUID (auto-resolved via `as29s` if omitted).
- `name`: New display title for the image/video asset (makes selecting reference images in `flow-add-menu` clear and deterministic).

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `as29s` (inherits `params-82e85614`); schema `8b98caf8cb61` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `mYWVGd` (inherits `params-82e85614`); schema `c4f19a80e312` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs rename-asset --id <assetId> --name "<newTitle>"` or call `renameAsset({ assetId, projectId, workflowId, name })` from `api-client.mjs`.
- If only `assetId` is provided, `api-client.mjs` first calls `RPC as29s` (`["<assetId>"]`) to resolve `workflowId` (`data[2]`) and `projectId` (`data[1]`).
- Underlying mutation RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=mYWVGd` with args `[[workflowId, null, null, [name], projectId], [["metadata.display_name"]]]`.
- To move an asset to trash via API, run `node .agents/skills/flow-project/references/api-client.mjs trash-asset --id <assetId>` (`args: [[workflowId, null, null, [null, null, 1], projectId], [["metadata.archived"]]]`).

## Browser Branch
1. On `/project/<projectId>`, click the target image tile (`flow-grid-tile-container flow-image-tile img`) to open `/project/<projectId>/edit/<workflowId>` (`flow-editor-page`).
2. In `flow-editor-header`, click `flow-editable-text input`, fill with the new `name` (`studio_fill`), and press `Enter` (`studio_press` with `key: 'Enter'`).
3. Click `flow-editor-header button[aria-label="Đã chỉnh sửa xong"]` (`Xong`) to return to the project grid; the tile footer immediately displays the updated title.

## Success Criteria
- API `mYWVGd` returns `ok: true` with `data[3][0] === name`, or browser grid tile footer / `flow-add-menu` displays the updated asset title.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

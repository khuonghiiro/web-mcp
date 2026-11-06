---
name: flow:api-rename-asset
description: "Execute \"Rename or trash an image/video asset\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-rename-asset

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `verified`; CAPTCHA: `not-observed`. 2026-11-06: renamed all 4 project images live in browser and verified standalone mYWVGd + as29s execution via api-client.mjs without CAPTCHA.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-rename-asset](../flow-browser-rename-asset/SKILL.md) or refresh auth first.

Inputs: `assetId` (Target asset UUID (or `workflowId` + `projectId`).); `projectId` (Optional project UUID (auto-resolved via `as29s` if omitted).); `name` (New display title for the image/video asset (makes selecting reference images in `flow-add-menu` clear and deterministic).).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `as29s` (params: `params-82e85614`); schema `8b98caf8cb61` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `mYWVGd` (params: `params-82e85614`); schema `c4f19a80e312` in [API contract](../flow-project/references/api.json).
- Run `node .agents/skills/flow-project/references/api-client.mjs rename-asset --id <assetId> --name "<newTitle>"` or call `renameAsset({ assetId, projectId, workflowId, name })` from `api-client.mjs`.
- If only `assetId` is provided, `api-client.mjs` first calls `RPC as29s` (`["<assetId>"]`) to resolve `workflowId` (`data[2]`) and `projectId` (`data[1]`).
- Underlying mutation RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=mYWVGd` with args `[[workflowId, null, null, [name], projectId], [["metadata.display_name"]]]`.
- To move an asset to trash via API, run `node .agents/skills/flow-project/references/api-client.mjs trash-asset --id <assetId>` (`args: [[workflowId, null, null, [null, null, 1], projectId], [["metadata.archived"]]]`).

Success checks:
- API `mYWVGd` returns `ok: true` with `data[3][0] === name`, or browser grid tile footer / `flow-add-menu` displays the updated asset title.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

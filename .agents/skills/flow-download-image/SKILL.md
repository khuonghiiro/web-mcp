---
name: flow:download-image
description: "Download a generated image at `1K` original resolution via verified API (`as29s` signed URL) or browser UI, or trigger `2K`/`4K` upsampled downloads via browser UI (`GEM_PIX_2_UPSAMPLE_2K` / `GEM_PIX_2_UPSAMPLE_4K`)."
---

<!-- web-to-mcp:managed -->
# flow:download-image

Website: https://flow.google.com/ (exact hostname scope).

## Download image at 1K, 2K, or 4K resolution

Verification: Verified `1K` API download (`788,112` bytes saved via `as29s`) and `1K`/`2K`/`4K` browser download menu flows on 2026-11-06.

## Execution Routing
Default: **api** — Verified API with no observed CAPTCHA gate; run via local auth/cookies.
Call `studio_site_route` with URL and task `download-image`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-download-image](../flow-api-download-image/SKILL.md)
- Browser skill: [flow:browser-download-image](../flow-browser-download-image/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `assetId`: Target image asset UUID.
- `resolution`: `1K` (original size, instant API or browser download), `2K` (upsampled via `GEM_PIX_2_UPSAMPLE_2K`), or `4K` (upsampled via `GEM_PIX_2_UPSAMPLE_4K`).
- `outputPath`: Local file path when downloading via `api-client.mjs`.

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `ogiZ0b` (inherits `params-82e85614`); schema `d16e4c6d8d70` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `as29s` (inherits `params-82e85614`); schema `8b98caf8cb61` in [API contract](../flow-project/references/api.json).
- For `1K` original resolution (no CAPTCHA): run `node .agents/skills/flow-project/references/api-client.mjs download-asset --id <assetId> --out <outputPath>` or call `downloadAsset1K({ assetId, outputPath })`.
- Underlying RPC: `POST /_/AiSandboxAngularFrontend/data/batchexecute?rpcids=as29s` with args `["<assetId>"]` returns dimensions at `data[6][2]` (e.g. `[1200, 896]`) and a fresh signed `https://flow-content.google/image/<assetId>?...` download URL at `data[5][10]` / `data[6][0][13]`.
- For `2K` and `4K` upsampling: Flow invokes upsample models `GEM_PIX_2_UPSAMPLE_2K` (enum `26`) and `GEM_PIX_2_UPSAMPLE_4K` (enum `27`), which require a browser-minted reCAPTCHA Enterprise token; use `flow:browser-download-image` for `2K`/`4K`.

## Browser Branch
1. Open the image detail view (`/project/<projectId>/edit/<workflowId>`) by clicking `flow-grid-tile-container flow-image-tile img` (or click the tile hover action button `button[aria-label="Tải nội dung nghe nhìn xuống"]`).
2. Click `flow-editor-header button[aria-label="Tải nội dung nghe nhìn xuống"]` (`downloadTải xuống`) to open the resolution menu.
3. Click the desired resolution item in the overlay menu: `flow-menu-item:nth-of-type(1) > button` (`1K Kích thước gốc`), `flow-menu-item:nth-of-type(2) > button` (`2K Đã tăng độ phân giải`), or `flow-menu-item:nth-of-type(3) > button` (`4K Đã tăng độ phân giải`).
4. `1K` downloads immediately (`Đã tải hình ảnh của bạn xuống!`); `2K` and `4K` run server-side upsampling (`Đang tăng độ phân giải cho hình ảnh của bạn, quá trình tải xuống sẽ tự động bắt đầu.`) and auto-download upon completion.

## Success Criteria
- `1K` file is saved to `outputPath` via API (`bytes > 0`) or browser triggers `1K`/`2K`/`4K` download toast without error.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

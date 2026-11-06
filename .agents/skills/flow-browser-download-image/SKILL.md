---
name: flow:browser-download-image
description: "Execute \"Download image at 1K, 2K, or 4K resolution\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-download-image

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `assetId` (Target image asset UUID.); `resolution` (`1K` (original size, instant API or browser download), `2K` (upsampled via `GEM_PIX_2_UPSAMPLE_2K`), or `4K` (upsampled via `GEM_PIX_2_UPSAMPLE_4K`).); `outputPath` (Local file path when downloading via `api-client.mjs`.).

1. Open the image detail view (`/project/<projectId>/edit/<workflowId>`) by clicking `flow-grid-tile-container flow-image-tile img` (or click the tile hover action button `button[aria-label="Tải nội dung nghe nhìn xuống"]`).
2. Click `flow-editor-header button[aria-label="Tải nội dung nghe nhìn xuống"]` (`downloadTải xuống`) to open the resolution menu.
3. Click the desired resolution item in the overlay menu: `flow-menu-item:nth-of-type(1) > button` (`1K Kích thước gốc`), `flow-menu-item:nth-of-type(2) > button` (`2K Đã tăng độ phân giải`), or `flow-menu-item:nth-of-type(3) > button` (`4K Đã tăng độ phân giải`).
4. `1K` downloads immediately (`Đã tải hình ảnh của bạn xuống!`); `2K` and `4K` run server-side upsampling (`Đang tăng độ phân giải cho hình ảnh của bạn, quá trình tải xuống sẽ tự động bắt đầu.`) and auto-download upon completion.

Success checks:
- `1K` file is saved to `outputPath` via API (`bytes > 0`) or browser triggers `1K`/`2K`/`4K` download toast without error.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

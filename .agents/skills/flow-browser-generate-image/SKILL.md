---
name: flow:browser-generate-image
description: "Execute \"Generate images in a Flow project (with optional 1-5 reference images)\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-generate-image

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `projectId` (Target project UUID.); `prompt` (Image generation prompt text (when using 1-5 reference images, explicitly state the role of each reference subject/prop/environment and how they combine).); `referenceImages` (Optional 1 to 5 reference assets (up to 5) selected via `flow-add-menu` (`Thêm thành phần vào ô nhập câu lệnh`) into `flow-ingredient-bar`.); `options` (Optional model (`GEM_PIX_2`, `HARBOR_SEAL`, `BELUGA`), aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`), and count (`x1`–`x4`).).

1. Open `/project/<projectId>` (`flow:open-project`) and configure model/aspect/count if needed (`flow:configure-generation`). If `button[aria-label="Xoá câu lệnh"]` is present from a prior prompt, click it first to clear old text and reference chips. If any failed generation cards (`flow-error-tile`) exist in the grid, click `flow-error-tile button:nth-of-type(3)` (`Xoá`, `RPC cz8Z4b`) to clean them up.
2. If attaching 1–5 reference images (max 5): for each reference image, click `button[aria-label="Thêm thành phần vào ô nhập câu lệnh"]` (`flow-add-menu button`), re-inspect `flow-add-menu-asset-list` buttons in `flow-add-menu-popover-content` (match by the asset's renamed title), and click the desired asset button (which auto-inserts a chip into `flow-ingredient-bar` and closes the popover). Verify chip count (`1..5`) via `studio_extract({ selector: "flow-ingredient-chip" })`.
3. Click the `flow-rich-text-editor` selector first (`studio_click`), then call `studio_fill` with `parameter: "prompt"`. When combining multiple reference images, explicitly describe which subject/character, prop/accessory, and background/style come from each reference image and how they interact.
4. Inspect and click the submit button (`flow-generate-icon-button button`, `aria-label="Bắt đầu tạo"`) once.
5. Poll `studio_network` with `{ rpcId: "ogiZ0b" }` (`session.readRpcResult("ogiZ0b")`) or `extractRpcSummary("ogiZ0b", entry)` in `api-client.mjs` to extract ONLY the target fields from both `request` (`count`, `modelCode`, `aspectRatioCode`, `referenceImageIds`, `prompt`, `hasRecaptchaToken`) and `response` (`ok`, `count`, `items[{ id, workflowId, url }]`, `errorCode`) without reading unrelated HAR entries, raw `f.req` strings, or full page text.

Success checks:
- `ogiZ0b` summary returns `ok: true` with `request` matching target options (`count`, `modelCode`, `aspectRatioCode`, `referenceImageIds`) and `response` containing the generated image `id`/`workflowId`/`url` items (no `errorCode: 7` CAPTCHA rejection).

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

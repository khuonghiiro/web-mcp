---
name: flow:generate-image
description: "Submit an image prompt with model/aspect/count options and optional 1-5 reference images (ingredients) in Flow; uses browser execution because standalone `ogiZ0b` RPC is gated by reCAPTCHA Enterprise (`PUBLIC_ERROR_UNUSUAL_ACTIVITY`)."
---

<!-- web-to-mcp:managed -->
# flow:generate-image

Website: https://flow.google.com/ (exact hostname scope).

## Generate images in a Flow project (with optional 1-5 reference images)

Verification: Browser generation verified (1024x1024 and 1200x896 images created with 0–3 reference images); standalone API confirmed blocked by reCAPTCHA Enterprise (`PUBLIC_ERROR_UNUSUAL_ACTIVITY`).

## Execution Routing
Default: **browser** — Website verification / reCAPTCHA required; use browser session instead of standalone API.
Call `studio_site_route` with URL and task `generate-image`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-generate-image](../flow-api-generate-image/SKILL.md)
- Browser skill: [flow:browser-generate-image](../flow-browser-generate-image/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `projectId`: Target project UUID.
- `prompt`: Image generation prompt text (when using 1-5 reference images, explicitly state the role of each reference subject/prop/environment and how they combine).
- `referenceImages`: Optional 1 to 5 reference assets (up to 5) selected via `flow-add-menu` (`Thêm thành phần vào ô nhập câu lệnh`) into `flow-ingredient-bar`.
- `options`: Optional model (`GEM_PIX_2`, `HARBOR_SEAL`, `BELUGA`), aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`), and count (`x1`–`x4`).

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `ogiZ0b` (inherits `params-82e85614`); schema `d16e4c6d8d70` in [API contract](../flow-project/references/api.json).
- Observed RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=ogiZ0b`.
- Payload dependency mapping in `f.req` (`args = JSON.parse(envelope[0][0][1])`): `args[1]` is an array of generation items (length = output count `1..4`); for each item `item = args[1][i]`: `item[2]` is `null` (no references) or an array of 1–5 reference image tuples `[["<assetId1>", null, null, null, 1], ...]`, `item[3]` is random 32-bit integer seed, `item[4]` is aspect ratio enum (`5` = 4:3, `2` = 16:9, `1` = 9:16, `3` = 1:1), `item[5]` is model code (`"GEM_PIX_2"`, `"HARBOR_SEAL"`, or `"BELUGA"`), `item[7][5]` is `projectId`, `item[7][10][0]` is the reCAPTCHA Enterprise token, and `item[8][0][0][0]` is the prompt string.
- reCAPTCHA Enterprise gate: Flow loads `https://www.google.com/recaptcha/enterprise.js?trustedtypes=true&render=6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV` and attaches a single-use browser-minted token at `args[1][i][7][10][0]` and `args[3][10][0]`. Standalone API replay without a live browser-minted token returns HTTP 200 with RPC error `7 PUBLIC_ERROR_UNUSUAL_ACTIVITY`.
- Therefore, always route `generate-image` to `flow:browser-generate-image` so the browser executes `grecaptcha.enterprise.execute(...)` natively upon clicking submit.

## Browser Branch
1. Open `/project/<projectId>` (`flow:open-project`) and configure model/aspect/count if needed (`flow:configure-generation`). If `button[aria-label="Xoá câu lệnh"]` is present from a prior prompt, click it first to clear old text and reference chips. If any failed generation cards (`flow-error-tile`) exist in the grid, click `flow-error-tile button:nth-of-type(3)` (`Xoá`, `RPC cz8Z4b`) to clean them up.
2. If attaching 1–5 reference images (max 5): for each reference image, click `button[aria-label="Thêm thành phần vào ô nhập câu lệnh"]` (`flow-add-menu button`), re-inspect `flow-add-menu-asset-list` buttons in `flow-add-menu-popover-content` (match by the asset's renamed title), and click the desired asset button (which auto-inserts a chip into `flow-ingredient-bar` and closes the popover). Verify chip count (`1..5`) via `studio_extract({ selector: "flow-ingredient-chip" })`.
3. Click the `flow-rich-text-editor` selector first (`studio_click`), then call `studio_fill` with `parameter: "prompt"`. When combining multiple reference images, explicitly describe which subject/character, prop/accessory, and background/style come from each reference image and how they interact.
4. Inspect and click the submit button (`flow-generate-icon-button button`, `aria-label="Bắt đầu tạo"`) once.
5. Poll `studio_network` with `{ rpcId: "ogiZ0b" }` (`session.readRpcResult("ogiZ0b")`) or `extractRpcSummary("ogiZ0b", entry)` in `api-client.mjs` to extract ONLY the target fields from both `request` (`count`, `modelCode`, `aspectRatioCode`, `referenceImageIds`, `prompt`, `hasRecaptchaToken`) and `response` (`ok`, `count`, `items[{ id, workflowId, url }]`, `errorCode`) without reading unrelated HAR entries, raw `f.req` strings, or full page text.

## Success Criteria
- `ogiZ0b` summary returns `ok: true` with `request` matching target options (`count`, `modelCode`, `aspectRatioCode`, `referenceImageIds`) and `response` containing the generated image `id`/`workflowId`/`url` items (no `errorCode: 7` CAPTCHA rejection).

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

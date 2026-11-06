---
name: flow:api-generate-image
description: "Execute \"Generate images in a Flow project (with optional 1-5 reference images)\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-generate-image

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `blocked`; CAPTCHA: `required`. Browser UI natively mints reCAPTCHA Enterprise token (sitekey 6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV) and succeeds; standalone API returns RPC 7 PUBLIC_ERROR_UNUSUAL_ACTIVITY.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-generate-image](../flow-browser-generate-image/SKILL.md) or refresh auth first.

Inputs: `projectId` (Target project UUID.); `prompt` (Image generation prompt text (when using 1-5 reference images, explicitly state the role of each reference subject/prop/environment and how they combine).); `referenceImages` (Optional 1 to 5 reference assets (up to 5) selected via `flow-add-menu` (`Thêm thành phần vào ô nhập câu lệnh`) into `flow-ingredient-bar`.); `options` (Optional model (`GEM_PIX_2`, `HARBOR_SEAL`, `BELUGA`), aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`), and count (`x1`–`x4`).).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `ogiZ0b` (params: `params-82e85614`); schema `d16e4c6d8d70` in [API contract](../flow-project/references/api.json).
- Observed RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=ogiZ0b`.
- Payload dependency mapping in `f.req` (`args = JSON.parse(envelope[0][0][1])`): `args[1]` is an array of generation items (length = output count `1..4`); for each item `item = args[1][i]`: `item[2]` is `null` (no references) or an array of 1–5 reference image tuples `[["<assetId1>", null, null, null, 1], ...]`, `item[3]` is random 32-bit integer seed, `item[4]` is aspect ratio enum (`5` = 4:3, `2` = 16:9, `1` = 9:16, `3` = 1:1), `item[5]` is model code (`"GEM_PIX_2"`, `"HARBOR_SEAL"`, or `"BELUGA"`), `item[7][5]` is `projectId`, `item[7][10][0]` is the reCAPTCHA Enterprise token, and `item[8][0][0][0]` is the prompt string.
- reCAPTCHA Enterprise gate: Flow loads `https://www.google.com/recaptcha/enterprise.js?trustedtypes=true&render=6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV` and attaches a single-use browser-minted token at `args[1][i][7][10][0]` and `args[3][10][0]`. Standalone API replay without a live browser-minted token returns HTTP 200 with RPC error `7 PUBLIC_ERROR_UNUSUAL_ACTIVITY`.
- Therefore, always route `generate-image` to `flow:browser-generate-image` so the browser executes `grecaptcha.enterprise.execute(...)` natively upon clicking submit.

Success checks:
- `ogiZ0b` summary returns `ok: true` with `request` matching target options (`count`, `modelCode`, `aspectRatioCode`, `referenceImageIds`) and `response` containing the generated image `id`/`workflowId`/`url` items (no `errorCode: 7` CAPTCHA rejection).

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

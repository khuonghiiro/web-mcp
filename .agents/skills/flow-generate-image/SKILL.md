---
name: flow:generate-image
description: "Submit an image prompt with model/aspect/count options in Flow; uses browser execution because standalone `ogiZ0b` RPC is gated by reCAPTCHA Enterprise (`PUBLIC_ERROR_UNUSUAL_ACTIVITY`)."
---

<!-- web-to-mcp:managed -->
# flow:generate-image

Website: https://flow.google.com/ (exact hostname scope).

## Generate images in a Flow project

Verification: Browser generation verified (1024x1024 image created); standalone API confirmed blocked by reCAPTCHA Enterprise (`PUBLIC_ERROR_UNUSUAL_ACTIVITY`).

## Execution Routing
Default: **browser** — Website verification / reCAPTCHA required; use browser session instead of standalone API.
Call `studio_site_route` with URL and task `generate-image`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-generate-image](../flow-api-generate-image/SKILL.md)
- Browser skill: [flow:browser-generate-image](../flow-browser-generate-image/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `projectId`: Target project UUID.
- `prompt`: Image generation prompt text.
- `options`: Optional model (`GEM_PIX_2`, `HARBOR_SEAL`, `BELUGA`), aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`), and count (`x1`–`x4`).

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `ogiZ0b` (inherits `params-82e85614`); schema `d16e4c6d8d70` in [API contract](../flow-project/references/api.json).
- Observed RPC: POST `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=ogiZ0b`.
- Payload dependency mapping in `f.req` (`args = JSON.parse(envelope[0][0][1])`): `args[1]` is an array of generation items (length = output count `1..4`, or repeated entries per image); for each item `item = args[1][i]`: `item[3]` is random 32-bit integer seed, `item[4]` is aspect ratio enum (`1` = 1:1 square observed), `item[5]` is model code (`"GEM_PIX_2"`, `"HARBOR_SEAL"`, or `"BELUGA"`), `item[7][5]` is `projectId`, `item[7][10][0]` is the reCAPTCHA Enterprise token, and `item[8][0][0][0]` is the prompt string.
- reCAPTCHA Enterprise gate: Flow loads `https://www.google.com/recaptcha/enterprise.js?trustedtypes=true&render=6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV` and attaches a single-use browser-minted token at `args[1][i][7][10][0]` and `args[3][10][0]`. Standalone API replay without a live browser-minted token returns HTTP 200 with RPC error `7 PUBLIC_ERROR_UNUSUAL_ACTIVITY`.
- Therefore, always route `generate-image` to `flow:browser-generate-image` so the browser executes `grecaptcha.enterprise.execute(...)` natively upon clicking submit.

## Browser Branch
1. Open `/project/<projectId>` (`flow:open-project`) and configure model/aspect/count if needed (`flow:configure-generation`).
2. Inspect `flow-rich-text-editor` to get the `[contenteditable="true"]` selector, then call `studio_fill` with `parameter: "prompt"` and verify text insertion.
3. Inspect and click the submit button (`flow-generate-icon-button button`, `aria-label="Bắt đầu tạo"`) once.
4. Wait and poll `studio_inspect` / `studio_network` until `ogiZ0b` completes and the generated image card renders in the project grid.

## Success Criteria
- New image card finishes rendering in `/project/<projectId>` matching the requested prompt and count, with no RPC 7 error banner.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

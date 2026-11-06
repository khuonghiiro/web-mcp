---
name: flow:browser-generate-image
description: "Execute \"Generate images in a Flow project\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-generate-image

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `projectId` (Target project UUID.); `prompt` (Image generation prompt text.); `options` (Optional model (`GEM_PIX_2`, `HARBOR_SEAL`, `BELUGA`), aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`), and count (`x1`–`x4`).).

1. Open `/project/<projectId>` (`flow:open-project`) and configure model/aspect/count if needed (`flow:configure-generation`).
2. Inspect `flow-rich-text-editor` to get the `[contenteditable="true"]` selector, then call `studio_fill` with `parameter: "prompt"` and verify text insertion.
3. Inspect and click the submit button (`flow-generate-icon-button button`, `aria-label="Bắt đầu tạo"`) once.
4. Wait and poll `studio_inspect` / `studio_network` until `ogiZ0b` completes and the generated image card renders in the project grid.

Success checks:
- New image card finishes rendering in `/project/<projectId>` matching the requested prompt and count, with no RPC 7 error banner.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

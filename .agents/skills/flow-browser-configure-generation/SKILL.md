---
name: flow:browser-configure-generation
description: "Execute \"Configure image/video model and dependent options\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-configure-generation

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `mode` (`image` or `video`.); `model` (Image model (`Nano Banana Pro` / `GEM_PIX_2`, `Nano Banana 2 Lite` / `HARBOR_SEAL`, `Nano Banana 2.1` / `BELUGA`) or Video model (`Omni 1.1 Flash` / `abra`, `Veo 3.1 - Lite` / `veo_3_1_lite`, `Veo 3.1 - Fast` / `veo_3_1_fast`, `Veo 3.1 - Quality` / `veo_3_1_quality`).); `options` (Dependent parameters: Image supports aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`) and count (`x1`..`x4`, 0 credits). Video supports sub-mode (`Frames` vs `Ingredients`), aspect ratio (`16:9` code `2`, `9:16` code `1`), resolution (`360p` vs `720p` for Omni 1.1 Flash), duration (`4s`/`6s`/`8s`/`10s` for Omni; `4s`/`6s`/`8s` for Veo 3.1), and count (`x1`..`x4`).).

1. Inside `/project/<id>`, click the settings trigger button (`button[aria-label='Điều kiện kích hoạt cài đặt']`) in `flow-base-prompt-box`.
2. Select mode toggle (`imageHình ảnh` or `videocamVideo`) and re-inspect immediately because Angular Material regenerates `mat-button-toggle` IDs and dependent controls.
3. To change model: click `flow-prompt-box-settings button` (`Chọn nhóm mô hình`), inspect overlay menu items, click the desired model, and re-inspect dependent toggles.
4. Select aspect ratio, resolution/duration (if video), and count (`x1`–`x4`). Verify the credit cost label (`flow-credit-cost-label`) and prompt summary chip before closing settings with `Escape`.

Success checks:
- Prompt summary bar reflects the target mode, model, aspect ratio, duration/resolution, and output count `x1`–`x4` without triggering generation.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

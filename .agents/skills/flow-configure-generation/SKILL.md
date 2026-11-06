---
name: flow:configure-generation
description: "Inspect or select generation mode (Image vs Video), model family, and model-dependent options (aspect ratio, output count x1-x4, resolution, duration) before submitting."
---

<!-- web-to-mcp:managed -->
# flow:configure-generation

Website: https://flow.google.com/ (exact hostname scope).

## Configure image/video model and dependent options

Verification: Verified live UI option dependencies and `HTrJv` model catalog on 2026-11-06.

## Execution Routing
Default: **browser** — API is unverified or blocked; use browser UI and capture evidence.
Call `studio_site_route` with URL and task `configure-generation`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [flow:api-configure-generation](../flow-api-configure-generation/SKILL.md)
- Browser skill: [flow:browser-configure-generation](../flow-browser-configure-generation/SKILL.md)
- Expired auth: refresh via [flow:auth](../flow-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `mode`: `image` or `video`.
- `model`: Image model (`Nano Banana Pro` / `GEM_PIX_2`, `Nano Banana 2 Lite` / `HARBOR_SEAL`, `Nano Banana 2.1` / `BELUGA`) or Video model (`Omni 1.1 Flash` / `abra`, `Veo 3.1 - Lite` / `veo_3_1_lite`, `Veo 3.1 - Fast` / `veo_3_1_fast`, `Veo 3.1 - Quality` / `veo_3_1_quality`).
- `options`: Dependent parameters: Image supports aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`) and count (`x1`..`x4`, 0 credits). Video supports sub-mode (`Frames` vs `Ingredients`), aspect ratio (`16:9` code `2`, `9:16` code `1`), resolution (`360p` vs `720p` for Omni 1.1 Flash), duration (`4s`/`6s`/`8s`/`10s` for Omni; `4s`/`6s`/`8s` for Veo 3.1), and count (`x1`..`x4`).

## API Branch
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `HTrJv` (inherits `params-82e85614`); schema `2a9f2d20c2fe` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `yBhWQ` (inherits `params-82e85614`); schema `ffa8dd24e47b` in [API contract](../flow-project/references/api.json).
- Changing settings in the UI mutates local Angular state without firing a save RPC; options are sent inside the generation RPC payload upon submission.
- Use `node .agents/skills/flow-project/references/api-client.mjs get-models` (`HTrJv` / `yBhWQ`) to query the exact server-side dependency matrix (valid variant codes, supported aspect ratios, durations, max counts, and credit cost per variant) before constructing API payloads or driving UI.

## Browser Branch
1. Inside `/project/<id>`, click the settings trigger button (`button[aria-label='Điều kiện kích hoạt cài đặt']`) in `flow-base-prompt-box`.
2. Select mode toggle (`imageHình ảnh` or `videocamVideo`) and re-inspect immediately because Angular Material regenerates `mat-button-toggle` IDs and dependent controls.
3. To change model: click `flow-prompt-box-settings button` (`Chọn nhóm mô hình`), inspect overlay menu items, click the desired model, and re-inspect dependent toggles.
4. Select aspect ratio, resolution/duration (if video), and count (`x1`–`x4`). Verify the credit cost label (`flow-credit-cost-label`) and prompt summary chip before closing settings with `Escape`.

## Success Criteria
- Prompt summary bar reflects the target mode, model, aspect ratio, duration/resolution, and output count `x1`–`x4` without triggering generation.

Reviewed task source: [tasks.json](../flow-project/references/tasks.json).

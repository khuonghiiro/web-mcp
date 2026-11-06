---
name: flow:api-configure-generation
description: "Execute \"Configure image/video model and dependent options\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-configure-generation

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `observed`; CAPTCHA: `not-observed`. 2026-11-06: HTrJv RPC provides full model dependency catalog; UI setting toggles update client state before generation submit.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-configure-generation](../flow-browser-configure-generation/SKILL.md) or refresh auth first.

Inputs: `mode` (`image` or `video`.); `model` (Image model (`Nano Banana Pro` / `GEM_PIX_2`, `Nano Banana 2 Lite` / `HARBOR_SEAL`, `Nano Banana 2.1` / `BELUGA`) or Video model (`Omni 1.1 Flash` / `abra`, `Veo 3.1 - Lite` / `veo_3_1_lite`, `Veo 3.1 - Fast` / `veo_3_1_fast`, `Veo 3.1 - Quality` / `veo_3_1_quality`).); `options` (Dependent parameters: Image supports aspect ratio (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`) and count (`x1`..`x4`, 0 credits). Video supports sub-mode (`Frames` vs `Ingredients`), aspect ratio (`16:9` code `2`, `9:16` code `1`), resolution (`360p` vs `720p` for Omni 1.1 Flash), duration (`4s`/`6s`/`8s`/`10s` for Omni; `4s`/`6s`/`8s` for Veo 3.1), and count (`x1`..`x4`).).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `HTrJv` (params: `params-82e85614`); schema `2a9f2d20c2fe` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `yBhWQ` (params: `params-82e85614`); schema `ffa8dd24e47b` in [API contract](../flow-project/references/api.json).
- Changing settings in the UI mutates local Angular state without firing a save RPC; options are sent inside the generation RPC payload upon submission.
- Use `node .agents/skills/flow-project/references/api-client.mjs get-models` (`HTrJv` / `yBhWQ`) to query the exact server-side dependency matrix (valid variant codes, supported aspect ratios, durations, max counts, and credit cost per variant) before constructing API payloads or driving UI.

Success checks:
- Prompt summary bar reflects the target mode, model, aspect ratio, duration/resolution, and output count `x1`–`x4` without triggering generation.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

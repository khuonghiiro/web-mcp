---
name: flow:api-download-image
description: "Execute \"Download image at 1K, 2K, or 4K resolution\" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# flow:api-download-image

Website: https://flow.google.com/ (exact hostname scope).

Mode: API. Status: `verified`; CAPTCHA: `not-observed`. 2026-11-06: 1K download verified standalone via as29s in api-client.mjs; 1K, 2K, and 4K download flows verified live in browser editor.
Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).

Bootstrap: [flow:auth](../flow-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [flow:browser-download-image](../flow-browser-download-image/SKILL.md) or refresh auth first.

Inputs: `assetId` (Target image asset UUID.); `resolution` (`1K` (original size, instant API or browser download), `2K` (upsampled via `GEM_PIX_2_UPSAMPLE_2K`), or `4K` (upsampled via `GEM_PIX_2_UPSAMPLE_4K`).); `outputPath` (Local file path when downloading via `api-client.mjs`.).

- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `ogiZ0b` (params: `params-82e85614`); schema `d16e4c6d8d70` in [API contract](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute` RPC `as29s` (params: `params-82e85614`); schema `8b98caf8cb61` in [API contract](../flow-project/references/api.json).
- For `1K` original resolution (no CAPTCHA): run `node .agents/skills/flow-project/references/api-client.mjs download-asset --id <assetId> --out <outputPath>` or call `downloadAsset1K({ assetId, outputPath })`.
- Underlying RPC: `POST /_/AiSandboxAngularFrontend/data/batchexecute?rpcids=as29s` with args `["<assetId>"]` returns dimensions at `data[6][2]` (e.g. `[1200, 896]`) and a fresh signed `https://flow-content.google/image/<assetId>?...` download URL at `data[5][10]` / `data[6][0][13]`.
- For `2K` and `4K` upsampling: Flow invokes upsample models `GEM_PIX_2_UPSAMPLE_2K` (enum `26`) and `GEM_PIX_2_UPSAMPLE_4K` (enum `27`), which require a browser-minted reCAPTCHA Enterprise token; use `flow:browser-download-image` for `2K`/`4K`.

Success checks:
- `1K` file is saved to `outputPath` via API (`bytes > 0`) or browser triggers `1K`/`2K`/`4K` download toast without error.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

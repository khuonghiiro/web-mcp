---
name: flow:project
description: "Route flow.google.com tasks between reusable local API execution and browser UI workflows."
---

<!-- web-to-mcp:managed -->
# flow:project

Website: https://flow.google.com/ (exact hostname scope).

Namespace `flow:*` provides task-specific API and browser skills for `flow.google.com`.

- [flow:auth](../flow-auth/SKILL.md): Initialize or refresh local authentication for flow.google.com; use on fresh clones or expired sessions.
- [flow:api](../flow-api/SKILL.md): Inspect endpoints, inherited parameter groups, and reusable API execution for flow.google.com.
- [flow:browse](../flow-browse/SKILL.md): Operate flow.google.com directly in the logged-in browser when UI mode is requested or API is gated by CAPTCHA.
- [flow:list-projects](../flow-list-projects/SKILL.md): List and filter projects on flow.google.com via verified local API or browser UI before selecting a target project.
- [flow:api-list-projects](../flow-api-list-projects/SKILL.md): Execute "List Flow projects" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-list-projects](../flow-browser-list-projects/SKILL.md): Execute "List Flow projects" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:create-project](../flow-create-project/SKILL.md): Create a new project on flow.google.com via verified API (`jHPbke`) or browser UI, with support for follow-up renaming (`o8DA4`).
- [flow:api-create-project](../flow-api-create-project/SKILL.md): Execute "Create a Flow project" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-create-project](../flow-browser-create-project/SKILL.md): Execute "Create a Flow project" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:rename-project](../flow-rename-project/SKILL.md): Reusable task to rename any Flow project by ID via verified API (`o8DA4`) or the project header editable input.
- [flow:api-rename-project](../flow-api-rename-project/SKILL.md): Execute "Rename an existing Flow project" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-rename-project](../flow-browser-rename-project/SKILL.md): Execute "Rename an existing Flow project" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:open-project](../flow-open-project/SKILL.md): Load a Flow project's metadata, scene/asset state, and model catalog via API (`ngNC2`, `Zzl0ze`, `HTrJv`) or open the project workspace in browser UI.
- [flow:api-open-project](../flow-api-open-project/SKILL.md): Execute "Open and inspect a Flow project" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-open-project](../flow-browser-open-project/SKILL.md): Execute "Open and inspect a Flow project" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:configure-generation](../flow-configure-generation/SKILL.md): Inspect or select generation mode (Image vs Video), model family, and model-dependent options (aspect ratio, output count x1-x4, resolution, duration) before submitting.
- [flow:api-configure-generation](../flow-api-configure-generation/SKILL.md): Execute "Configure image/video model and dependent options" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-configure-generation](../flow-browser-configure-generation/SKILL.md): Execute "Configure image/video model and dependent options" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:generate-image](../flow-generate-image/SKILL.md): Submit an image prompt with model/aspect/count options and optional 1-5 reference images (ingredients) in Flow; uses browser execution because standalone `ogiZ0b` RPC is gated by reCAPTCHA Enterprise (`PUBLIC_ERROR_UNUSUAL_ACTIVITY`).
- [flow:api-generate-image](../flow-api-generate-image/SKILL.md): Execute "Generate images in a Flow project (with optional 1-5 reference images)" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-generate-image](../flow-browser-generate-image/SKILL.md): Execute "Generate images in a Flow project (with optional 1-5 reference images)" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:rename-asset](../flow-rename-asset/SKILL.md): Rename an image or video asset (`metadata.display_name`) or move it to trash (`metadata.archived`) via verified API (`mYWVGd` + `as29s`) or the asset detail editor header (`flow-editor-header`).
- [flow:api-rename-asset](../flow-api-rename-asset/SKILL.md): Execute "Rename or trash an image/video asset" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-rename-asset](../flow-browser-rename-asset/SKILL.md): Execute "Rename or trash an image/video asset" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:download-image](../flow-download-image/SKILL.md): Download a generated image at `1K` original resolution via verified API (`as29s` signed URL) or browser UI, or trigger `2K`/`4K` upsampled downloads via browser UI (`GEM_PIX_2_UPSAMPLE_2K` / `GEM_PIX_2_UPSAMPLE_4K`).
- [flow:api-download-image](../flow-api-download-image/SKILL.md): Execute "Download image at 1K, 2K, or 4K resolution" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-download-image](../flow-browser-download-image/SKILL.md): Execute "Download image at 1K, 2K, or 4K resolution" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.
- [flow:find-assets](../flow-find-assets/SKILL.md): Search and filter generated images, videos, scenes, and characters inside a Flow project workspace.
- [flow:api-find-assets](../flow-api-find-assets/SKILL.md): Execute "Search and filter project assets" via flow.google.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [flow:browser-find-assets](../flow-browser-find-assets/SKILL.md): Execute "Search and filter project assets" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.

Fresh clone or expired auth: start with [flow:auth](../flow-auth/SKILL.md). Shared contracts: [API & parameter groups](references/api.json), [UI workflows](references/browser.json), [compact session index](references/observations.json). Local credentials/captures: `artifacts/flow.google.com/<session>/`.

When adding captures, use a new session name; the generator merges endpoints, deduplicates shared parameters into `parameterGroups`, and keeps `observations.json` compact. Update `references/tasks.json` only with verified evidence and run `knowledge --name <session> --domain flow.google.com`.
Read [verified notes](references/notes.md) for curated domain details.

Read [product and configuration map](references/product-map.md) for feature scope and dependent options.

Reusable local API runner: `node .agents/skills/flow-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/flow.google.com/<latest-session>/` automatically).


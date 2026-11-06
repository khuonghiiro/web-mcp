---
name: flow:browser-open-project
description: "Execute \"Open and inspect a Flow project\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-open-project

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `projectId` (Project UUID or title from `flow:list-projects`.).

1. From `flow:list-projects`, click the project link `a[href="/project/<projectId>"]`.
2. Poll `studio_inspect` until `url` is `/project/<projectId>` and the prompt editor (`flow-rich-text-editor`) is rendered (navigation is asynchronous).
3. If a changelog modal (`flow-change-log-modal`) appears, dismiss it before interacting with workspace controls.

Success checks:
- API returns decoded project metadata/state, or browser reaches `/project/<projectId>` with prompt editor ready and no blocking modal.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

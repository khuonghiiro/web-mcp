---
name: flow:browser-create-project
description: "Execute \"Create a Flow project\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-create-project

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `name` (Desired project title (mapped to `args[1][1][0]` in `jHPbke`, or applied via `flow:rename-project` after UI creation).).

1. On `https://flow.google.com/`, inspect and click the new project button (`button[aria-label='addDự án mới']` or localized equivalent) once.
2. Wait and re-inspect until URL transitions to `/project/<id>`.
3. If UI creates a default timestamp name and a custom `name` was requested, either call `flow:api-rename-project` with the new `<id>` or edit `flow-editable-text input` in the header and press `Enter`.

Success checks:
- Returns the new `projectId` and `/project/<id>` URL confirmed by API response or list check.
- Project title matches requested `name`.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

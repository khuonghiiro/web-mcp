---
name: flow:browser-rename-project
description: "Execute \"Rename an existing Flow project\" via flow.google.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# flow:browser-rename-project

Website: https://flow.google.com/ (exact hostname scope).

Mode: Web Browser. Status: `verified`. Attach tab via [flow:auth](../flow-auth/SKILL.md).

Inputs: `projectId` (Target project UUID (e.g. from `create-project` or `list-projects`).); `name` (New project title.).

1. Inside `/project/<projectId>`, inspect header for `flow-editable-text input`.
2. Click the input, fill with `name`, and press `Enter` (`studio_press` with `key: 'Enter'`).
3. Re-inspect header title to confirm the new name is committed.

Success checks:
- API `wrb.fr` payload returns `[name]` or UI header reflects the updated title.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

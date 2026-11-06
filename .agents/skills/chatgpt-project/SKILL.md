---
name: chatgpt:project
description: "Route chatgpt.com tasks between reusable local API execution and browser UI workflows."
---

<!-- web-to-mcp:managed -->
# chatgpt:project

Website: https://chatgpt.com/ (exact hostname scope).

Namespace `chatgpt:*` provides task-specific API and browser skills for `chatgpt.com`.

- [chatgpt:auth](../chatgpt-auth/SKILL.md): Initialize or refresh local authentication for chatgpt.com; use on fresh clones or expired sessions.
- [chatgpt:api](../chatgpt-api/SKILL.md): Inspect endpoints, inherited parameter groups, and reusable API execution for chatgpt.com.
- [chatgpt:browse](../chatgpt-browse/SKILL.md): Operate chatgpt.com directly in the logged-in browser when UI mode is requested or API is gated by CAPTCHA.
- [chatgpt:search-history](../chatgpt-search-history/SKILL.md): Search existing conversations on chatgpt.com via the search modal UI or observed backend API without sending a new chat prompt.
- [chatgpt:api-search-history](../chatgpt-api-search-history/SKILL.md): Execute "Search conversation history" via chatgpt.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session.
- [chatgpt:browser-search-history](../chatgpt-browser-search-history/SKILL.md): Execute "Search conversation history" via chatgpt.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested.

Fresh clone or expired auth: start with [chatgpt:auth](../chatgpt-auth/SKILL.md). Shared contracts: [API & parameter groups](references/api.json), [UI workflows](references/browser.json), [compact session index](references/observations.json). Local credentials/captures: `artifacts/chatgpt.com/<session>/`.

When adding captures, use a new session name; the generator merges endpoints, deduplicates shared parameters into `parameterGroups`, and keeps `observations.json` compact. Update `references/tasks.json` only with verified evidence and run `knowledge --name <session> --domain chatgpt.com`.
Reusable local API runner: `node .agents/skills/chatgpt-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/chatgpt.com/<latest-session>/` automatically).


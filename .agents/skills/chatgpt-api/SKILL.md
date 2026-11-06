---
name: chatgpt:api
description: "Inspect endpoints, inherited parameter groups, and reusable API execution for chatgpt.com."
---

<!-- web-to-mcp:managed -->
# chatgpt:api

Website: https://chatgpt.com/ (exact hostname scope).

Read [chatgpt:auth](../chatgpt-auth/SKILL.md) if local auth is missing or expired. Read [API contract](../chatgpt-project/references/api.json); endpoints inherit shared query/header/form parameters via `parameterGroup` from `parameterGroups` to avoid duplicate definitions.
Reusable local API runner: `node .agents/skills/chatgpt-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/chatgpt.com/<latest-session>/` automatically).

- `localOnly` / `local-credential`: values must be loaded from the latest local session under `artifacts/chatgpt.com/`, never from Git.
- `tuple`: positional array elements; `decodedJson`: nested JSON encoded inside a string. Send concrete payload values, not schema objects.
- `required: unknown`: single-capture observation does not prove required status.
- Check task skills in [skills.json](../chatgpt-project/references/skills.json) for verified parameter positions, dependent configurations (e.g., model vs count/aspect/duration), and reusable follow-up calls.
- On auth expiry, switch to [chatgpt:auth](../chatgpt-auth/SKILL.md) to refresh cookies/tokens from the browser. On CAPTCHA / `PUBLIC_ERROR_UNUSUAL_ACTIVITY`, switch to the task's browser skill.

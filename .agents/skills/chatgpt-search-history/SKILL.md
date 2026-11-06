---
name: chatgpt:search-history
description: "Search existing conversations on chatgpt.com via the search modal UI or observed backend API without sending a new chat prompt."
---

<!-- web-to-mcp:managed -->
# chatgpt:search-history

Website: https://chatgpt.com/ (exact hostname scope).

## Search conversation history

Verification: Recorded UI workflow and `POST /backend-api/global/search` contract; re-verify live token before standalone API calls.

## Execution Routing
Default: **browser** — API is unverified or blocked; use browser UI and capture evidence.
Call `studio_site_route` with URL and task `search-history`. Use API directly when `api=verified` and `captcha=not-observed`; use browser when CAPTCHA/verification is required or when the user requests UI.
- API skill: [chatgpt:api-search-history](../chatgpt-api-search-history/SKILL.md)
- Browser skill: [chatgpt:browser-search-history](../chatgpt-browser-search-history/SKILL.md)
- Expired auth: refresh via [chatgpt:auth](../chatgpt-auth/SKILL.md). Ambiguous write: inspect UI before retrying.

Inputs:
- `query`: Keyword to search in conversation history.
- `limit`: Maximum number of results to return (default 10).

## API Branch
- `POST https://chatgpt.com/backend-api/global/search` (inherits `params-766a8658`); schema `c922bbde244b` in [API contract](../chatgpt-project/references/api.json).
- Run `node .agents/skills/chatgpt-project/references/api-client.mjs search-history --query "<keyword>" [--limit 10]` or import `searchHistory({ query, limit })` from `api-client.mjs`.
- Underlying endpoint: `POST /backend-api/global/search` with JSON body `{ entrypoint, limit, query, source_requests, cursor, query_id }` and shared auth headers (`parameterGroup` in `api.json`).
- Loads local cookies and `Authorization: Bearer ...` from the newest local capture under `artifacts/chatgpt.com/`. If auth is expired (`401`/`403`) or Cloudflare challenge appears, switch to `chatgpt:auth` or `chatgpt:browser-search-history`.

## Browser Branch
1. Inspect the sidebar on `https://chatgpt.com/` and locate the search history control (do not click new chat).
2. Click the search control, inspect the dialog for `[role="dialog"] input[role="combobox"]`, and call `studio_fill` with `parameter: "query"`.
3. Wait for `[role="dialog"] [role="listbox"]` and extract matching conversation titles/links with `studio_extract`.

## Success Criteria
- Returns matching conversation titles and URLs (or explicit empty-result state) without submitting a new chat message.

Reviewed task source: [tasks.json](../chatgpt-project/references/tasks.json).

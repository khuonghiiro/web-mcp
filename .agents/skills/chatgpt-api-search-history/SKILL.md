---
name: chatgpt:api-search-history
description: "Execute \"Search conversation history\" via chatgpt.com API using local auth/cookies; fallback to browser on CAPTCHA or expired session."
---

<!-- web-to-mcp:managed -->
# chatgpt:api-search-history

Website: https://chatgpt.com/ (exact hostname scope).

Mode: API. Status: `observed`; CAPTCHA: `unknown`. Recorded browser workflow and associated backend search request; reusable helper provided in api-client.mjs.
Reusable local API runner: `node .agents/skills/chatgpt-project/references/api-client.mjs` (loads local cookies/auth tokens from `artifacts/chatgpt.com/<latest-session>/` automatically).

Bootstrap: [chatgpt:auth](../chatgpt-auth/SKILL.md). If API is unverified, blocked by CAPTCHA, or auth is expired, switch to [chatgpt:browser-search-history](../chatgpt-browser-search-history/SKILL.md) or refresh auth first.

Inputs: `query` (Keyword to search in conversation history.); `limit` (Maximum number of results to return (default 10).).

- `POST https://chatgpt.com/backend-api/global/search` (params: `params-766a8658`); schema `c922bbde244b` in [API contract](../chatgpt-project/references/api.json).
- Run `node .agents/skills/chatgpt-project/references/api-client.mjs search-history --query "<keyword>" [--limit 10]` or import `searchHistory({ query, limit })` from `api-client.mjs`.
- Underlying endpoint: `POST /backend-api/global/search` with JSON body `{ entrypoint, limit, query, source_requests, cursor, query_id }` and shared auth headers (`parameterGroup` in `api.json`).
- Loads local cookies and `Authorization: Bearer ...` from the newest local capture under `artifacts/chatgpt.com/`. If auth is expired (`401`/`403`) or Cloudflare challenge appears, switch to `chatgpt:auth` or `chatgpt:browser-search-history`.

Success checks:
- Returns matching conversation titles and URLs (or explicit empty-result state) without submitting a new chat message.

Never forge or replay CAPTCHA tokens. On ambiguous mutation responses, verify UI state before retrying.

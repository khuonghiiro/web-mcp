---
name: chatgpt:browser-search-history
description: "Execute \"Search conversation history\" via chatgpt.com browser UI; use when CAPTCHA is required, API is unverified, or UI is requested."
---

<!-- web-to-mcp:managed -->
# chatgpt:browser-search-history

Website: https://chatgpt.com/ (exact hostname scope).

Mode: Web Browser. Status: `observed`. Attach tab via [chatgpt:auth](../chatgpt-auth/SKILL.md).

Inputs: `query` (Keyword to search in conversation history.); `limit` (Maximum number of results to return (default 10).).

1. Inspect the sidebar on `https://chatgpt.com/` and locate the search history control (do not click new chat).
2. Click the search control, inspect the dialog for `[role="dialog"] input[role="combobox"]`, and call `studio_fill` with `parameter: "query"`.
3. Wait for `[role="dialog"] [role="listbox"]` and extract matching conversation titles/links with `studio_extract`.

Success checks:
- Returns matching conversation titles and URLs (or explicit empty-result state) without submitting a new chat message.

During discovery: compare before/after UI snapshots and network deltas around each step. Do not repeat mutations blindly.

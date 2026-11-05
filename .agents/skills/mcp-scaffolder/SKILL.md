---
name: mcp-scaffolder
description: Generate and validate an independent stdio MCP server from website evidence.
---

Read the exact site's registered skill first. Use src/generator/runtime.ts as the SDK reference. Register tools with McpServer.registerTool, validate with Zod and connect StdioServerTransport. Keep authentication in external local files. Compile the generated project and call tools through Client/StdioClientTransport; tests/e2e.ts is a working fixture.

Resolve captures through src/storage/artifacts.ts, including --domain when names collide. Do not confuse observed endpoints with verified executable workflows. Reuse namespace knowledge without overwriting manual notes.

Keep committed launchers portable. Generate client configuration on the user's machine via scripts/client-config.mjs; machine-specific absolute paths belong only in generated local configuration, never shared settings.

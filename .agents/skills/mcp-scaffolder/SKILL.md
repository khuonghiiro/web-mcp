---
name: mcp-scaffolder
description: Generate and validate an independent stdio MCP server.
---

Use src/generator/runtime.ts as the complete SDK reference. Register tools with McpServer.registerTool, validate with Zod and connect StdioServerTransport. Keep authentication in external files. Compile the generated project and call its tools through Client/StdioClientTransport. Consult tests/e2e.ts for a working example. Include a client configuration with an absolute executable entrypoint.

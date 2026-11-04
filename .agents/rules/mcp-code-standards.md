# MCP conventions

Use strict TypeScript and Zod inputs. Give each tool a unique deterministic name and method/path description. Return errors through isError; reserve stdout for MCP protocol. Bound requests and response sizes. Scope credentials to exact API origins, match cookie scope, and reject redirects. Never embed session secrets in generated code. Test generated compilation and real stdio calls.

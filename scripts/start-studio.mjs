import { existsSync } from 'node:fs';
const entry = new URL('../dist/src/studio/index.js', import.meta.url);
if (!existsSync(entry)) {
  console.error('Chưa có bản build MCP Studio. Hãy chạy setup.bat trong thư mục dự án.');
  process.exit(1);
}
// The server derives its default STUDIO_ROOT from its own module location.
await import(entry.href);

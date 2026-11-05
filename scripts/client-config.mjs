import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Generic clients do not share a standard workspace-variable syntax. Resolve on this machine.
const path = resolve(root, 'studio-client-config.json');
writeFileSync(path, JSON.stringify({ mcpServers: { 'web-to-mcp-studio': {
  command: 'node', args: [resolve(root, 'scripts/start-studio.mjs')]
} } }, null, 2) + '\n');
const codexDir = resolve(root, '.codex');
mkdirSync(codexDir, { recursive: true });
const codexPath = resolve(codexDir, 'config.toml');
const existing = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : '';
// Replace only our managed tables; preserve unrelated servers and user settings.
const sections = existing.split(/(?=^\s*\[(?!\[))/m);
const retained = sections.filter(section => !/^\s*\[mcp_servers\.(?:"web_to_mcp_studio"|web_to_mcp_studio)(?:\]|\.)/.test(section)).join('').trimEnd();
const config = `
# Managed by scripts/client-config.mjs. Paths are relative to this .codex folder.
[mcp_servers.web_to_mcp_studio]
command = "node"
args = ["scripts/start-studio.mjs"]
cwd = ".."
startup_timeout_sec = 20
tool_timeout_sec = 120
`;
// Keep regeneration idempotent (including the comment before the managed table).
writeFileSync(codexPath, retained.replace(/\n?# Managed by scripts\/client-config\.mjs\. Paths are relative to this \.codex folder\.$/, '').trimEnd() + '\n' + config);
console.log('Đã cập nhật .codex/config.toml: dùng Node trên PATH và đường dẫn tương đối, không gắn ổ đĩa/máy.');
console.log('Codex: mở project đã tin cậy rồi tải lại MCP/app để nạp các tool studio_*.');
console.log('Client khác: ' + path);
console.log('JSON tương thích dùng đường dẫn tự dò trên máy này; chạy setup.bat hoặc mục 9 để tạo lại sau khi chuyển máy/thư mục.');

#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { projectPath } from '../core.js';
import { scout } from '../scout/browser.js';
import { analyze } from '../analyzer/specGenerator.js';
import { generate } from '../generator/builder.js';
import { importCapture } from '../scout/importCapture.js';
const program = new Command().name('web-to-mcp').description('Capture a website, infer APIs, and generate a standalone MCP server.').version('0.1.0');
function duration(value: string) { const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > 300000) throw new InvalidArgumentError('Must be 0–300000 milliseconds.'); return n; }
for (const name of ['scout', 'analyze', 'generate', 'auto']) {
  const command = program.command(name).requiredOption('--name <name>', 'Project name').option('--artifacts <dir>', 'Capture root', 'artifacts');
  if (name === 'scout' || name === 'auto') command.option('--cdp <endpoint>', 'Kết nối trình duyệt đang mở: chrome, msedge hoặc địa chỉ CDP');
  if (name === 'scout' || name === 'auto') command.requiredOption('--url <url>', 'Target URL').option('--headed', 'Show browser').option('--interactive', 'Wait for Enter after manual browsing').option('--duration <ms>', 'Capture duration', duration, 3000).option('--actions <file>', 'JSON click/fill/wait actions').option('--storage-state <file>', 'Existing Playwright session').option('--channel <browser>', 'Installed browser: chrome or msedge');
  if (name === 'analyze' || name === 'auto') command.option('--origin <url>', 'Analyze this API origin instead of page origin');
  if (name === 'generate' || name === 'auto') command.option('--output <dir>', 'Generated project root', 'generated-mcps');
  command.action(async options => {
    const dir = projectPath(options.artifacts, options.name);
    if (name === 'scout' || name === 'auto') { console.error('Đang thu thập dữ liệu trình duyệt…'); await scout({ ...options, dir }); }
    if (name === 'analyze' || name === 'auto') { const spec = await analyze(dir, options.name, options.origin); console.error(`Đã phân tích ${Object.keys(spec.paths).length} đường dẫn API.`); }
    if (name === 'generate' || name === 'auto') console.error('Đã tạo MCP tại: ' + await generate(dir, options.name, options.output));
    console.error('Hoàn tất.');
  });
}
program.command('import').description('Nhập dữ liệu do tiện ích trình duyệt xuất ra')
  .requiredOption('--name <name>', 'Tên dự án').requiredOption('--file <path>', 'File .web-mcp.json')
  .option('--artifacts <dir>', 'Thư mục dữ liệu', 'artifacts')
  .action(async options => { await importCapture(options.file, projectPath(options.artifacts, options.name)); console.error('Đã nhập dữ liệu. Chọn Phân tích rồi Tạo MCP để tiếp tục.'); });
program.parseAsync().catch(error => { console.error('Lỗi: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; });

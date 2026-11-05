#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { resolve, join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { scout } from '../scout/browser.js';
import { analyze } from '../analyzer/specGenerator.js';
import { generate } from '../generator/builder.js';
import { readCapture, storeCapture } from '../scout/importCapture.js';
import { artifactPath, resolveArtifact, migrateArtifacts, captureTarget, siteDomain, exists } from '../storage/artifacts.js';
import { syncSiteKnowledge, siteGuide } from '../knowledge/sites.js';
const program = new Command().name('web-to-mcp').description('Capture by domain, maintain website skills, and generate MCP servers.').version('0.1.0');
function duration(value: string) { const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > 300000) throw new InvalidArgumentError('Must be 0–300000 milliseconds.'); return n; }
for (const name of ['scout', 'analyze', 'generate', 'auto']) {
  const command = program.command(name).requiredOption('--name <name>', 'Tên phiên').option('--artifacts <dir>', 'Gốc dữ liệu', 'artifacts').option('--domain <host>', 'Website để phân biệt các phiên cùng tên').option('--workspace <dir>', 'Workspace chứa .agents', '.');
  if (name === 'scout' || name === 'auto') command.option('--cdp <endpoint>', 'chrome, msedge hoặc địa chỉ CDP');
  if (name === 'scout' || name === 'auto') command.requiredOption('--url <url>', 'Website').option('--headed', 'Show browser').option('--interactive', 'Wait for Enter').option('--duration <ms>', 'Capture duration', duration, 3000).option('--actions <file>', 'JSON actions').option('--storage-state <file>', 'Existing session').option('--channel <browser>', 'chrome or msedge');
  if (name === 'analyze' || name === 'auto') command.option('--origin <url>', 'API origin riêng, không thay domain lưu dữ liệu');
  if (name === 'generate' || name === 'auto') command.option('--output <dir>', 'Generated project root', 'generated-mcps');
  command.action(async options => {
    const dir = options.url ? artifactPath(options.artifacts, options.url, options.name) : await resolveArtifact(options.artifacts, options.name, options.domain);
    if (name === 'scout' || name === 'auto') {
      if (await exists(dir)) throw new Error('Thư mục phiên đã tồn tại. Chọn tên phiên mới để giữ dữ liệu cũ.');
      console.error('Đang thu thập tại: ' + dir); await scout({ ...options, dir });
      await syncSiteKnowledge(options.workspace, dir, options.url);
    }
    if (name === 'analyze' || name === 'auto') { const spec = await analyze(dir, options.name, options.origin); console.error(`Đã phân tích ${Object.keys(spec.paths).length} đường dẫn API.`); }
    if (name === 'generate' || name === 'auto') console.error('Đã tạo MCP tại: ' + await generate(dir, options.name, options.output));
    console.error('Skill/rule: ' + JSON.stringify(await syncSiteKnowledge(options.workspace, dir)));
  });
}
program.command('import').description('Nhập capture và tạo/cập nhật skill theo website')
  .requiredOption('--name <name>', 'Tên phiên').requiredOption('--file <path>', 'File .web-mcp.json')
  .option('--artifacts <dir>', 'Gốc dữ liệu', 'artifacts').option('--workspace <dir>', 'Workspace chứa .agents', '.')
  .action(async options => {
    const data = await readCapture(options.file); const dir = artifactPath(options.artifacts, data.targetUrl, options.name);
    await storeCapture(data, dir, true); const site = await syncSiteKnowledge(options.workspace, dir, data.targetUrl);
    console.error(JSON.stringify({ artifacts: dir, site }));
  });
program.command('site').description('Tra namespace/skill đúng website')
  .requiredOption('--url <url>', 'URL hoặc domain').option('--workspace <dir>', 'Workspace', '.')
  .action(async o => console.log(JSON.stringify(await siteGuide(o.workspace, o.url), null, 2)));
program.command('knowledge').description('Cập nhật skill/rule từ evidence cục bộ; không thao tác trình duyệt')
  .option('--name <name>', 'Tên phiên').option('--domain <host>', 'Website').option('--url <url>', 'URL nếu capture thiếu metadata')
  .option('--all', 'Quét capture đã biết domain; bỏ qua dữ liệu localhost dùng kiểm thử')
  .option('--artifacts <dir>', 'Gốc dữ liệu', 'artifacts').option('--workspace <dir>', 'Workspace', '.')
  .action(async o => {
    if (!o.all) {
      if (!o.name) throw new Error('Cần --name hoặc --all.');
      const dir = await resolveArtifact(o.artifacts, o.name, o.domain);
      console.log(JSON.stringify(await syncSiteKnowledge(o.workspace, dir, o.url))); return;
    }
    const results = [];
    for (const top of await readdir(o.artifacts, { withFileTypes: true })) {
      if (!top.isDirectory() || top.name.startsWith('_') || /^(browsers|tmp|compiled-cli|studio-test-|capture-test-|portable )/.test(top.name)) continue;
      const parent = resolve(o.artifacts, top.name);
      const candidates = [parent, ...(await readdir(parent, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => join(parent, e.name))];
      for (const dir of candidates) {
        const target = await captureTarget(dir);
        if (target && !['localhost', '127.0.0.1', '[::1]'].includes(siteDomain(target))) results.push(await syncSiteKnowledge(o.workspace, dir, target));
      }
    }
    console.log(JSON.stringify(results, null, 2));
  });
program.command('migrate-artifacts').description('Xem trước hoặc chuyển thư mục capture cũ sang artifacts/<domain>/<phiên>')
  .option('--artifacts <dir>', 'Gốc dữ liệu', 'artifacts').option('--apply', 'Thực sự di chuyển; không ghi đè')
  .action(async o => console.log(JSON.stringify(await migrateArtifacts(o.artifacts, !!o.apply), null, 2)));
program.parseAsync().catch(error => { console.error('Lỗi: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; });

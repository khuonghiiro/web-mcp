#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { projectPath } from '../core.js';
import { scout } from '../scout/browser.js';
import { analyze } from '../analyzer/specGenerator.js';
import { generate } from '../generator/builder.js';
const program = new Command().name('web-to-mcp').description('Capture a website, infer APIs, and generate a standalone MCP server.').version('0.1.0');
function duration(value: string) { const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > 300000) throw new InvalidArgumentError('Must be 0–300000 milliseconds.'); return n; }
for (const name of ['scout', 'analyze', 'generate', 'auto']) {
  const command = program.command(name).requiredOption('--name <name>', 'Project name').option('--artifacts <dir>', 'Capture root', 'artifacts');
  if (name === 'scout' || name === 'auto') command.requiredOption('--url <url>', 'Target URL').option('--headed', 'Show browser').option('--interactive', 'Wait for Enter after manual browsing').option('--duration <ms>', 'Capture duration', duration, 3000).option('--actions <file>', 'JSON click/fill/wait actions').option('--storage-state <file>', 'Existing Playwright session').option('--channel <browser>', 'Installed browser: chrome or msedge');
  if (name === 'analyze' || name === 'auto') command.option('--origin <url>', 'Analyze this API origin instead of page origin');
  if (name === 'generate' || name === 'auto') command.option('--output <dir>', 'Generated project root', 'generated-mcps');
  command.action(async options => {
    const dir = projectPath(options.artifacts, options.name);
    if (name === 'scout' || name === 'auto') { console.error('Capturing browser session…'); await scout({ ...options, dir }); }
    if (name === 'analyze' || name === 'auto') { const spec = await analyze(dir, options.name, options.origin); console.error(`Analyzed ${Object.keys(spec.paths).length} API paths.`); }
    if (name === 'generate' || name === 'auto') console.error('Generated: ' + await generate(dir, options.name, options.output));
    console.error('Done.');
  });
}
program.parseAsync().catch(error => { console.error('Error: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; });

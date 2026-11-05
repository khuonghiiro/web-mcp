import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectPath, readJson, writeJson, type Spec } from '../core.js';
import { workflowSchema } from './browser-runtime.js';
import { z } from 'zod';

export async function generate(dir: string, name: string, outputRoot: string) {
  const spec = await readJson(join(dir, 'api-spec.json')) as Spec;
  let workflows: z.infer<typeof workflowSchema>[] = [];
  try { workflows = z.array(workflowSchema).parse(await readJson(join(dir, 'workflows.json'))); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  if (spec.openapi !== '3.0.3' || !spec.servers?.[0]?.url || (!Object.keys(spec.paths ?? {}).length && !workflows.length)) throw new Error('Cần API hoặc quy trình trình duyệt đã khám phá.');
  const output = projectPath(outputRoot, name);
  await mkdir(resolve(outputRoot), { recursive: true });
  await mkdir(output, { recursive: false }); // Never overwrite an existing generated project.
  await mkdir(join(output, 'src'));
  await copyFile(join(dir, 'api-spec.json'), join(output, 'api-spec.json'));
  const runtimePath = fileURLToPath(new URL('./runtime.ts', import.meta.url));
  let runtime: string;
  try { runtime = await readFile(runtimePath, 'utf8'); }
  catch { runtime = await readFile(resolve(fileURLToPath(new URL('../../../', import.meta.url)), 'src/generator/runtime.ts'), 'utf8'); }
  if (workflows.length) {
    await writeJson(join(output, 'workflows.json'), workflows);
    for (const file of ['browser-runtime.ts', 'extension-bridge.ts']) {
      let source: string;
      try { source = await readFile(new URL('./' + file, import.meta.url), 'utf8'); }
      catch { source = await readFile(resolve(fileURLToPath(new URL('../../../', import.meta.url)), 'src/generator', file), 'utf8'); }
      await writeFile(join(output, 'src', file), source);
    }
    runtime = "import { registerBrowserWorkflows } from './browser-runtime.js';\n" + runtime.replace('  await server.connect(new StdioServerTransport());', "  await registerBrowserWorkflows(server, new URL('../workflows.json', import.meta.url));\n  await server.connect(new StdioServerTransport());");
  }
  await writeFile(join(output, 'src/index.ts'), runtime + '\nawait startServer();\n');
  await writeJson(join(output, 'package.json'), { name: name + '-mcp', version: '0.1.0', private: true, type: 'module', scripts: { build: 'tsc', start: 'node dist/index.js' }, engines: { node: '>=22' }, dependencies: { '@modelcontextprotocol/sdk': '^1.26.0', zod: '^3.25.76', ...(workflows.length ? { playwright: '^1.64.1' } : {}) }, devDependencies: { '@types/node': '^24.0.0', typescript: '^5.9.0' } });
  await writeJson(join(output, 'tsconfig.json'), { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, rootDir: 'src', outDir: 'dist' }, include: ['src/**/*.ts'] });
  await writeJson(join(output, 'client-config.json'), { mcpServers: { [name]: { command: 'node', args: [join(output, 'dist/index.js')] } } });
  await writeJson(join(output, 'auth-headers.example.json'), { [spec.servers[0].url]: { Authorization: 'Bearer REPLACE_ME' } });
  await writeFile(join(output, '.gitignore'), 'node_modules/\ndist/\nauth-state.json\nauth-headers.json\n.env\n');
  await writeFile(join(output, 'README.md'), `# ${name} MCP\n\nRun npm install && npm run build in this directory. Import client-config.json into a stdio MCP client.\n\nSet MCP_AUTH_STATE to an absolute Playwright storage-state path to use matching, unexpired cookies. Set MCP_AUTH_HEADERS_FILE to a JSON file mapping exact origins to header objects (see auth-headers.example.json). Bearer and CSRF tokens must be refreshed by the user. LocalStorage is never guessed as a header.\n\nWrites require MCP_ALLOW_WRITES=true. Redirects are rejected to prevent credential forwarding. Requests time out after 30s; responses are limited to 2 MB. Complete CAPTCHA in an interactive Scout session; there is no automatic solver.\n\nThe spec is inferred from observed requests, not a complete API contract. Review paths, schemas, and write operations before use. No captured credentials are copied into this project.\n`);
  if (workflows.length) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(join(output, 'README.md'), '\n## Browser workflows\n\nTools browser_* replay recorded tasks with named input parameters. Connect the Web-to-MCP extension using browser_connect_extension and paste its pairingUrl in the popup, or set MCP_BROWSER_CDP=chrome / msedge / a CDP endpoint. These actions use the logged-in tab and can submit forms; review workflows.json. Login expires normally. Selectors and site behavior can change. Only recorded steps run; this server does not contain an autonomous LLM.\n');
  }
  return output;
}

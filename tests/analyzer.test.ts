import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterHar } from '../src/analyzer/harFilter.js';
import { inferSchema, makeSpec } from '../src/analyzer/specGenerator.js';
import { projectPath } from '../src/core.js';
const entry = (url: string, mimeType = 'application/json') => ({ request: { url, method: 'GET', headers: [{ name: 'Authorization', value: 'Bearer secret' }] }, response: { status: 200, content: { mimeType } } });
test('filter excludes assets and other origins, preserving API requests', () => {
  const har = filterHar({ log: { entries: [entry('https://example.com/api/items?q=secret'), entry('https://example.com/a.png'), entry('https://other.com/api/items')] } }, 'https://example.com');
  assert.equal(har.log.entries.length, 1);
  const spec = makeSpec(har, 'https://example.com', 'test');
  assert.equal(spec.paths['/api/items'].get.parameters[0].name, 'q');
  assert.deepEqual(spec.paths['/api/items'].get['x-auth-headers'], ['authorization']);
  assert.ok(!JSON.stringify(spec).includes('secret'));
});
test('schema inference preserves nested types without declaring unproven required fields', () => {
  assert.deepEqual(inferSchema({ count: 2, nested: { enabled: true }, list: ['x'] }), { type: 'object', properties: { count: { type: 'integer' }, nested: { type: 'object', properties: { enabled: { type: 'boolean' } } }, list: { type: 'array', items: { type: 'string' } } } });
});
test('project names cannot escape output directory', () => {
  for (const name of ['../escape', 'C:\\temp', '.', 'a/b', '']) assert.throws(() => projectPath('artifacts', name));
});
test('multiple observations combine query keys and statuses', () => {
  const har = filterHar({ log: { entries: [entry('https://example.com/api/items?a=1'), entry('https://example.com/api/items?b=2')] } }, 'https://example.com');
  assert.equal(makeSpec(har, 'https://example.com', 'test').paths['/api/items'].get.parameters.length, 2);
});

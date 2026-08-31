import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smoke = path.join(root, '04-工具', 'smoke.mjs');

function runSmoke(env = process.env) {
  return spawnSync(process.execPath, [smoke], {
    cwd: root,
    encoding: 'utf8',
    env,
    timeout: 120_000,
  });
}

test('smoke runs only local fixtures and prints the public pass line', () => {
  const result = runSmoke({
    ...process.env,
    XHS_MCP_URL: 'https://example.invalid/mcp',
    IGNORED_FLAG: 'hello',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS public smoke test/);
});

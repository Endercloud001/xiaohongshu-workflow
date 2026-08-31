import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function runScript(relativePath, env = process.env) {
  return spawnSync(process.execPath, [path.join(root, relativePath)], {
    cwd: root,
    encoding: 'utf8',
    env,
  });
}

assert.equal(packageJson.scripts['check:config'], 'node 04-工具/check-config.mjs');
assert.equal(packageJson.scripts['audit:licenses'], 'node 04-工具/license-audit.mjs');
assert.equal(packageJson.scripts.smoke, 'node 04-工具/smoke.mjs');
assert.equal(packageJson.scripts.test, 'node 04-工具/normalize-image.test.mjs && node 04-工具/normalize-cover.test.mjs && node 04-工具/install-path.test.mjs && node 04-工具/check-config.test.mjs && node 04-工具/smoke.test.mjs && node 04-工具/license-audit.test.mjs && node 04-工具/security-audit.test.mjs');
assert.equal(packageJson.scripts.verify, 'node 04-工具/verify.mjs');
assert.equal(packageJson.scripts.render, 'node 04-工具/render.mjs');

{
  const result = runScript('04-工具/check-config.mjs');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS 基础配置检查通过/);
}

{
  const result = runScript('04-工具/check-config.mjs', {
    ...process.env,
    XHS_MCP_URL: 'not-a-url',
  });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /XHS_MCP_URL/);
}

{
  const result = runScript('04-工具/smoke.mjs');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS public smoke test/);
}

console.log('PASS 安装与最小运行路径自测通过');

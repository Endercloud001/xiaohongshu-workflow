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
assert.equal(packageJson.scripts.smoke, 'node 04-工具/smoke.mjs');

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
  assert.match(result.stdout, /PASS 最小 fixture smoke 通过/);
}

console.log('PASS 安装与最小运行路径自测通过');

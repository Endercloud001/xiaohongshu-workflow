import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

await test('smoke runs only local fixtures and prints the public pass line', () => {
  const result = runSmoke({
    ...process.env,
    XHS_MCP_URL: 'https://example.invalid/mcp',
    IGNORED_FLAG: 'hello',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS public smoke test/);
});

await test('smoke does not add worktree changes', () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'xhs-smoke-clean-'));
  try {
    const clone = path.join(tempRoot, 'repo');
    const cloneResult = spawnSync('git', ['clone', '--local', '--no-hardlinks', root, clone], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.equal(cloneResult.status, 0, cloneResult.stderr || cloneResult.stdout);
    copyFileSync(path.join(root, '04-工具', 'smoke.mjs'), path.join(clone, '04-工具', 'smoke.mjs'));
    copyFileSync(path.join(root, '04-工具', 'render.mjs'), path.join(clone, '04-工具', 'render.mjs'));
    symlinkSync(path.join(root, 'node_modules'), path.join(clone, 'node_modules'), 'junction');

    const beforeStatus = spawnSync('git', ['status', '--porcelain'], {
      cwd: clone,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(beforeStatus.status, 0, beforeStatus.stderr || beforeStatus.stdout);

    const result = spawnSync(process.execPath, ['04-工具/smoke.mjs'], {
      cwd: clone,
      encoding: 'utf8',
      env: {
        ...process.env,
        XHS_MCP_URL: 'https://example.invalid/mcp',
      },
      timeout: 120_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const status = spawnSync('git', ['status', '--porcelain'], {
      cwd: clone,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.equal(status.stdout, beforeStatus.stdout);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

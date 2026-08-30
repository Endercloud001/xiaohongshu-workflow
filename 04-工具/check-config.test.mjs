import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('accepts bracketed IPv6 loopback without accepting external IPv6', () => {
  const local = spawnSync(process.execPath, ['04-工具/check-config.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, XHS_MCP_URL: 'http://[::1]:18060/mcp' },
    encoding: 'utf8',
  });
  assert.equal(local.status, 0, local.stderr);

  const external = spawnSync(process.execPath, ['04-工具/check-config.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, XHS_MCP_URL: 'http://[2001:db8::1]:18060/mcp' },
    encoding: 'utf8',
  });
  assert.equal(external.status, 1);
});

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

test('accepts localhost and IPv4 loopback and rejects credentials or non-HTTP protocols', () => {
  for (const url of ['http://localhost:18060/mcp', 'https://127.0.0.1/mcp']) {
    const result = spawnSync(process.execPath, ['04-工具/check-config.mjs'], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, XHS_MCP_URL: url }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${url}: ${result.stderr}`);
  }
  for (const url of [['http://user:', 'password@localhost:18060/mcp'].join(''), 'ftp://localhost/mcp', 'file:///tmp/mcp']) {
    const result = spawnSync(process.execPath, ['04-工具/check-config.mjs'], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, XHS_MCP_URL: url }, encoding: 'utf8',
    });
    assert.equal(result.status, 1, url);
  }
});

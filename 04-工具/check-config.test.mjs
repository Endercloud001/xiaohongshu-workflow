import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  validatePublicFileNames,
  validateRunYaml,
  validateTrackedPaths,
} from './check-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, '04-工具', 'check-config.mjs');

function runConfig(env = process.env) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env,
  });
}

test('validateRunYaml accepts the slim manual publish shape', () => {
  const yaml = [
    'run: 20260831-selftest',
    'topic: smoke fixture',
    'profile_version: 1',
    'mode: 探索',
    'domain: test',
    'workflow_mode: slim_manual_publish',
    'research_backend: none',
    'nodes:',
    '  - id: research',
    '    status: ok',
    '    tool: local-fixture',
    '    retries: 0',
    'topic_gate:',
    '  status: go',
    '  total: 10',
    '  rounds: 0',
    'visual_router:',
    '  mode: manual',
    '  cover_skill: cover-anchor-system',
    '  inner_skill: xhs-visual-director',
    '  fallback_skill: guizang-social-card-skill',
    'visual_gate:',
    '  status: pass',
    '  fallback_pages: []',
    'publish:',
    '  mode: manual_only',
    '  status: archived_only',
    '  note_url: null',
    'confirmations: []',
    'degradations: []',
  ].join('\n');
  assert.deepEqual(validateRunYaml(yaml), []);
});

test('validateRunYaml accepts the checked-in public fixtures', async () => {
  const fixturePaths = [
    path.join(root, '06-产出', '00000000-selftest', 'run.yaml'),
    path.join(root, '06-产出', '00000000-verify-fixture', 'run.yaml'),
  ];

  for (const fixturePath of fixturePaths) {
    const yaml = await readFile(fixturePath, 'utf8');
    assert.deepEqual(validateRunYaml(yaml, path.relative(root, fixturePath)), []);
  }
});

test('validateRunYaml rejects missing core fields', () => {
  const errors = validateRunYaml('run: demo\n');
  assert.match(errors.join('\n'), /缺少 topic/);
  assert.match(errors.join('\n'), /缺少 nodes/);
});

test('validatePublicFileNames rejects non-English filenames', () => {
  const errors = validatePublicFileNames(['06-产出/00000000-selftest/封面.png'], '06-产出/00000000-selftest');
  assert.match(errors.join('\n'), /英文安全文件名/);
});

test('validateTrackedPaths rejects the real account and archive files', () => {
  const errors = validateTrackedPaths(['01-账号/账号档案.md', '05-验收/已发档案.jsonl']);
  assert.match(errors.join('\n'), /真实账号档案/);
  assert.match(errors.join('\n'), /真实归档/);
});

test('check-config passes on the repo and reports invalid MCP URLs', () => {
  const ok = runConfig();
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /PASS 基础配置检查通过/);

  const bad = runConfig({
    ...process.env,
    XHS_MCP_URL: 'not-a-url',
  });
  assert.equal(bad.status, 1, bad.stderr || bad.stdout);
  assert.match(bad.stderr, /XHS_MCP_URL/);
});

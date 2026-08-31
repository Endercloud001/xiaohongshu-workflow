import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { auditLicenseBoundary } from './license-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, '04-工具', 'license-audit.mjs');

function runAudit(repo) {
  return spawnSync(process.execPath, [script], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, LICENSE_AUDIT_ROOT: repo },
  });
}

test('auditLicenseBoundary accepts the public repo shape', () => {
  const errors = auditLicenseBoundary({
    trackedPaths: [
      '.claude/skills/xhs-visual-director/LICENSE',
      '.claude/skills/xhs-visual-director/README.md',
      'node_modules/acorn/package.json',
      'node_modules/puppeteer/package.json',
    ],
    packageLock: {
      packages: {
        'node_modules/acorn': { name: 'acorn', version: '8.18.0', license: 'MIT' },
        'node_modules/puppeteer': { name: 'puppeteer', version: '23.11.1', license: 'Apache-2.0' },
      },
    },
  });
  assert.deepEqual(errors, []);
});

test('auditLicenseBoundary rejects unlicensed vendored skills and disallowed npm licenses', () => {
  const errors = auditLicenseBoundary({
    trackedPaths: [
      '.claude/skills/cover-anchor-system/SKILL.md',
      '.claude/skills/guizang-social-card-skill/SKILL.md',
      '.claude/skills/xhs-visual-director/README.md',
    ],
    packageLock: {
      packages: {
        'node_modules/bad-package': { name: 'bad-package', version: '1.0.0', license: 'GPL-3.0-only' },
      },
    },
  });
  assert.match(errors.join('\n'), /cover-anchor-system/);
  assert.match(errors.join('\n'), /guizang-social-card-skill/);
  assert.match(errors.join('\n'), /GPL-3.0-only/);
});

test('CLI passes on a repo with allowed licenses and fails on a forbidden vendored skill', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-license-audit-'));
  const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  const lock = {
    name: 'demo',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'demo', version: '1.0.0' },
      'node_modules/acorn': { name: 'acorn', version: '8.18.0', license: 'MIT' },
    },
  };
  await writeFile(path.join(repo, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  await mkdir(path.join(repo, '.claude', 'skills', 'xhs-visual-director'), { recursive: true });
  await writeFile(path.join(repo, '.claude', 'skills', 'xhs-visual-director', 'LICENSE'), 'MIT\n');
  await writeFile(path.join(repo, '.claude', 'skills', 'xhs-visual-director', 'README.md'), 'ok\n');
  await mkdir(path.join(repo, 'node_modules', 'acorn'), { recursive: true });
  await writeFile(path.join(repo, 'node_modules', 'acorn', 'package.json'), JSON.stringify({ name: 'acorn', version: '8.18.0', license: 'MIT' }, null, 2));
  assert.equal(git('add', 'package-lock.json', '.claude/skills/xhs-visual-director/LICENSE', '.claude/skills/xhs-visual-director/README.md', 'node_modules/acorn/package.json').status, 0);

  let result = runAudit(repo);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS 许可证边界通过/);

  await mkdir(path.join(repo, '.claude', 'skills', 'cover-anchor-system'), { recursive: true });
  await writeFile(path.join(repo, '.claude', 'skills', 'cover-anchor-system', 'SKILL.md'), 'demo\n');
  assert.equal(git('add', '.claude/skills/cover-anchor-system/SKILL.md').status, 0);
  result = runAudit(repo);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /cover-anchor-system/);
});

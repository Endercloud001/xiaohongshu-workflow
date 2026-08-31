import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.LICENSE_AUDIT_ROOT || scriptRoot);
const allowedVendoredSkills = new Map([
  ['.claude/skills/xhs-visual-director', {
    source: 'https://github.com/ziguishian/xhs-visual-director-skill',
    version: '5c730c688f2c7e64f798d611608997ffba43813d',
    license: 'MIT',
  }],
]);
const blockedVendoredSkills = [
  '.claude/skills/cover-anchor-system',
  '.claude/skills/guizang-social-card-skill',
];
const allowedPackageLicenses = new Set([
  'MIT',
  'Apache-2.0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Python-2.0',
]);

function git(args, label) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${label}\n${result.stderr || ''}`);
  return result.stdout;
}

function splitLicenseExpression(value) {
  return value
    .replace(/^\s*\(/, '')
    .replace(/\)\s*$/, '')
    .split(/\s+(?:OR|AND)\s+/i)
    .map(part => part.trim().replace(/^\(|\)$/g, ''))
    .filter(Boolean);
}

function isAllowedLicense(value) {
  if (!value) return false;
  const normalized = value.trim();
  if (/^SEE LICENSE IN\b/i.test(normalized)) return false;
  const parts = splitLicenseExpression(normalized);
  if (!parts.length) return false;
  return parts.every(part => allowedPackageLicenses.has(part));
}

function packageLabel(key, manifest) {
  return manifest.name ? `${manifest.name}@${manifest.version ?? 'unknown'} (${key || '.'})` : `${key || '.'}`;
}

export function auditLicenseBoundary({ trackedPaths, packageLock }) {
  const errors = [];

  for (const blocked of blockedVendoredSkills) {
    if (trackedPaths.some(file => file === blocked || file.startsWith(`${blocked}/`))) {
      errors.push(`${blocked}: 不得随公开仓库分发`);
    }
  }

  for (const [relativeDir, metadata] of allowedVendoredSkills) {
    const licensePath = `${relativeDir}/LICENSE`;
    if (!trackedPaths.includes(licensePath)) {
      errors.push(`${relativeDir}: 缺少随 vendored 快照保留的 LICENSE`);
    }
    if (!trackedPaths.some(file => file === relativeDir || file.startsWith(`${relativeDir}/`))) {
      errors.push(`${relativeDir}: 缺少允许分发的 vendored 快照`);
    }
    if (packageLock?.packages?.[relativeDir]?.license && !isAllowedLicense(packageLock.packages[relativeDir].license)) {
      errors.push(`${relativeDir}: 记录到的许可证不符合预期`);
    }
    if (metadata.license !== 'MIT') {
      errors.push(`${relativeDir}: 许可清单异常`);
    }
  }

  for (const [key, manifest] of Object.entries(packageLock?.packages ?? {})) {
    if (!key || !key.startsWith('node_modules/')) continue;
    const license = manifest.license;
    if (!license) {
      errors.push(`${packageLabel(key, manifest)}: 缺少 license 元数据`);
      continue;
    }
    if (!isAllowedLicense(license)) {
      errors.push(`${packageLabel(key, manifest)}: 不在允许的 npm 许可证集合中 (${license})`);
    }
  }

  return errors;
}

async function main() {
  try {
    const trackedPaths = git(['ls-files', '-z'], '无法读取 Git tracked 文件').split('\0').filter(Boolean);
    const packageLock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
    const errors = auditLicenseBoundary({ trackedPaths, packageLock });

    if (errors.length) {
      for (const error of [...new Set(errors)]) console.error(`FAIL ${error}`);
      process.exit(1);
    }

    const vendoredCount = [...allowedVendoredSkills.keys()].filter(dir => trackedPaths.some(file => file === dir || file.startsWith(`${dir}/`))).length;
    const packageCount = Object.keys(packageLock.packages ?? {}).filter(key => key.startsWith('node_modules/')).length;
    console.log(`PASS 许可证边界通过（${vendoredCount} 个 vendored skill；${packageCount} 个 npm 包）`);
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

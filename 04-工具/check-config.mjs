import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const safeName = /^[A-Za-z0-9._-]+$/;
const statusValues = '(?:ok|degraded|failed|in_progress|waiting_backfill|waiting_confirm)';

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(relativePath));
      continue;
    }
    files.push(relativePath);
  }
  return files;
}

export function validateRunYaml(text, relativePath = 'run.yaml') {
  const errors = [];
  const checks = [
    [/^run:\s*\S+/m, '缺少 run'],
    [/^topic:\s*\S+/m, '缺少 topic'],
    [/^profile_version:\s*\d+/m, '缺少 profile_version'],
    [/^mode:\s*(?:探索|深耕)/m, 'mode 必须是 探索 或 深耕'],
    [/^domain:\s*\S+/m, '缺少 domain'],
    [/^workflow_mode:\s*slim_manual_publish/m, 'workflow_mode 必须是 slim_manual_publish'],
    [/^research_backend:\s*(?:opencli|redbook|xiaohongshu-mcp|none)/m, 'research_backend 取值不合法'],
    [/^nodes:\s*$/m, '缺少 nodes'],
    [/^\s*-\s+id:\s*research\s*$/m, '缺少 research 节点'],
    [new RegExp(`^\\s*status:\\s*${statusValues}\\s*$`, 'm'), '节点缺少合法 status'],
    [/^\s*tool:\s*\S+/m, '节点缺少 tool'],
    [/^\s*retries:\s*\d+/m, '节点缺少 retries'],
    [/^topic_gate:\s*$/m, '缺少 topic_gate'],
    [/^topic_gate:[\s\S]*?^\s*status:\s*(?:go|revise|reject)\s*$/m, 'topic_gate.status 不合法'],
    [/^topic_gate:[\s\S]*?^\s*total:\s*\d+\s*$/m, 'topic_gate.total 缺失'],
    [/^topic_gate:[\s\S]*?^\s*rounds:\s*\d+\s*$/m, 'topic_gate.rounds 缺失'],
    [/^visual_router:\s*$/m, '缺少 visual_router'],
    [/^visual_router:[\s\S]*?^\s*mode:\s*(?:auto|semi|manual)\s*$/m, 'visual_router.mode 不合法'],
    [/^visual_router:[\s\S]*?^\s*cover_skill:\s*\S+\s*$/m, 'visual_router.cover_skill 缺失'],
    [/^visual_router:[\s\S]*?^\s*inner_skill:\s*\S+\s*$/m, 'visual_router.inner_skill 缺失'],
    [/^visual_router:[\s\S]*?^\s*fallback_skill:\s*\S+\s*$/m, 'visual_router.fallback_skill 缺失'],
    [/^visual_gate:\s*$/m, '缺少 visual_gate'],
    [/^visual_gate:[\s\S]*?^\s*status:\s*(?:pass|revise|fallback)\s*$/m, 'visual_gate.status 不合法'],
    [/^visual_gate:[\s\S]*?^\s*fallback_pages:\s*\[\s*\]\s*$/m, 'visual_gate.fallback_pages 必须是空数组或空列表'],
    [/^publish:\s*$/m, '缺少 publish'],
    [/^publish:[\s\S]*?^\s*mode:\s*manual_only\s*$/m, 'publish.mode 必须是 manual_only'],
    [/^publish:[\s\S]*?^\s*status:\s*(?:package_ready|manually_published|archived_only)\s*$/m, 'publish.status 不合法'],
    [/^publish:[\s\S]*?^\s*note_url:\s*(?:null|~)\s*$/m, 'publish.note_url 必须为空'],
    [/^confirmations:\s*\[\s*\]\s*$/m, 'confirmations 必须为空数组'],
    [/^degradations:\s*\[\s*\]\s*$/m, 'degradations 必须为空数组'],
  ];
  for (const [pattern, message] of checks) {
    if (!pattern.test(text)) errors.push(`${relativePath}: ${message}`);
  }
  return errors;
}

export function validatePublicFileNames(filePaths, relativeRoot) {
  const errors = [];
  for (const filePath of filePaths) {
    const fileName = path.posix.basename(filePath);
    if (!safeName.test(fileName)) errors.push(`${relativeRoot}/${filePath}: 文件名必须是英文安全文件名`);
  }
  return errors;
}

export function validateTrackedPaths(trackedPaths) {
  const errors = [];
  for (const filePath of trackedPaths) {
    if (filePath === '01-账号/账号档案.md') errors.push(`${filePath}: 真实账号档案不得进入 Git index`);
    if (filePath === '05-验收/已发档案.jsonl') errors.push(`${filePath}: 真实归档不得进入 Git index`);
  }
  return errors;
}

export async function checkConfig() {
  const errors = [];
  const notes = [];

  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (major < 20 || major >= 25) errors.push(`Node.js 版本须为 >=20 <25，当前 ${process.version}`);

  for (const relativePath of [
    'README.md',
    'package-lock.json',
    '.env.example',
    '01-账号/账号档案.example.md',
    '05-验收/已发档案.example.jsonl',
    '06-产出/00000000-verify-fixture/copy.md',
  ]) {
    if (!(await exists(relativePath))) errors.push(`缺少基础文件: ${relativePath}`);
  }

  for (const relativeDir of [
    '00-总览',
    '01-账号',
    '02-规范',
    '03-skills',
    '04-工具',
    '05-验收',
    '06-产出',
    '06-产出/00000000-selftest',
    '06-产出/00000000-verify-fixture',
  ]) {
    if (!(await exists(relativeDir))) errors.push(`缺少必要目录: ${relativeDir}`);
  }

  for (const relativeRoot of ['06-产出/00000000-selftest', '06-产出/00000000-verify-fixture']) {
    try {
      const files = await collectFiles(relativeRoot);
      errors.push(...validatePublicFileNames(files, relativeRoot));
      for (const file of files.filter(file => path.posix.basename(file) === 'run.yaml')) {
        const text = await readFile(path.join(root, file), 'utf8');
        errors.push(...validateRunYaml(text, file));
      }
    } catch {
      errors.push(`缺少必要目录: ${relativeRoot}`);
    }
  }

  const git = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (git.status !== 0) {
    throw new Error(`无法读取 Git index\n${git.stderr || ''}`);
  }
  const trackedPaths = git.stdout.split('\0').filter(Boolean);
  errors.push(...validateTrackedPaths(trackedPaths));

  const mcpUrl = process.env.XHS_MCP_URL ?? 'http://localhost:18060/mcp';
  try {
    const parsed = new URL(mcpUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('协议必须是 http/https');
    if (parsed.username || parsed.password) throw new Error('URL 不得内嵌凭据');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('仅允许本机研究服务');
  } catch {
    errors.push('XHS_MCP_URL 必须是无内嵌凭据的本机 HTTP(S) URL');
  }

  for (const [name, relativePath] of [
    ['cover-anchor-system', '.claude/skills/cover-anchor-system'],
    ['guizang-social-card-skill', '.claude/skills/guizang-social-card-skill'],
  ]) {
    try {
      await access(path.join(root, relativePath));
      notes.push(`可选视觉技能已存在: ${name}`);
    } catch {
      notes.push(`可选视觉技能未安装（不阻塞）: ${name}`);
    }
  }

  notes.push(`可选研究命令（不执行、不阻塞）: ${process.env.OPENCLI_COMMAND ?? 'opencli'}, ${process.env.REDBOOK_COMMAND ?? 'redbook'}`);

  return { errors, notes };
}

async function main() {
  try {
    const { errors, notes } = await checkConfig();
    notes.forEach(note => console.log(`INFO ${note}`));
    if (errors.length) {
      errors.forEach(error => console.error(`FAIL ${error}`));
      process.exit(1);
    }
    console.log(`PASS 基础配置检查通过（Node ${process.version}；无需凭据）`);
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

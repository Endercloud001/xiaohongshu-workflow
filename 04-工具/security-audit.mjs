import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const allowedExamples = new Set([
  '.env.example',
  '01-账号/账号档案.example.md',
  '05-验收/已发档案.example.jsonl',
]);

export function findForbiddenPath(input) {
  const file = input.replaceAll('\\', '/');
  const lower = file.toLowerCase();
  if (allowedExamples.has(file)) return null;
  if (/(^|\/)node_modules(\/|$)/i.test(file)) return 'node_modules';
  if (/\.(exe|dll|msi|dmg|appimage)$/i.test(file)) return '可执行文件';
  if (/(^|\/)(cookies?|storage[-_.]?state|auth[-_.]?state|web[-_.]?session)([./_-]|$)/i.test(file)) return 'Cookie / 会话文件';
  if (/(^|\/)(browser[-_.]?profile|user[-_.]?data|\.redbook)(\/|$)/i.test(file)) return 'browser profile';
  if (/^01-账号\//.test(file) && !/\.example\./i.test(file)) return '真实账号档案';
  if (/^05-验收\/已发档案/i.test(file) && !/\.example\./i.test(file)) return '真实发布记录';
  if (/^06-产出\//.test(file) && !/^06-产出\/00000000-(selftest|verify-fixture)\//.test(file)) return '真实运行产物';
  if (/(^|\/)\.env(\.|$)/i.test(file) && lower !== '.env.example') return '环境密钥文件';
  if (/\.(pem|key|p12|pfx|secret|secrets)$/i.test(file)) return '密钥文件';
  return null;
}

export function findSecret(content) {
  const safe = /(?:example\.invalid|your[_-]?(?:api[_-]?key|token)|replace[_-]?me|<[^>]+>)/i;
  for (const line of content.split(/\r?\n/)) {
    if (safe.test(line)) continue;
    if (/\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?(?!\s|$)[A-Za-z0-9_./+=-]{16,}/i.test(line)) return '疑似凭据赋值';
    if (/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/.test(line)) return '疑似凭据 token';
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) return '私钥内容';
  }
  return null;
}

export function findWriteCapabilityInvocation(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /(?:不调用|不得调用|禁止|废弃|只允许出现在|不会自动|不包含)/.test(line)) continue;
    if (/(?:await\s+|\.)(?:publish_content|comment|like|collect|favorite|follow)\s*\(/i.test(line)) return '写能力调用';
    if (/^(?:\$\s*)?(?:npx\s+)?redbook\s+(?:post|comment|reply|batch-reply|collect|uncollect)\b/i.test(line)) return '写能力调用';
  }
  return null;
}

async function main() {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (listed.status !== 0) {
    process.stderr.write(listed.stderr || 'FAIL 无法读取 Git 跟踪文件\n');
    process.exit(2);
  }

  const files = listed.stdout.split('\0').filter(Boolean);
  const errors = [];
  for (const file of files) {
    const pathError = findForbiddenPath(file);
    if (pathError) errors.push(`${file}: 禁入项（${pathError}）`);
  }

  const textExtensions = new Set(['.cjs', '.env', '.example', '.html', '.json', '.jsonl', '.md', '.mjs', '.txt', '.yaml', '.yml']);
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (!textExtensions.has(extension) && path.basename(file) !== '.env.example') continue;
    let content;
    try { content = await readFile(path.join(root, file), 'utf8'); }
    catch { continue; }
    const secret = findSecret(content);
    if (secret) errors.push(`${file}: ${secret}`);
    const invocation = findWriteCapabilityInvocation(content);
    if (invocation) errors.push(`${file}: ${invocation}`);
  }

  if (errors.length) {
    errors.forEach(error => console.error(`FAIL ${error}`));
    process.exit(1);
  }
  console.log(`PASS 公开树安全审计通过（${files.length} 个跟踪文件；零凭据、零写能力调用）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

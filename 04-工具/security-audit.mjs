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
  const base = path.posix.basename(lower);
  if (/(^|\/)node_modules(\/|$)/i.test(file)) return 'node_modules';
  if (/\.(?:pem|key|p12|pfx|crt|cer|der|csr|pkcs8|pkcs12|jks|keystore)$/i.test(file)) return '密钥 / 证书文件';
  const isPublicExample = allowedExamples.has(file)
    || /(?:^|\.)example(?:\.|$)/i.test(base)
    || /(^|\/)fixtures?(\/|$)/i.test(file)
    || /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(base);
  if (isPublicExample) return null;
  if (/\.(?:exe|com|cmd|bat|dll|msi|dmg|appimage)$/i.test(file)) return '可执行文件';
  if (/(^|\/)(?:browser[-_.]?profile|chrome[-_.]?profile|profiles?|user[-_.]?data|\.redbook)(\/|$)/i.test(file)) return 'browser profile';
  if (/^(?:xhs[-_.]?cookies?|session[-_.]?store)\.json$/i.test(base)) return 'Cookie / 会话文件';
  if (/(^|\/)(?:cookies?|sessions?|storage[-_.]?state|auth[-_.]?state|web[-_.]?session)(?:[./_-]|$)/i.test(file)) return 'Cookie / 会话文件';
  if (/(^|\/)(?:auth|authentication|credentials?)(\/|$)/i.test(file)) return '凭据 / 认证文件';
  if (/(^|\/)(?:access[-_.]?token|refresh[-_.]?token|api[-_.]?key|secret|password|credentials?)(?:\.[^/]+)?$/i.test(file)) return '凭据 / 密钥文件';
  if (/(^|\/)token\.(?:txt|ya?ml)$/i.test(file)) return '凭据 / 密钥文件';
  if (/^01-账号\//.test(file) && !/\.example\./i.test(file)) return '真实账号档案';
  if (/^05-验收\/已发档案/i.test(file) && !/\.example\./i.test(file)) return '真实发布记录';
  if (/^06-产出\//.test(file) && !/^06-产出\/00000000-(selftest|verify-fixture)\//.test(file)) return '真实运行产物';
  if (/(^|\/)\.env(\.|$)/i.test(file) && lower !== '.env.example') return '环境密钥文件';
  if (/\.(?:secret|secrets)$/i.test(file)) return '密钥文件';
  return null;
}

export function findSecret(content) {
  const approvedPlaceholder = /^(?:your[_-]?(?:api[_-]?key|token)(?:[_-]here)?|replace[_-]?me|<(?:(?:api[_-]?)?key|token|secret|password)>|\$\{[A-Z][A-Z0-9_]*\})$/i;
  for (const line of content.split(/\r?\n/)) {
    const assignments = line.matchAll(/(?<![\w])(?:_authToken|(?:[A-Z0-9]+[_-])?api[_-]?key|aws[_-]access[_-]key[_-]id|aws[_-]secret[_-]access[_-]key|access[_-]?token|refresh[_-]?token|token|client[_-]?secret|secret|password)\s*[:=]\s*(["']?)(\$\{[A-Z][A-Z0-9_]*\}|[^\s,"';}]+)/gi);
    for (const assignment of assignments) {
      let value = assignment[2];
      if (/^\$\{[A-Z][A-Z0-9_]*\}$/i.test(value)) {
        const suffix = line.slice(assignment.index + assignment[0].length).match(/^[^\s,"';}]*/)?.[0] ?? '';
        value += suffix;
      }
      const valueAndRest = line.slice(assignment.index + assignment[0].length - value.length);
      const isCodeReference = !assignment[1] && (/^[A-Za-z_$][\w$]*\s*\(/.test(valueAndRest) || /^(?:process\.env|config|options?|args?)\.[A-Za-z_$][\w$]*$/.test(value));
      if (!approvedPlaceholder.test(value) && !isCodeReference && value.length >= 4) return '疑似凭据赋值';
    }
    const bearer = line.match(/\bAuthorization\s*:\s*Bearer\s+([^\s,"';}]+)/i);
    if (bearer && !approvedPlaceholder.test(bearer[1])) return '疑似凭据 Bearer token';
    if (/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/.test(line)) return '疑似凭据 token';
    if (/\bAKIA[0-9A-Z]{16}\b/.test(line)) return '疑似凭据 AWS access key';
    if (/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(line)) return '疑似凭据 JWT';
    if (/\b(?:https?|wss?):\/\/[^\s/@:]+:[^\s/@]+@/i.test(line)) return '疑似凭据 URL';
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) return '私钥内容';
  }
  return null;
}

export function findWriteCapabilityInvocation(content) {
  const operation = '(?:publish_content|publishContent|post|comment|reply|like|collect|uncollect|favorite|unfavorite|follow|unfollow)';
  const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const executableLines = withoutBlockComments.split(/\r?\n/).map(rawLine => {
    let line = rawLine.replace(/(^|\s)\/\/.*$/, '$1').trim();
    if (!line || /^(?:#|>|[-*]\s)/.test(line)) return '';
    if (/^(?:const|let|var)\s+\w+\s*=\s*(["'`]).*\1\s*;?$/.test(line)
      && !new RegExp(`^(?:const|let|var)\\s+\\w+\\s*=\\s*["']${operation}["'](?:\\s*;)?$`, 'i').test(line)) return '';
    if (/^(?:不调用|不得调用|禁止|废弃|只读|只允许出现在|不会自动|不包含)[^;；]*`[^`]+`[^;；]*[。！？]?$/.test(line)) return '';
    if (/^(?:不调用|不得调用|禁止|废弃|只读|只允许出现在|不会自动|不包含)[^;；]*$/.test(line)) return '';
    return line;
  }).filter(Boolean);
  const executableContent = executableLines.join('\n');
  if (new RegExp(`\\bcallTool\\s*\\(\\s*\\{[^}]{0,300}?\\bname\\s*:\\s*["']${operation}["']`, 'i').test(executableContent)) return '写能力调用';
  if (new RegExp(`\\bcallTool\\s*\\(\\s*["']${operation}["']`, 'i').test(executableContent)) return '写能力调用';
  if (new RegExp(`\\binvoke\\s*\\(\\s*["']${operation}["']`, 'i').test(executableContent)) return '写能力调用';
  if (/\b(?:client|sdk|redbook|mcp)\s*\[\s*[A-Za-z_$][\w$]*\s*\]\s*\(/i.test(executableContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s+(\\w+)\\s*=\\s*[^;\\n]*(?:\\.|\\[\\s*["'])${operation}(?:["']\\s*\\])?\\s*(?:;|\\r?\\n)[\\s\\S]{0,500}?\\b\\1\\s*\\(`, 'i').test(executableContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b(publish_content|publishContent|comment|reply|like|collect|uncollect|favorite|unfavorite|follow|unfollow)\\b[^}]*\\}\\s*=.*?;[\\s\\S]{0,500}?\\b\\1\\s*\\(`, 'i').test(executableContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${operation}\\s*:\\s*(\\w+)[^}]*\\}\\s*=.*?;[\\s\\S]{0,500}?\\b\\1\\s*\\(`, 'i').test(executableContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s+(\\w+)\\s*=\\s*["']${operation}["']\\s*(?:;|\\r?\\n)[\\s\\S]{0,500}?\\b(?:callTool|invoke)\\s*\\(\\s*\\1\\b`, 'i').test(executableContent)) return '写能力调用';
  for (const rawLine of executableLines) {
    const line = rawLine.trim();
    if (new RegExp(`\\b${operation}\\s*\\(`, 'i').test(line) && !new RegExp(`\\bfunction\\s+${operation}\\s*\\(`, 'i').test(line)) return '写能力调用';
    if (new RegExp(`\\[\\s*["']${operation}["']\\s*\\]\\s*\\(`, 'i').test(line)) return '写能力调用';
    if (new RegExp(`^(?:\\$\\s*)?(?:npx\\s+)?redbook\\s+(?:post|publish|publish_content|comment|reply|batch-reply|like|unlike|collect|uncollect|favorite|unfavorite|follow|unfollow)\\b`, 'i').test(line)) return '写能力调用';
  }
  return null;
}

const textExtensions = new Set([
  '.bash', '.c', '.cjs', '.conf', '.config', '.cpp', '.css', '.csv', '.env', '.example',
  '.fish', '.go', '.graphql', '.h', '.hpp', '.html', '.ini', '.java', '.js', '.json', '.jsonl',
  '.jsx', '.kt', '.md', '.mjs', '.php', '.ps1', '.py', '.rb', '.rs', '.scss', '.sh', '.sql',
  '.svelte', '.toml', '.ts', '.tsx', '.txt', '.vue', '.xml', '.yaml', '.yml', '.zsh',
]);

export function shouldAuditTextFile(file) {
  return textExtensions.has(path.extname(file).toLowerCase())
    || /^(?:\.env(?:\.example)?|\.npmrc|\.yarnrc)$/i.test(path.basename(file))
    || /^(?:dockerfile|makefile)$/i.test(path.basename(file));
}

async function main() {
  const listed = spawnSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8' });
  if (listed.status !== 0) {
    process.stderr.write(`FAIL 无法读取 Git index\n${listed.stderr || ''}`);
    process.exit(2);
  }

  const files = listed.stdout.split('\0').filter(Boolean);
  const errors = [];
  for (const file of files) {
    const pathError = findForbiddenPath(file);
    if (pathError) errors.push(`${file}: 禁入项（${pathError}）`);
  }

  for (const file of files) {
    if (!shouldAuditTextFile(file)) continue;
    const shown = spawnSync('git', ['show', `:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (shown.status !== 0) {
      process.stderr.write(`FAIL 无法读取 Git index 中的 ${file}\n${shown.stderr || ''}`);
      process.exit(2);
    }
    const content = shown.stdout;
    const secret = findSecret(content);
    if (secret) errors.push(`${file}: ${secret}`);
    const invocation = findWriteCapabilityInvocation(content);
    if (invocation) errors.push(`${file}: ${invocation}`);
  }

  if (errors.length) {
    errors.forEach(error => console.error(`FAIL ${error}`));
    process.exit(1);
  }
  console.log(`PASS 待提交 Git index 安全审计通过（${files.length} 个 index 文件；零凭据、零写能力调用）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

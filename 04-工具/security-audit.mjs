import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

function stripCommentsOutsideStrings(content) {
  let result = '';
  let state = 'code';
  let quote = '';
  for (let index = 0; index < content.length;) {
    const current = content[index];
    const next = content[index + 1];
    if (state === 'string') {
      result += current;
      if (current === '\\') {
        if (next !== undefined) result += next;
        index += 2;
      } else {
        if (current === quote) state = 'code';
        index += 1;
      }
      continue;
    }
    if (state === 'line-comment') {
      if (current === '\n' || current === '\r') {
        result += current;
        state = 'code';
      } else result += ' ';
      index += 1;
      continue;
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        result += '  ';
        index += 2;
        state = 'code';
      } else {
        result += current === '\n' || current === '\r' ? current : ' ';
        index += 1;
      }
      continue;
    }
    if (state === 'html-comment') {
      if (content.startsWith('-->', index)) {
        result += '   ';
        index += 3;
        state = 'code';
      } else {
        result += current === '\n' || current === '\r' ? current : ' ';
        index += 1;
      }
      continue;
    }
    if (current === '"' || current === "'" || current === '`') {
      quote = current;
      state = 'string';
      result += current;
      index += 1;
    } else if (current === '/' && next === '/' && content[index - 1] !== ':') {
      result += '  ';
      index += 2;
      state = 'line-comment';
    } else if (current === '/' && next === '*') {
      result += '  ';
      index += 2;
      state = 'block-comment';
    } else if (content.startsWith('<!--', index)) {
      result += '    ';
      index += 4;
      state = 'html-comment';
    } else {
      result += current;
      index += 1;
    }
  }
  return result;
}

function maskStringLiterals(content) {
  let result = '';
  let quote = '';
  let preserve = false;
  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    if (!quote) {
      if (current === '"' || current === "'" || current === '`') {
        const previous = result.trimEnd().at(-1);
        quote = current;
        preserve = current === '`' && previous === '[';
        result += preserve ? current : ' ';
      } else result += current;
      continue;
    }
    if (current === '\\') {
      result += preserve ? current : ' ';
      if (index + 1 < content.length) {
        index += 1;
        result += preserve ? content[index] : ' ';
      }
    } else if (current === quote) {
      result += preserve ? current : ' ';
      quote = '';
      preserve = false;
    } else result += preserve || current === '\n' || current === '\r' ? current : ' ';
  }
  return result;
}

export function findWriteCapabilityInvocation(content) {
  const operation = '(?:publish_content|publishContent|post|comment|reply|like|collect|uncollect|favorite|unfavorite|follow|unfollow)';
  const withoutBlockComments = stripCommentsOutsideStrings(content);
  let inMarkdownFence = false;
  let markdownFence = '';
  const executableLines = withoutBlockComments.split(/\r?\n/).map(rawLine => {
    if (/^\s*\[!\[.*\]\([^)]*\)\s*$/.test(rawLine)) return '';
    const fence = rawLine.match(/^\s*(?:>\s*)?(?:(?:[-*+]\s+|\d+\.\s+))?(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!inMarkdownFence) {
        inMarkdownFence = true;
        markdownFence = marker;
      } else if (marker === markdownFence) {
        inMarkdownFence = false;
        markdownFence = '';
      }
      return '';
    }
    if (inMarkdownFence) return '';
    let line = rawLine.trim();
    line = line.replace(/(?<!\[)(`+)[^`]*\1/g, ' ');
    if (!line || /^#/.test(line)) return '';
    line = line.replace(/^(?:>\s*)?(?:(?:[-*+]\s+|\d+\.\s+))?/, '').trim();
    if (!line) return '';
    if (/^<[^>]+>.*<\/[^>]+>\s*$/.test(line)) return '';
    if (/^[^;；{}]*[：:]\s*(?:client|sdk|mcp|redbook|tool)(?:\?\.)?[.[].*\)?[。！？]?$/i.test(line)) return '';
    if (/^(?:const|let|var)\s+\w+\s*=\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*;?$/.test(line)
      && !new RegExp(`^(?:const|let|var)\\s+\\w+\\s*=\\s*["']${operation}["'](?:\\s*;)?$`, 'i').test(line)) return '';
    if (/^(?:不调用|不得调用|禁止|废弃|只读|只允许出现在|不会自动|不包含)[^;；]*`[^`]+`[^;；]*[。！？]?$/.test(line)) return '';
    if (/^(?:不调用|不得调用|禁止|废弃|只读|只允许出现在|不会自动|不包含)[^;；]*$/.test(line)) return '';
    return line;
  }).filter(Boolean);
  const executableContent = executableLines.join('\n');
  const codeOnlyContent = maskStringLiterals(executableContent);
  const dispatch = /\b(?:callTool|invoke)\s*(?:\?\.)?\s*\(/gi;
  for (const match of codeOnlyContent.matchAll(dispatch)) {
    const tail = executableContent.slice(match.index + match[0].length);
    const literal = tail.match(/^\s*(["'])([^"']+)\1/);
    if (literal) {
      if (new RegExp(`^${operation}$`, 'i').test(literal[2])) return '写能力调用';
      continue;
    }
    if (/^\s*\{/.test(tail)) {
      const object = tail.slice(0, 400);
      const nameLiteral = object.match(/\bname\s*:\s*(["'])([^"']+)\1/i);
      if (nameLiteral && !new RegExp(`^${operation}$`, 'i').test(nameLiteral[2])) continue;
      if (/\bname\s*:/.test(object)) return '写能力调用';
      continue;
    }
    return '写能力调用';
  }
  if (/\b[A-Za-z_$][\w$]*\s*\[\s*[^\]\r\n]+\]\s*(?:\?\.)?\s*\(/i.test(codeOnlyContent)
    && !/\bclass\s+[\w$]+[^{}]*\{[^{}]*\[[^\]]+\]\s*\(/i.test(codeOnlyContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s+(\\w+)\\s*=\\s*[^;\\n]*\\.${operation}\\s*(?:;|\\r?\\n)[\\s\\S]{0,500}?\\b\\1\\s*\\(`, 'i').test(codeOnlyContent)) return '写能力调用';
  if (/\b(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*\.\s*callTool\s*(?:;|\r?\n)[\s\S]{0,500}?\b\1\s*\(/i.test(codeOnlyContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b(publish_content|publishContent|comment|reply|like|collect|uncollect|favorite|unfavorite|follow|unfollow)\\b[^}]*\\}\\s*=[^;\\n]*(?:;|\\r?\\n)[\\s\\S]{0,500}?\\b\\1\\s*\\(`, 'i').test(codeOnlyContent)) return '写能力调用';
  if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${operation}\\s*:\\s*(\\w+)[^}]*\\}\\s*=[^;\\n]*(?:;|\\r?\\n)[\\s\\S]{0,500}?\\b\\1\\s*\\(`, 'i').test(codeOnlyContent)) return '写能力调用';
  for (const rawLine of executableLines) {
    const line = rawLine.trim();
    const codeLine = maskStringLiterals(line);
    const declaration = new RegExp(`(?:\\bfunction\\s+|\\b(?:class|interface)\\s+[\\w$]+[^{}]*\\{[^{}]*|\\btype\\s+[\\w$]+\\s*=\\s*\\{[^{}]*|\\b(?:public|private|protected|static|abstract|async)\\s+)${operation}\\s*\\([^)]*\\)\\s*(?:\\{|:\\s*[^;{}]+;?)`, 'i');
    const methodSignature = new RegExp(`^(?:(?:public|private|protected|static|abstract|async)\\s+)*${operation}\\s*\\([^)]*\\)\\s*(?:\\{|:\\s*[^;{}]+;?)`, 'i');
    if (new RegExp(`\\b${operation}\\s*(?:\\?\\.)?\\s*\\(`, 'i').test(codeLine) && !declaration.test(line) && !methodSignature.test(line)) return '写能力调用';
    if (new RegExp(`\\[\\s*["']${operation}["']\\s*\\]\\s*(?:\\?\\.)?\\s*\\(`, 'i').test(line)) return '写能力调用';
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

function git(args, label, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${label}\n${result.stderr || ''}`);
  return result.stdout;
}

function readReachableObjects(records) {
  const input = `${records.map(record => record.oid).join('\n')}\n`;
  const result = spawnSync('git', ['cat-file', '--batch'], { cwd: root, input, maxBuffer: 512 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`无法批量读取可达 Git 对象\n${result.stderr?.toString('utf8') || ''}`);
  const objects = new Map();
  let offset = 0;
  for (const record of records) {
    const lineEnd = result.stdout.indexOf(10, offset);
    if (lineEnd < 0) throw new Error(`可达 Git 对象 ${record.oid} 的批处理响应不完整`);
    const header = result.stdout.subarray(offset, lineEnd).toString('utf8');
    const parsed = header.match(/^([0-9a-f]+) (\w+) (\d+)$/);
    if (!parsed || parsed[1] !== record.oid) throw new Error(`可达 Git 对象 ${record.oid} 的批处理响应无效`);
    const size = Number(parsed[3]);
    const start = lineEnd + 1;
    const end = start + size;
    if (end >= result.stdout.length || result.stdout[end] !== 10) throw new Error(`可达 Git 对象 ${record.oid} 的内容不可完整读取`);
    if (parsed[2] === 'blob') objects.set(record.oid, result.stdout.subarray(start, end).toString('utf8'));
    offset = end + 1;
  }
  return objects;
}

function inspect(scope, file, content, errors, forceContent = false) {
  const pathError = file && findForbiddenPath(file);
  if (pathError) errors.push(`${scope}:${file}: 禁入项（${pathError}）`);
  if (!forceContent && (!file || !shouldAuditTextFile(file))) return;
  const secret = findSecret(content);
  if (secret) errors.push(`${scope}:${file}: ${secret}`);
  const invocation = findWriteCapabilityInvocation(content);
  if (invocation) errors.push(`${scope}:${file}: ${invocation}`);
}

async function main() {
  const errors = [];
  let worktreeFiles;
  let indexFiles;
  try {
    indexFiles = git(['ls-files', '--cached', '-z'], '无法读取 Git index').split('\0').filter(Boolean);
    worktreeFiles = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], '无法列举 Git 工作树').split('\0').filter(Boolean);
  } catch (error) {
    process.stderr.write(`FAIL ${error.message}`);
    process.exit(2);
  }

  for (const file of worktreeFiles) {
    let content;
    try {
      content = readFileSync(path.join(root, file), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      process.stderr.write(`FAIL 无法读取工作树中的 ${file}\n${error.message}\n`);
      process.exit(2);
    }
    inspect('worktree', file, content, errors);
  }

  for (const file of indexFiles) {
    let content;
    try {
      content = git(['show', `:${file}`], `无法读取 Git index 中的 ${file}`);
    } catch (error) {
      process.stderr.write(`FAIL ${error.message}`);
      process.exit(2);
    }
    inspect('index', file, content, errors);
  }

  const historicalBlobs = new Map();
  try {
    const commits = git(['rev-list', '--all'], '无法列举可达 Git 历史').split(/\r?\n/).filter(Boolean);
    for (const commit of commits) {
      const entries = git(['ls-tree', '-r', '-z', '--full-tree', commit], `无法读取历史树 ${commit}`).split('\0').filter(Boolean);
      for (const entry of entries) {
        const parsed = entry.match(/^\d+\s+blob\s+([0-9a-f]+)\t([\s\S]+)$/);
        if (!parsed) continue;
        const [, oid, file] = parsed;
        inspect(`history:${commit.slice(0, 12)}`, file, '', errors);
        if (!historicalBlobs.has(oid)) historicalBlobs.set(oid, file);
      }
    }
    const reachable = git(['rev-list', '--objects', '--all'], '无法列举全部可达 Git 对象').split(/\r?\n/).filter(Boolean).map(record => {
      const [oid, ...nameParts] = record.split(' ');
      return { oid, file: nameParts.join(' ') };
    });
    const objectContents = readReachableObjects(reachable);
    for (const { oid, file } of reachable) {
      if (objectContents.has(oid) && !historicalBlobs.has(oid)) historicalBlobs.set(oid, file);
    }
    for (const [oid, file] of historicalBlobs) {
      const content = objectContents.get(oid);
      if (content === undefined) throw new Error(`历史 blob ${oid} 不在可达对象批处理结果中`);
      const label = file || `<blob-${oid.slice(0, 12)}>`;
      inspect(`history:${oid.slice(0, 12)}`, label, content, errors, !file);
    }
  } catch (error) {
    process.stderr.write(`FAIL ${error.message}`);
    process.exit(2);
  }

  if (errors.length) {
    [...new Set(errors)].forEach(error => console.error(`FAIL ${error}`));
    process.exit(1);
  }
  console.log(`PASS 三范围安全审计通过（工作树 ${worktreeFiles.length} 个文件；index ${indexFiles.length} 个文件；历史 ${historicalBlobs.size} 个 blob；零凭据、零写能力调用）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

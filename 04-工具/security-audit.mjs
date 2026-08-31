import { spawn, spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { parseFragment } from 'parse5';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.SECURITY_AUDIT_ROOT || scriptRoot);
const MAX_TEXT_BLOB_BYTES = 16 * 1024 * 1024;
const writes = new Set(['publish_content', 'publishContent', 'post', 'comment', 'reply', 'like', 'collect', 'uncollect', 'favorite', 'unfavorite', 'follow', 'unfollow']);
const dispatchers = new Set(['callTool', 'invoke']);
const allowedExamples = new Set(['.env.example', '01-账号/账号档案.example.md', '05-验收/已发档案.example.jsonl']);
const privateKeyArmor = new RegExp(['-----BEGIN ', '(?:(?:RSA|DSA|EC|OPENSSH|SSH2 ENCRYPTED|ENCRYPTED) )?', 'PRIVATE KEY', '(?: BLOCK)?-----'].join(''));
const pgpPrivateKeyArmor = new RegExp(['-----BEGIN PGP ', 'PRIVATE KEY BLOCK', '-----'].join(''));

export function findForbiddenPath(input) {
  const file = input.replaceAll('\\', '/');
  const lower = file.toLowerCase();
  const base = path.posix.basename(lower);
  if (/(^|\/)node_modules(\/|$)/i.test(file)) return 'node_modules';
  if (/\.(?:pem|key|ppk|pvk|p7b|p7c|p8|p12|pfx|crt|cer|der|csr|pkcs8|pkcs12|jks|keystore)$/i.test(file)) return '密钥 / 证书文件';
  if (/(^|\/)(?:\.ssh\/)?id_(?:rsa|dsa|ecdsa|ed25519)$/i.test(file) || /(^|\/)keys?\/id_(?:rsa|dsa|ecdsa|ed25519)$/i.test(file)) return 'SSH 私钥文件';
  if (/\.(?:zip|tar|tgz|gz|bz2|xz|7z|rar)$/i.test(file)) return '压缩包';
  if (/\.(?:log|trace)$/i.test(file)) return '日志文件';
  const example = allowedExamples.has(file) || /(?:^|\.)example(?:\.|$)/i.test(base) || /(^|\/)fixtures?(\/|$)/i.test(file) || /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(base);
  if (example) return null;
  if (/\.(?:exe|com|cmd|bat|dll|msi|dmg|appimage)$/i.test(file)) return '可执行文件';
  if (/(^|\/)(?:browser[-_.]?profile|chrome[-_.]?profile|profiles?|user[-_.]?data|\.redbook)(\/|$)/i.test(file)) return 'browser profile';
  if (/^(?:xhs[-_.]?cookies?|session[-_.]?store)\.json$/i.test(base) || /(^|\/)(?:cookies?|sessions?|storage[-_.]?state|auth[-_.]?state|web[-_.]?session)(?:[./_-]|$)/i.test(file)) return 'Cookie / 会话文件';
  if (/(^|\/)(?:auth|authentication|credentials?)(\/|$)/i.test(file)) return '凭据 / 认证文件';
  if (/(^|\/)(?:access[-_.]?token|refresh[-_.]?token|api[-_.]?key|secret|password|credentials?)(?:\.[^/]+)?$/i.test(file) || /(^|\/)token\.(?:txt|ya?ml)$/i.test(file)) return '凭据 / 密钥文件';
  if (/^01-账号\//.test(file) && !/\.example\./i.test(file)) return '真实账号档案';
  if (/^05-验收\/已发档案/i.test(file) && !/\.example\./i.test(file)) return '真实发布记录';
  if (/^06-产出\//.test(file) && !/^06-产出\/00000000-(selftest|verify-fixture)\//.test(file)) return '真实运行产物';
  if (/(^|\/)\.env(\.|$)/i.test(file) && lower !== '.env.example') return '环境密钥文件';
  if (/\.(?:secret|secrets)$/i.test(file)) return '密钥文件';
  return null;
}

export function findSecret(content) {
  const placeholder = /^(?:your[_-]?(?:api[_-]?key|token)(?:[_-]here)?|replace[_-]?me|<(?:(?:api[_-]?)?key|token|secret|password)>|\$\{[A-Z][A-Z0-9_]*\})$/i;
  for (const line of content.split(/\r?\n/)) {
    const assignments = line.matchAll(/(?<![\w])(?:_authToken|(?:[A-Z0-9]+[_-])?api[_-]?key|aws[_-]access[_-]key[_-]id|aws[_-]secret[_-]access[_-]key|access[_-]?token|refresh[_-]?token|token|client[_-]?secret|secret|password)\s*[:=]\s*(["']?)(\$\{[A-Z][A-Z0-9_]*\}|[^\s,"';}]+)/gi);
    for (const match of assignments) {
      let value = match[2];
      if (/^\$\{[A-Z][A-Z0-9_]*\}$/i.test(value)) value += line.slice(match.index + match[0].length).match(/^[^\s,"';}]*/)?.[0] ?? '';
      const tail = line.slice(match.index + match[0].length - value.length);
      const reference = !match[1] && (/^[A-Za-z_$][\w$]*\s*\(/.test(tail) || /^(?:process\.env|config|options?|args?)\.[A-Za-z_$][\w$]*$/.test(value));
      if (!placeholder.test(value) && !reference && value.length >= 4) return '疑似凭据赋值';
    }
    const bearer = line.match(/\bAuthorization\s*:\s*Bearer\s+([^\s,"';}]+)/i);
    if (bearer && !placeholder.test(bearer[1])) return '疑似凭据 Bearer token';
    if (/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/.test(line)) return '疑似凭据 token';
    if (/\bAKIA[0-9A-Z]{16}\b/.test(line)) return '疑似凭据 AWS access key';
    if (/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(line)) return '疑似凭据 JWT';
    if (/\b(?:https?|wss?):\/\/[^\s/@:]+:[^\s/@]+@/i.test(line)) return '疑似凭据 URL';
    if (privateKeyArmor.test(line) || pgpPrivateKeyArmor.test(line) || /^PuTTY-User-Key-File-[23]:\s*/.test(line)) return '私钥内容';
  }
  return null;
}

function unwrap(node) {
  while (node && (node.type === 'ChainExpression' || node.type === 'AwaitExpression')) node = node.expression || node.argument;
  return node;
}

function propertyName(node) {
  if (!node) return null;
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  if (node.computed && node.property?.type === 'Literal' && typeof node.property.value === 'string') return node.property.value;
  return null;
}

function parseProgram(source) {
  for (const sourceType of ['module', 'script']) {
    try { return parse(source, { ecmaVersion: 'latest', sourceType, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); } catch {}
  }
  return null;
}

function fragments(content) {
  if (/<\/?[A-Za-z][^>]*>|<!--[\s\S]*?-->/.test(content)) {
    const result = [];
    const visit = node => {
      if (node.tagName === 'script') result.push((node.childNodes || []).filter(child => child.nodeName === '#text').map(child => child.value).join(''));
      for (const attr of node.attrs || []) if (/^on[a-z0-9_-]+$/i.test(attr.name)) result.push(attr.value);
      if (node.nodeName === '#text' && node.parentNode?.nodeName === '#document-fragment') {
        for (const line of node.value.split(/\r?\n/)) if (parseProgram(line.trim())) result.push(line.trim());
      }
      if (node.content) visit(node.content);
      for (const child of node.childNodes || []) visit(child);
    };
    visit(parseFragment(content));
    return result;
  }
  if (parseProgram(content)) return [content];
  const interpolatedTemplates = [...content.matchAll(/`(?:\\.|[^`])*\$\{[\s\S]*?\}(?:\\.|[^`])*`/g)].map(match => match[0]);
  let fence = null;
  const cleaned = content.split(/\r?\n/).map(line => {
    const marker = line.match(/^\s*(?:>\s*)?(?:(?:[-*+]\s+|\d+\.\s+))?(`{3,}|~{3,})/);
    if (marker) { fence = fence ? null : marker[1][0]; return ''; }
    if (fence) return '';
    return line.replace(/(?<!\[)(`+)(?!`)[^`]*\1/g, ' ');
  }).join('\n');
  if (parseProgram(cleaned)) return [...interpolatedTemplates, cleaned];
  const lines = cleaned.split(/\r?\n/);
  const candidates = lines.flatMap(line => [line, ...line.split(/[;；]/).slice(1)]).map(line => line.trim()).filter(line => line && parseProgram(line));
  for (let start = 0; start < lines.length; start += 1) {
    if (!/^\s*(?:const|let|var|await|async\s+function|function|class|if\s*\(|for\s*\(|while\s*\(|try\s*\{|switch\s*\(|return\b|throw\b|[A-Za-z_$][\w$]*(?:\s*[.([]|\s*\?\.))/.test(lines[start])) continue;
    for (let end = lines.length; end > start + 1; end -= 1) {
      const source = lines.slice(start, end).join('\n').trim();
      if (parseProgram(source)) { candidates.push(source); break; }
    }
  }
  return [...interpolatedTemplates, ...candidates];
}

function astHasWrite(ast) {
  const dangerous = new Set();
  const dispatch = new Set();
  const dangerousMembers = new Set();
  const dispatchMembers = new Set();
  const assignments = [];
  walk.full(ast, node => {
    if (node.type === 'VariableDeclarator' && node.init) assignments.push([node.id, node.init]);
    else if (node.type === 'AssignmentExpression' && node.operator === '=') assignments.push([node.left, node.right]);
  });
  const classify = expression => {
    const node = unwrap(expression);
    if (!node) return null;
    if (node.type === 'Identifier') return writes.has(node.name) || dangerous.has(node.name) ? 'write' : dispatch.has(node.name) ? 'dispatch' : null;
    if (node.type === 'MemberExpression') {
      const name = propertyName(node);
      if ((name === 'call' || name === 'apply') && classify(node.object)) return classify(node.object);
      const owner = unwrap(node.object);
      const member = owner?.type === 'Identifier' && name !== null ? `${owner.name}.${name}` : null;
      if (member && dangerousMembers.has(member)) return 'write';
      if (member && dispatchMembers.has(member)) return 'dispatch';
      if (writes.has(name)) return 'write';
      if (dispatchers.has(name)) return 'dispatch';
      if (node.computed && name === null) return 'dynamic';
    }
    if (node.type === 'CallExpression' && propertyName(node.callee) === 'bind') return classify(node.callee.object);
    if (node.type === 'ConditionalExpression' || node.type === 'LogicalExpression') {
      const left = classify(node.type === 'ConditionalExpression' ? node.consequent : node.left);
      const right = classify(node.type === 'ConditionalExpression' ? node.alternate : node.right);
      if (left === 'write' || left === 'dynamic' || right === 'write' || right === 'dynamic') return 'write';
      return left || right;
    }
    if (node.type === 'SequenceExpression') return classify(node.expressions.at(-1));
    return null;
  };
  let changed = true;
  while (changed) {
    changed = false;
    const propagate = (target, value) => {
      if (target.type === 'Identifier') {
        const kind = classify(value);
        const set = kind === 'write' || kind === 'dynamic' ? dangerous : kind === 'dispatch' ? dispatch : null;
        if (set && !set.has(target.name)) { set.add(target.name); changed = true; }
        const source = unwrap(value);
        if (source?.type === 'Identifier') {
          for (const [members, prefix] of [[dangerousMembers, `${source.name}.`], [dispatchMembers, `${source.name}.`]]) {
            for (const member of [...members]) {
              if (!member.startsWith(prefix)) continue;
              const alias = `${target.name}.${member.slice(prefix.length)}`;
              if (!members.has(alias)) { members.add(alias); changed = true; }
            }
          }
        }
        if (source?.type === 'ObjectExpression') {
          for (const part of source.properties) {
            const name = propertyName({ type: 'MemberExpression', computed: part.computed, property: part.key });
            const kind = part.type === 'Property' ? classify(part.value) : null;
            const set = kind === 'write' || kind === 'dynamic' ? dangerousMembers : kind === 'dispatch' ? dispatchMembers : null;
            const member = name === null ? null : `${target.name}.${name}`;
            if (set && member && !set.has(member)) { set.add(member); changed = true; }
          }
        }
      } else if (target.type === 'MemberExpression') {
        const owner = unwrap(target.object);
        const name = propertyName(target);
        const member = owner?.type === 'Identifier' && name !== null ? `${owner.name}.${name}` : null;
        const kind = classify(value);
        const set = kind === 'write' || kind === 'dynamic' ? dangerousMembers : kind === 'dispatch' ? dispatchMembers : null;
        if (set && member && !set.has(member)) { set.add(member); changed = true; }
      } else if (target.type === 'AssignmentPattern') {
        propagate(target.left, classify(value) ? value : target.right);
      } else if (target.type === 'ObjectPattern') {
        const source = unwrap(value);
        for (const part of target.properties) {
          const name = part.computed ? part.key.value : part.key.name;
          const member = source?.type === 'Identifier' && name !== null ? `${source.name}.${name}` : null;
          const set = writes.has(name) || (member && dangerousMembers.has(member)) ? dangerous
            : dispatchers.has(name) || (member && dispatchMembers.has(member)) ? dispatch : null;
          const binding = part.value?.type === 'AssignmentPattern' ? part.value.left : part.value;
          if (set && binding?.type === 'Identifier' && !set.has(binding.name)) { set.add(binding.name); changed = true; }
        }
      } else if (target.type === 'ArrayPattern' && unwrap(value)?.type === 'ArrayExpression') {
        target.elements.forEach((element, index) => { if (element) propagate(element, unwrap(value).elements[index]); });
      }
    };
    for (const [target, value] of assignments) {
      propagate(target, value);
    }
  }
  let found = false;
  walk.full(ast, node => {
    if (found || node.type !== 'CallExpression') return;
    const kind = classify(node.callee);
    if (kind === 'write' || kind === 'dynamic') { found = true; return; }
    if (kind !== 'dispatch') return;
    const first = unwrap(node.arguments[0]);
    if (first?.type === 'Literal' && typeof first.value === 'string') found = writes.has(first.value);
    else if (first?.type === 'ObjectExpression') {
      const part = first.properties.find(item => propertyName(item) === 'name' || item.key?.name === 'name' || item.key?.value === 'name');
      const value = unwrap(part?.value);
      found = !value || value.type !== 'Literal' || typeof value.value !== 'string' || writes.has(value.value);
    } else found = true;
  });
  return found;
}

export function findWriteCapabilityInvocation(content) {
  if (/^(?:\$\s*)?(?:npx\s+)?redbook\s+(?:post|publish|publish_content|comment|reply|batch-reply|like|unlike|collect|uncollect|favorite|unfavorite|follow|unfollow)\b/im.test(content)) return '写能力调用';
  for (const source of fragments(content)) {
    const ast = parseProgram(source);
    if (ast && astHasWrite(ast)) return '写能力调用';
    if (/^(?:\$\s*)?(?:npx\s+)?redbook\s+(?:post|publish|publish_content|comment|reply|batch-reply|like|unlike|collect|uncollect|favorite|unfavorite|follow|unfollow)\b/im.test(source)) return '写能力调用';
  }
  return null;
}

const textExtensions = new Set(['.bash', '.c', '.cjs', '.conf', '.config', '.cpp', '.css', '.csv', '.env', '.example', '.fish', '.go', '.graphql', '.h', '.hpp', '.html', '.ini', '.java', '.js', '.json', '.jsonl', '.jsx', '.kt', '.md', '.mjs', '.php', '.ps1', '.py', '.rb', '.rs', '.scss', '.sh', '.sql', '.svelte', '.toml', '.ts', '.tsx', '.txt', '.vue', '.xml', '.yaml', '.yml', '.zsh']);
export function shouldAuditTextFile(file) { return textExtensions.has(path.extname(file).toLowerCase()) || /^(?:\.env(?:\.example)?|\.npmrc|\.yarnrc)$/i.test(path.basename(file)) || /^(?:dockerfile|makefile)$/i.test(path.basename(file)); }

function git(args, label, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${label}\n${result.stderr || ''}`);
  return result.stdout;
}

function inspect(scope, file, content, errors, forced = false) {
  const reason = file && findForbiddenPath(file);
  if (reason) errors.push(`${scope}:${file}: 禁入项（${reason}）`);
  if (!forced && (!file || !shouldAuditTextFile(file))) return;
  if (content.includes('\0')) return;
  const secret = findSecret(content);
  if (secret) errors.push(`${scope}:${file}: ${secret}`);
  const call = findWriteCapabilityInvocation(content);
  if (call) errors.push(`${scope}:${file}: ${call}`);
}

async function collectLimited(stream) {
  const decoder = new TextDecoder();
  let content = '';
  let size = 0;
  let oversized = false;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_TEXT_BLOB_BYTES) { oversized = true; content = ''; continue; }
    content += decoder.decode(chunk, { stream: true });
  }
  if (!oversized) content += decoder.decode();
  return { oversized, size, content: oversized ? null : content };
}

async function readGitObject(spec, label) {
  const child = spawn('git', ['show', spec], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { if (stderr.length < 8192) stderr += chunk; });
  const result = await collectLimited(child.stdout);
  const status = await new Promise(resolve => child.on('close', resolve));
  if (status !== 0) throw new Error(`${label}\n${stderr}`);
  return result;
}

function reportOversized(scope, file, size, errors) {
  errors.push(`${scope}:${file}: 超大对象无法安全审计（${size} bytes > ${MAX_TEXT_BLOB_BYTES} bytes）`);
}

async function readBlobs(records, errors) {
  const child = spawn('git', ['cat-file', '--batch'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  for (const record of records) child.stdin.write(`${record.oid}\n`);
  child.stdin.end();
  const streamChunks = async function* (stream) { for await (const piece of stream) yield piece; };
  const iterator = streamChunks(child.stdout);
  let chunk = Buffer.alloc(0);
  let offset = 0;
  const refill = async () => {
    while (offset >= chunk.length) {
      const next = await iterator.next();
      if (next.done) return false;
      chunk = next.value;
      offset = 0;
    }
    return true;
  };
  const readByte = async () => (await refill()) ? chunk[offset++] : null;
  const readLine = async () => {
    let line = '';
    while (true) {
      const byte = await readByte();
      if (byte === null) return null;
      if (byte === 10) return line;
      if (line.length >= 1024) throw new Error('历史 blob 批处理响应头过长');
      line += String.fromCharCode(byte);
    }
  };
  const readContent = async size => {
    const decoder = new TextDecoder();
    let content = '';
    let remaining = size;
    while (remaining > 0) {
      if (!(await refill())) return null;
      const length = Math.min(remaining, chunk.length - offset);
      content += decoder.decode(chunk.subarray(offset, offset + length), { stream: true });
      offset += length;
      remaining -= length;
    }
    return content + decoder.decode();
  };
  let index = 0;
  for (const record of records) {
    const header = await readLine();
    const match = header?.match(/^([0-9a-f]+) blob (\d+)$/);
    if (!match || record.oid !== match[1] || Number(match[2]) > MAX_TEXT_BLOB_BYTES) throw new Error(`历史 blob 批处理响应无效：${header ?? '[EOF]'}`);
    const content = await readContent(Number(match[2]));
    if (content === null || await readByte() !== 10) throw new Error(`历史 blob ${record.oid} 的内容不可完整读取`);
    const label = record.file || `<blob-${record.oid.slice(0, 12)}>`;
    inspect(`history:${record.oid.slice(0, 12)}`, label, content, errors, !record.file);
    index += 1;
  }
  const status = await new Promise(resolve => child.on('close', resolve));
  if (status !== 0) throw new Error(`无法流式读取可达历史 blob\n${stderr}`);
  if (await readByte() !== null || index !== records.length) throw new Error('可达历史 blob 流不完整');
}

async function main() {
  const errors = [];
  let worktreeFiles;
  let indexFiles;
  try {
    indexFiles = git(['ls-files', '--cached', '-z'], '无法读取 Git index').split('\0').filter(Boolean);
    worktreeFiles = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], '无法列举 Git 工作树').split('\0').filter(Boolean);
  } catch (error) { process.stderr.write(`FAIL ${error.message}`); process.exit(2); }
  for (const file of worktreeFiles) {
    try {
      const result = await collectLimited(createReadStream(path.join(root, file)));
      if (result.oversized) reportOversized('worktree', file, result.size, errors);
      else inspect('worktree', file, result.content, errors);
    }
    catch (error) { if (error.code !== 'ENOENT') { process.stderr.write(`FAIL 无法读取工作树中的 ${file}\n${error.message}\n`); process.exit(2); } }
  }
  try {
    if (indexFiles.some(file => /[\r\n]/.test(file))) throw new Error('Git index 路径包含无法安全批处理的控制字符');
    const indexChecks = indexFiles.length ? git(['cat-file', '--batch-check=%(objecttype) %(objectsize)'], '无法检查 Git index 对象', { input: `${indexFiles.map(file => `:${file}`).join('\n')}\n` }).split(/\r?\n/).filter(Boolean) : [];
    if (indexChecks.length !== indexFiles.length) throw new Error('Git index 对象检查不完整');
    for (let index = 0; index < indexFiles.length; index += 1) {
      const file = indexFiles[index];
      const [type, rawSize] = indexChecks[index].split(' ');
      const size = Number(rawSize);
      if (type !== 'blob' || !Number.isSafeInteger(size)) throw new Error(`Git index 对象元数据无效：${file}`);
      if (size > MAX_TEXT_BLOB_BYTES) { reportOversized('index', file, size, errors); continue; }
      const result = await readGitObject(`:${file}`, `无法读取 Git index 中的 ${file}`);
      if (result.oversized) reportOversized('index', file, result.size, errors);
      else inspect('index', file, result.content, errors);
    }
  } catch (error) {
    process.stderr.write(`FAIL ${error.message}`); process.exit(2);
  }
  let blobs = [];
  try {
    const objects = git(['-c', 'core.quotePath=false', 'rev-list', '--objects', '--all'], '无法列举全部可达 Git 对象').split(/\r?\n/).filter(Boolean).map(line => {
      const split = line.indexOf(' ');
      const file = split < 0 ? '' : line.slice(split + 1);
      if (file.startsWith('"')) throw new Error(`可达 Git 对象路径包含无法无歧义解析的控制字符：${file}`);
      return { oid: split < 0 ? line : line.slice(0, split), file };
    });
    if (objects.length) {
      const checks = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], '无法检查可达 Git 对象', { input: `${objects.map(item => item.oid).join('\n')}\n` }).split(/\r?\n/).filter(Boolean);
      if (checks.length !== objects.length) throw new Error('可达 Git 对象类型检查不完整');
      blobs = objects.flatMap((object, index) => {
        const [oid, type, rawSize] = checks[index].split(' ');
        if (oid !== object.oid || !Number.isSafeInteger(Number(rawSize))) throw new Error(`可达 Git 对象元数据无效：${checks[index]}`);
        return type === 'blob' ? [{ ...object, size: Number(rawSize) }] : [];
      });
      const changed = git(['-c', 'core.quotePath=false', 'log', '--all', '--format=', '--name-only', '-z', '--diff-filter=AM'], '无法列举历史变更路径').split('\0').map(file => file.replace(/^\r?\n+/, '')).filter(Boolean);
      for (const file of changed) { const reason = findForbiddenPath(file); if (reason) errors.push(`history:path:${file}: 禁入项（${reason}）`); }
      for (const blob of blobs) { const reason = blob.file && findForbiddenPath(blob.file); if (reason) errors.push(`history:${blob.oid.slice(0, 12)}:${blob.file}: 禁入项（${reason}）`); }
      const readableBlobs = [];
      for (const blob of blobs) {
        const label = blob.file || `<blob-${blob.oid.slice(0, 12)}>`;
        if (blob.size > MAX_TEXT_BLOB_BYTES) reportOversized(`history:${blob.oid.slice(0, 12)}`, label, blob.size, errors);
        else readableBlobs.push(blob);
      }
      await readBlobs(readableBlobs, errors);
    }
  } catch (error) { process.stderr.write(`FAIL ${error.message}`); process.exit(2); }
  if (errors.length) { [...new Set(errors)].forEach(error => console.error(`FAIL ${error}`)); process.exit(1); }
  console.log(`PASS 三范围安全审计通过（工作树 ${worktreeFiles.length} 个文件；index ${indexFiles.length} 个文件；历史 ${blobs.length} 个 blob；零凭据、零写能力调用）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

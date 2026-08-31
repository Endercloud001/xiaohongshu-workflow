import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  findForbiddenPath,
  findSecret,
  findWriteCapabilityInvocation,
  shouldAuditTextFile,
} from './security-audit.mjs';

const auditScript = fileURLToPath(new URL('./security-audit.mjs', import.meta.url));
const runAudit = (repo, timeout = 15_000) => spawnSync(process.execPath, [auditScript], {
  cwd: repo,
  encoding: 'utf8',
  env: { ...process.env, SECURITY_AUDIT_ROOT: repo },
  timeout,
});

test('audits common text source extensions but skips binary assets', () => {
  for (const file of ['src/app.js', 'src/app.ts', 'src/view.tsx', 'scripts/tool.ps1', 'config/settings.toml', 'tool.sh', '.npmrc']) {
    assert.equal(shouldAuditTextFile(file), true, file);
  }
  assert.equal(shouldAuditTextFile('images/cover.png'), false);
});

test('rejects local authentication and runtime paths', () => {
  assert.match(findForbiddenPath('browser-profile/Default/Cookies') ?? '', /Cookie|profile/i);
  assert.match(findForbiddenPath('cookie.json') ?? '', /Cookie|会话/i);
  assert.match(findForbiddenPath('session.json') ?? '', /Cookie|会话/i);
  assert.match(findForbiddenPath('profile/Default/Preferences') ?? '', /profile/i);
  assert.match(findForbiddenPath('token.txt') ?? '', /凭据|密钥/i);
  assert.match(findForbiddenPath('auth/identity.json') ?? '', /Cookie|会话|凭据/i);
  for (const file of ['xhs-cookie.json', 'xhs-cookies.json', 'session-store.json']) {
    assert.match(findForbiddenPath(file) ?? '', /Cookie|会话/i, file);
  }
  assert.match(findForbiddenPath('chrome-profile/Default/Cookies') ?? '', /profile/i);
  assert.match(findForbiddenPath('token.yaml') ?? '', /凭据|密钥/i);
  assert.match(findForbiddenPath('bin/tool.cmd') ?? '', /可执行文件/i);
  assert.match(findForbiddenPath('01-账号/账号档案.md') ?? '', /真实账号档案/);
  assert.equal(findForbiddenPath('01-账号/账号档案.example.md'), null);
  assert.equal(findForbiddenPath('fixtures/session.json'), null);
  assert.equal(findForbiddenPath('examples/token.txt.example'), null);
  assert.match(findForbiddenPath('LICENSE.key') ?? '', /密钥|证书/i);
  assert.equal(findForbiddenPath('src/profile.js'), null);
  assert.equal(findForbiddenPath('src/token.js'), null);
  assert.equal(findForbiddenPath('examples/xhs-cookie.json.example'), null);
  assert.equal(findForbiddenPath('fixtures/chrome-profile/Preferences'), null);
  assert.equal(findForbiddenPath('node_modules/pkg/LICENSE'), 'node_modules');
  assert.equal(findForbiddenPath('fixtures/node_modules/pkg/index.js'), 'node_modules');
});

test('detects credential-like content without flagging placeholders', () => {
  const fakeCredential = ['API', '_KEY=', 'sk-', 'live_', '12345678901234567890'].join('');
  assert.match(findSecret(fakeCredential) ?? '', /疑似凭据/);
  for (const name of [['to', 'ken'], ['api_', 'key'], ['client_', 'secret'], ['pass', 'word']]) {
    const assignment = [name.join(''), '=', 'short-', 'but-real'].join('');
    assert.match(findSecret(assignment) ?? '', /疑似凭据/);
  }
  assert.equal(findSecret(['API', '_KEY=your_', 'api_key_here'].join('')), null);
  assert.equal(findSecret('note_url=https://example.invalid/demo'), null);
  assert.equal(findSecret(['const sec', 'ret = findSecret(content);'].join('')), null);
  assert.equal(findSecret(['to', 'ken = process.', 'env.TOKEN'].join('')), null);
  assert.equal(findSecret(['pass', 'word: config.', 'password'].join('')), null);
  assert.match(findSecret(['<div data-to', 'ken="real-secret-value">'].join('')) ?? '', /疑似凭据/);
  assert.match(findSecret(['api_', 'key="real-secret-value"; docs="https://example.invalid"'].join('')) ?? '', /疑似凭据/);
  assert.match(findSecret(['to', 'ken=process.env.TOKEN; pass', 'word="real-secret-value"'].join('')) ?? '', /疑似凭据/);
  assert.match(findSecret(['api_', 'key=your_api_key_here; to', 'ken="real-secret-value"'].join('')) ?? '', /疑似凭据/);
  assert.match(findSecret(['_auth', 'Token=', 'npm_', 'runtime-secret-value'].join('')) ?? '', /疑似凭据/);
  assert.match(findSecret(['Author', 'ization: Bearer ', 'runtime-secret-value'].join('')) ?? '', /疑似凭据/);
  assert.equal(findSecret(['_auth', 'Token=${NPM_TOKEN}'].join('')), null);
  assert.equal(findSecret(['Author', 'ization: Bearer <token>'].join('')), null);
});

test('only permits complete approved credential placeholders', () => {
  const value = (...parts) => parts.join('');
  for (const content of [
    value('API_', 'KEY=prefix-your_api_key-suffix'),
    value('pass', 'word=replace_me-but-real'),
    value('Author', 'ization: Bearer abc<token>xyz'),
    value('to', 'ken=https://example.invalid/demo-real-token'),
    value('to', 'ken=${TOKEN}-real-secret'),
  ]) assert.match(findSecret(content) ?? '', /疑似凭据/, content);

  for (const content of [
    value('API_', 'KEY=your_api_key'),
    value('API_', 'KEY=your-api-key-here'),
    value('pass', 'word=replace_me'),
    value('Author', 'ization: Bearer <token>'),
    value('to', 'ken=${TOKEN}'),
  ]) assert.equal(findSecret(content), null, content);
});

test('sensitive key and certificate extensions override example, fixture and license exceptions', () => {
  for (const file of [
    'LICENSE.key',
    'fixtures/demo.pem',
    'fixtures/LICENSE.p12',
    'examples/certificate.example.pfx',
    'fixtures/client.example.ppk',
    'examples/LICENSE.pvk',
    'fixtures/chain.p7b',
    'examples/chain.example.p7c',
  ]) assert.match(findForbiddenPath(file) ?? '', /密钥|证书/i, file);

  assert.equal(findForbiddenPath('LICENSE'), null);
  assert.equal(findForbiddenPath('fixtures/README.md'), null);
});

test('rejects archives and logs even inside public examples or fixtures', () => {
  for (const file of [
    'release.zip',
    'fixtures/debug.log',
    'examples/archive.example.tar',
    'backup.tar.gz',
    'bundle.tgz',
  ]) assert.match(findForbiddenPath(file) ?? '', /压缩|日志/i, file);
});

test('detects common API key, JWT, AWS, bearer, password and embedded URL credentials', () => {
  const value = (...parts) => parts.join('');
  const cases = [
    value('OPENAI_API_', 'KEY=sk-proj-', '1234567890abcdefghijklmnop'),
    value('to', 'ken=eyJhbGciOiJIUzI1NiJ9.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0.', 'signature123456'),
    value('AWS_ACCESS_', 'KEY_ID=AKIA', 'IOSFODNN7EXAMPLE'),
    value('Author', 'ization: Bearer ', 'abcdefghijklmnopqrstuvwxyz123456'),
    value('pass', 'word=correct-horse-battery-staple'),
    value('endpoint=https://alice:', 'real-password@localhost:18060/mcp'),
  ];
  for (const content of cases) assert.match(findSecret(content) ?? '', /疑似凭据|私钥/, content);
});

test('detects encrypted private keys and PuTTY private key content', () => {
  const encrypted = ['-----BEGIN ENCRYPTED ', 'PRIVATE KEY-----'].join('');
  const putty = ['PuTTY-User-Key-File-', '3: ssh-rsa'].join('');
  assert.match(findSecret(encrypted) ?? '', /私钥/);
  assert.match(findSecret(putty) ?? '', /私钥/);
});

test('detects executable publish and interaction calls but permits prohibition docs', () => {
  const publishCall = ['await client.', 'publish_content', '(payload)'].join('');
  const interactionCall = ['redbook ', 'post', ' --title demo'].join('');
  assert.match(findWriteCapabilityInvocation(publishCall) ?? '', /写能力调用/);
  assert.match(findWriteCapabilityInvocation(interactionCall) ?? '', /写能力调用/);
  for (const call of [
    ['publish_', 'content(payload)'].join(''),
    ['client["com', 'ment"](text)'].join(''),
    ['const doLike = redbook.', 'like; await doLike(note)'].join(''),
    ['const doCollect = redbook.', 'collect;', '\nawait doCollect(note)'].join(''),
    ['const { fol', 'low } = client; fol', 'low(user)'].join(''),
    ['const { li', 'ke: doLike } = redbook; doLike(note)'].join(''),
    ['const result = li', 'ke(note)'].join(''),
    ['return li', 'ke(note)'].join(''),
    ['const fn = () => li', 'ke(note)'].join(''),
    ['不调用旧接口；client.li', 'ke(note)'].join(''),
    ['redbook ', 'like note-id'].join(''),
    ['client.fa', 'vorite(note)'].join(''),
  ]) assert.match(findWriteCapabilityInvocation(call) ?? '', /写能力调用/);
  assert.equal(findWriteCapabilityInvocation('不调用 `publish_content`。'), null);
  assert.equal(findWriteCapabilityInvocation(['禁止 client.li', 'ke(note)'].join('')), null);
});

test('prohibition wording cannot hide executable write calls', () => {
  const call = (...parts) => parts.join('');
  for (const content of [
    call('禁止自动发布; client.li', 'ke(note)'),
    call('const policy = "只读"; client.li', 'ke(note)'),
    call('/* 禁止调用 */ client.li', 'ke(note)'),
    call('client[opera', 'tion](note)'),
    call('const operation = "li', 'ke"; client[opera', 'tion](note)'),
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);

  for (const content of [
    call('// client.li', 'ke(note)'),
    call('/* client.li', 'ke(note) */'),
    call('禁止调用 `client.li', 'ke(note)`。'),
  ]) assert.equal(findWriteCapabilityInvocation(content), null, content);
});

test('JavaScript string comment delimiters cannot hide adjacent write calls', () => {
  const call = (...parts) => parts.join('');
  for (const content of [
    call('const marker = "/*"; client.li', 'ke(note); const end = "*/";'),
    call("const marker = '//'; client.fol", 'low(user)'),
    call("const marker = '/*'; client[operation](note); const end = '*/';"),
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);
});

test('scans template interpolations and regex literals as JavaScript code', () => {
  const op = (...parts) => parts.join('');
  const publish = op('publish_', 'content');
  const like = op('li', 'ke');
  for (const content of [
    `const message = \`result: \${client.${publish}({ title })}\`;`,
    `const nested = \`outer \${\`inner \${client.${like}(note)}\`}\`;`,
    `const matcher = /[//]/; client.${publish}(payload);`,
    `const matcher = /https?:\\/\\//; client.${like}(note);`,
    `function matches(value) { return /[//]/.test(value); } client.${like}(note);`,
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);

  assert.equal(findWriteCapabilityInvocation(`const sample = \`client.${like}(note)\`;`), null);
});

test('detects sequence-expression and distant multiline aliases without a fixed window', () => {
  const op = (...parts) => parts.join('');
  const padding = Array.from({ length: 80 }, (_, index) => `const safe${index} = ${index};`).join('\n');
  for (const content of [
    `(0, client.${op('publish_', 'content')})(payload)`,
    `const writer = client.${op('li', 'ke')};\n${padding}\nawait writer(note)`,
    `const { ${op('fol', 'low')}: doFollow } = client;\n${padding}\nawait doFollow(user)`,
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);
});

test('propagates executable write aliases through common JavaScript data-flow forms', () => {
  const op = (...parts) => parts.join('');
  const write = op('publish_', 'content');
  for (const content of [
    `const p = api.${write}.bind(api); p()`,
    `const p = ok ? api.${write} : api.post; p()`,
    `const p = api.${write} || api.post; p()`,
    `const {${write}: p = fallback}=api; p()`,
    `const [p]=[api.${write}]; p()`,
    `说明文字跨行，下面才是实际代码。\nconst p=api.${write};\np()`,
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);

  for (const prose of [
    `普通文档说明 const p=api.${write}; p()，这里只是在解释禁用规则。`,
    `不要执行以下写操作：\n\`const p=api.${write}; p()\``,
  ]) assert.equal(findWriteCapabilityInvocation(prose), null, prose);
});

test('propagates aliased object slots through whole-object aliases and destructuring', () => {
  const op = (...parts) => parts.join('');
  const write = op('publish_', 'content');
  for (const content of [
    `const slot={p:api.${write}}; const alias=slot; alias.p()`,
    `const slot={p:api.${write}}; const {p}=slot; p()`,
    `const slot={p:api.${write}}; const alias=slot; const {p}=alias; p()`,
    `const slot={}; slot.p=api.${write}; const alias=slot; alias.p()`,
    `const slot={}; slot.p=api.${write}; const {p}=slot; p()`,
    `const slot={p:api.${write}}; const alias=slot; alias?.p?.()`,
    `<button onclick="const slot={p:api.${write}}; const alias=slot; alias?.p?.()">run</button>`,
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);

  for (const inert of [
    `普通文档说明 const slot={p:api.${write}}; const alias=slot; alias.p()，这里只是在解释规则。`,
    `const sample="const slot={p:api.${write}}; const alias=slot; alias.p()"`,
    `<div data-example="const slot={p:api.${write}}; alias.p()"></div>`,
  ]) assert.equal(findWriteCapabilityInvocation(inert), null, inert);
});

test('propagates recursive object slots through nesting, destructuring, and spread', () => {
  const op = (...parts) => parts.join('');
  const write = op('publish_', 'content');
  for (const content of [
    `const box={p:api.${write}}; const copy={...box}; copy.p()`,
    `const box={inner:{p:api.${write}}}; box.inner.p()`,
    `const box={inner:{p:api.${write}}}; const {inner:{p}}=box; p()`,
    `const box={inner:{p:api.${write}}}; const copy={...box}; copy.inner.p()`,
    `const box={inner:{p:api.${write}}}; box[key].p()`,
    `const box={inner:{p:api.${write}}}; const {p}=box[key]; p()`,
    `const x=box[key]; x.p()`,
    `const copy={...box[key]}; copy.p()`,
    `const {[key]:{p}}=box; p()`,
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);

  for (const inert of [
    `普通文档说明 const box={inner:{p:api.${write}}}; box.inner.p()，这里只是在解释规则。`,
    `const sample="const box={inner:{p:api.${write}}}; box.inner.p()"`,
    `// const box={inner:{p:api.${write}}}; box.inner.p()`,
  ]) assert.equal(findWriteCapabilityInvocation(inert), null, inert);

  assert.match(findWriteCapabilityInvocation(
    `<button onclick="const box={inner:{p:api.${write}}}; const {inner:{p}}=box; p()">run</button>`,
  ) ?? '', /写能力调用/);
});

test('rejects extensionless private-key paths before fixture and license exceptions', () => {
  for (const file of [
    '.ssh/id_rsa',
    '.ssh/id_ed25519',
    'keys/id_dsa',
    'fixtures/.ssh/id_rsa',
    'fixtures/keys/id_ed25519',
    'LICENSE/id_dsa',
  ]) assert.match(findForbiddenPath(file) ?? '', /密钥|私钥|凭据/i, file);
});

test('detects additional private-key armor formats', () => {
  const armor = (...parts) => parts.join('');
  for (const content of [
    armor('-----BEGIN DSA ', 'PRIVATE KEY-----'),
    armor('-----BEGIN PGP ', 'PRIVATE KEY BLOCK-----'),
    armor('-----BEGIN SSH2 ENCRYPTED ', 'PRIVATE KEY-----'),
  ]) assert.match(findSecret(content) ?? '', /私钥/, content);
});

test('keeps multiline Markdown and HTML policy prose inert but not embedded executable code', () => {
  const op = (...parts) => parts.join('');
  const call = `client.${op('publish_', 'content')}(payload)`;
  for (const document of [
    `The call ${call}\nis prohibited and must never be executed.`,
    `<p>The call ${call}\nis prohibited and shown only for documentation.</p>`,
    `普通文档说明 ${call}\n是禁止行为，不会执行。`,
  ]) assert.equal(findWriteCapabilityInvocation(document), null, document);

  for (const executable of [
    `The call is prohibited.\nconst run = () => ${call};`,
    `<p>${call} is prohibited.</p>\n${call};`,
    `<script>${call};</script>`,
    `<button onclick="${call}">Do not run</button>`,
    `禁止调用说明：${call}\n\`result: \${${call}}\``,
  ]) assert.match(findWriteCapabilityInvocation(executable) ?? '', /写能力调用/, executable);
});

test('detects optional and dynamic write dispatch in HTML event attributes only', () => {
  const code = (...parts) => parts.join('');
  const event = (name, handler) => `<button on${name}="${handler}">Run</button>`;
  for (const markup of [
    event('click', code('client?.li', 'ke?.(note)')),
    event('click', code('client[opera', 'tion](note)')),
    event('click', code('client[opera', 'tion]?.(note)')),
    event('focus', code('client.call', 'Tool(operation, payload)')),
    event('change', code('mcp.invoke?.(operation, payload)')),
  ]) assert.match(findWriteCapabilityInvocation(markup) ?? '', /写能力调用/, markup);

  for (const inert of [
    `<div data-example="${code('client[opera', 'tion](note)')}">Example</div>`,
    event('click', `showExample('${code('client[opera', 'tion](note)')}')`),
    `<!-- ${event('click', code('client[opera', 'tion](note)'))} -->`,
    `<p>示例：${code('client[opera', 'tion](note)')}</p>`,
  ]) assert.equal(findWriteCapabilityInvocation(inert), null, inert);
});

test('does not mistake method declarations for write invocations', () => {
  const inert = (...parts) => parts.join('');
  for (const content of [
    inert('class Client { li', 'ke(note) { return note; } }'),
    inert('class Client { async fol', 'low(user) { return user; } }'),
    inert('class Client {\n  li', 'ke(note) { return note; }\n}'),
    inert('interface Client { li', 'ke(note: Note): Promise<void>; }'),
    inert('interface Client {\n  fol', 'low(user: User): void;\n}'),
    inert('type Client = { fol', 'low(user: User): void }'),
  ]) assert.equal(findWriteCapabilityInvocation(content), null, content);
});

test('flags dynamic member calls conservatively but permits dynamic member declarations', () => {
  const code = (...parts) => parts.join('');
  for (const content of [
    code('client[opera', 'tion](note)'),
    code('sdk[getOpera', 'tion()](payload)'),
    code('redbook[`li${ki', 'nd}`](note)'),
  ]) assert.match(findWriteCapabilityInvocation(content) ?? '', /写能力调用/, content);

  assert.equal(findWriteCapabilityInvocation(code('class Client { [opera', 'tion](note) {} }')), null);
});

test('keeps a static method call safe when only its receiver path is dynamically indexed', () => {
  assert.equal(findWriteCapabilityInvocation('const line = codeLines[index].trim()'), null);
  assert.equal(findWriteCapabilityInvocation('const box={inner:{p:api.publish_content}}; box[key].trim()'), null);
  assert.match(findWriteCapabilityInvocation('clients[index][operation](payload)') ?? '', /写能力调用/);
  assert.match(findWriteCapabilityInvocation('clients[index].like(note)') ?? '', /写能力调用/);
  assert.match(findWriteCapabilityInvocation('const box={inner:{p:api.publish_content}}; box[key].p()') ?? '', /写能力调用/);
});

test('detects MCP and SDK write dispatch while permitting read calls and inert examples', () => {
  const op = (...parts) => parts.join('');
  for (const call of [
    `client.callTool({name:'${op('publish_', 'content')}', arguments: payload})`,
    `client.callTool('${op('publish_', 'content')}', payload)`,
    `mcp.invoke('${op('li', 'ke')}', note)`,
    `redbook.${op('po', 'st')}(payload)`,
    `sdk.callTool({ name: "${op('com', 'ment')}" })`,
    `mcp.invoke("${op('fol', 'low')}", user)`,
  ]) assert.match(findWriteCapabilityInvocation(call) ?? '', /写能力调用/, call);

  for (const safeCall of [
    "client.callTool({name:'search_notes', arguments: query})",
    "client.callTool('get_note', noteId)",
    "mcp.invoke('list_tools')",
    'redbook.search(query)',
    `const sample = "client.callTool({name:'${op('publish_', 'content')}'})"`,
    `不调用 client.callTool({name:'${op('publish_', 'content')}'})。`,
  ]) assert.equal(findWriteCapabilityInvocation(safeCall), null, safeCall);
});

test('keeps ordinary JavaScript strings and HTML or Markdown examples inert', () => {
  const op = (...parts) => parts.join('');
  const sample = `client.${op('li', 'ke')}(note)`;
  for (const inert of [
    `console.log("${sample}")`,
    `const x = { sample: "${sample}" }`,
    `<p>示例：${sample}</p>`,
    `普通 Markdown 示例：${sample}`,
    `[![Like](https://example.invalid/${op('li', 'ke')}(note))](#)`,
  ]) assert.equal(findWriteCapabilityInvocation(inert), null, inert);
});

test('detects optional chaining, object dispatch and unknown aliases conservatively', () => {
  const op = (...parts) => parts.join('');
  for (const call of [
    `client.callTool({name: operation, arguments: payload})`,
    `client.invoke?.(operation, payload)`,
    `tool[operation](payload)`,
    `client?.${op('li', 'ke')}?.(note)`,
    `const writer = client; writer.${op('li', 'ke')}(note)`,
    `const dispatch = client.callTool; dispatch(operation, payload)`,
  ]) assert.match(findWriteCapabilityInvocation(call) ?? '', /写能力调用/, call);
});

test('detects sequence calls, computed aliases, invoke aliases and later assignments', () => {
  const op = (...parts) => parts.join('');
  for (const call of [
    `(0, client.${op('li', 'ke')})?.(note)`,
    `const fn = client['${op('li', 'ke')}']; fn(note)`,
    'const dispatch = client.invoke; dispatch(operation, payload)',
    `let fn; fn = client.${op('li', 'ke')}; fn(note)`,
    'let dispatch; dispatch = client.invoke; dispatch(operation, payload)',
    `if (ok) /https?:\\/\\//.test(url); client.${op('li', 'ke')}(note);`,
  ]) assert.match(findWriteCapabilityInvocation(call) ?? '', /写能力调用/, call);
});

test('analyzes template interpolation expressions but not template text', () => {
  const op = (...parts) => parts.join('');
  assert.equal(findWriteCapabilityInvocation(`\`client.${op('li', 'ke')}(note)\``), null);
  assert.match(findWriteCapabilityInvocation(`\`result: \${client.${op('li', 'ke')}(note)}\``) ?? '', /写能力调用/);
});

test('parses quoted and unquoted HTML handlers and scripts as executable code', () => {
  const op = (...parts) => parts.join('');
  for (const html of [
    `<button onclick=client.${op('li', 'ke')}(note)>go</button>`,
    `<button onclick="(0, client.${op('li', 'ke')})?.(note)">go</button>`,
    `<script>const fn = client['${op('li', 'ke')}']; fn(note)</script>`,
  ]) assert.match(findWriteCapabilityInvocation(html) ?? '', /写能力调用/, html);

  assert.equal(findWriteCapabilityInvocation(`<div data-example="client.${op('li', 'ke')}(note)"></div>`), null);
});

test('keeps multiline prose and ordinary HTML text inert', () => {
  const op = (...parts) => parts.join('');
  for (const prose of [
    `普通说明跨越多行，提到了 client.${op('li', 'ke')}(note)\n但这里只是在解释禁止调用。`,
    `<section><p>普通说明提到 client.${op('li', 'ke')}(note)</p><p>这不是可执行代码。</p></section>`,
  ]) assert.equal(findWriteCapabilityInvocation(prose), null, prose);
});

test('keeps Markdown examples inert inside mixed Markdown and HTML documents', () => {
  const op = (...parts) => parts.join('');
  const example = `client.${op('com', 'ment')}(note)`;
  for (const markdown of [
    `普通 Markdown 说明 ${example} 不会执行。`,
    `普通 Markdown 行内示例：\`${example}\`。`,
    ['```js', example, '```'].join('\n'),
    ['<p>普通 HTML 标签</p>', '', '```js', example, '```'].join('\n'),
  ]) assert.equal(findWriteCapabilityInvocation(markdown), null, markdown);

  for (const executable of [
    ['<p>普通 HTML 标签</p>', '', `<script>${example}</script>`].join('\n'),
    ['普通 Markdown 说明。', '', `<button onclick="${example}">run</button>`].join('\n'),
    ['<p>普通 HTML 标签</p>', '', 'const run = () => client.like(note);', 'run();'].join('\n'),
  ]) assert.match(findWriteCapabilityInvocation(executable) ?? '', /写能力调用/, executable);
});

test('detects semicolonless aliases and variable write dispatch conservatively', () => {
  const op = (...parts) => parts.join('');
  for (const call of [
    `const fn = client.${op('li', 'ke')}\nawait fn(note)`,
    `const fn = client.${op('li', 'ke')}\nawait fn(note)\n`,
    `const { ${op('fol', 'low')}: doFollow } = client\nawait doFollow(user)`,
    `const operation = '${op('com', 'ment')}'\nclient.callTool(operation, payload)`,
    `const operation = '${op('fol', 'low')}'; mcp.invoke(operation, payload)`,
  ]) assert.match(findWriteCapabilityInvocation(call) ?? '', /写能力调用/, call);

  for (const inert of [
    `// const operation = '${op('com', 'ment')}'\n// client.callTool(operation, payload)`,
    `/* const fn = client.${op('li', 'ke')}\nawait fn(note) */`,
    `const sample = "const operation = '${op('com', 'ment')}'; client.callTool(operation, payload)"`,
  ]) assert.equal(findWriteCapabilityInvocation(inert), null, inert);
});

test('keeps HTML comments inert without hiding adjacent executable code', () => {
  const op = (...parts) => parts.join('');
  const call = `client.${op('li', 'ke')}(note)`;
  for (const comment of [
    `<!-- ${call} -->`,
    ['<!--', call, '-->'].join('\n'),
    `说明文字 <!-- ${call} --> 仍是纯注释`,
  ]) assert.equal(findWriteCapabilityInvocation(comment), null, comment);

  for (const executable of [
    `<!-- ${call} -->\n${call}`,
    `${call}\n<!-- ${call} -->`,
    `<!-- ${call} --> ${call}`,
  ]) assert.match(findWriteCapabilityInvocation(executable) ?? '', /写能力调用/, executable);
});

test('flags runtime-variable callTool and invoke dispatch when the operation cannot be resolved statically', () => {
  const dispatch = (receiver, method, argument) => `${receiver}.${method}(${argument}, payload)`;
  for (const call of [
    dispatch('client', ['call', 'Tool'].join(''), 'operation'),
    `await ${dispatch('client', 'invoke', 'operation')}`,
    dispatch('sdk', ['call', 'Tool'].join(''), 'toolName'),
    dispatch('mcp', 'invoke', 'getOperation()'),
  ]) assert.match(findWriteCapabilityInvocation(call) ?? '', /写能力调用/, call);

  for (const safeCall of [
    "client.callTool('get_note', noteId)",
    "client.invoke('search_notes', query)",
  ]) assert.equal(findWriteCapabilityInvocation(safeCall), null, safeCall);
});

test('keeps Markdown inline and fenced examples inert without hiding adjacent executable code', () => {
  const op = (...parts) => parts.join('');
  const dispatch = (method, argument = 'operation') => `client.${method}(${argument}, payload)`;
  const dynamicCall = dispatch(['call', 'Tool'].join(''));
  const dynamicInvoke = dispatch('invoke');
  for (const markdown of [
    `这是写调用示例：\`client.${op('li', 'ke')}(note)\`。`,
    `- 写调用示例：\`${dynamicCall}\``,
    `> 禁止调用 \`${dynamicInvoke}\`。`,
    `普通 Markdown 文档提到 \`client.${op('li', 'ke')}(note)\`，但没有执行它。`,
    ['```js', `client.${op('li', 'ke')}(note)`, '```'].join('\n'),
    ['- 示例：', '  ```js', `  ${dynamicCall}`, '  ```'].join('\n'),
    ['> 示例：', '> ```js', `> ${dynamicInvoke}`, '> ```'].join('\n'),
  ]) assert.equal(findWriteCapabilityInvocation(markdown), null, markdown);

  for (const executable of [
    `这是文档示例：\`client.${op('li', 'ke')}(note)\`。\nclient.${op('li', 'ke')}(note)`,
    `- 说明：不要写入\n${dynamicCall}`,
    `> 文档仅介绍只读能力\n${dynamicInvoke}`,
    `const example = \`client.${op('li', 'ke')}(note)\`; ${dynamicCall}`,
  ]) assert.match(findWriteCapabilityInvocation(executable) ?? '', /写能力调用/, executable);
});

test('CLI audits the worktree including non-ignored untracked files', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-audit-'));
  await mkdir(path.join(repo, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(repo, '04-工具/security-audit.mjs'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  await writeFile(path.join(repo, '.gitignore'), 'ignored.txt\nnode_modules/\n');
  await writeFile(path.join(repo, 'safe.txt'), ['API_', 'KEY=your_api_key\n'].join(''));
  assert.equal(runGit('add', '.').status, 0);
  await writeFile(path.join(repo, 'ignored.txt'), ['API_', 'KEY=ignored-secret-value\n'].join(''));
  await mkdir(path.join(repo, 'node_modules'));
  await writeFile(path.join(repo, 'node_modules/pkg.txt'), ['API_', 'KEY=ignored-module-secret\n'].join(''));

  const audit = runAudit(repo);
  assert.equal(audit.status, 0, audit.stderr);

  await writeFile(path.join(repo, 'untracked.txt'), ['API_', 'KEY=real-worktree-secret-value\n'].join(''));
  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /worktree:untracked\.txt: 疑似凭据/);
});

test('CLI accepts historical audit fixtures but still rejects real calls in test source', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-history-fixture-'));
  await mkdir(path.join(repo, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(repo, '04-工具/security-audit.mjs'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  const historicalFixture = [
    "const writeCall = ['client.li', 'ke(note)'].join('')",
    "const template = `client.${['li', 'ke'].join('')}(note)`",
    'const codeLine = codeLines[index].trim()',
    "assert.match(findWriteCapabilityInvocation(writeCall) ?? '', /write/)",
  ].join('\n');
  await writeFile(path.join(repo, '04-工具/security-audit.test.mjs'), historicalFixture);
  assert.equal(runGit('add', '.').status, 0);
  assert.equal(runGit('commit', '-m', 'historical fixtures').status, 0);
  await writeFile(path.join(repo, '04-工具/security-audit.test.mjs'), 'const safe = true\n');
  assert.equal(runGit('add', '04-工具/security-audit.test.mjs').status, 0);
  assert.equal(runGit('commit', '-m', 'safe head').status, 0);
  let audit = runAudit(repo);
  assert.equal(audit.status, 0, audit.stdout + audit.stderr);

  await writeFile(path.join(repo, '04-工具/security-audit.test.mjs'), ['API_', 'KEY=real-test-secret-value\n'].join(''));
  audit = runAudit(repo);
  assert.equal(audit.status, 1, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /worktree:04-工具\/security-audit\.test\.mjs: 疑似凭据/);

  await writeFile(path.join(repo, '04-工具/security-audit.test.mjs'), ['-----BEGIN ', 'PRIVATE KEY-----\n'].join(''));
  audit = runAudit(repo);
  assert.equal(audit.status, 1, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /worktree:04-工具\/security-audit\.test\.mjs: 私钥内容/);

  await writeFile(path.join(repo, '04-工具/security-audit.test.mjs'), 'client.like(note)\n');
  audit = runAudit(repo);
  assert.equal(audit.status, 1, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /worktree:04-工具\/security-audit\.test\.mjs: 写能力调用/);
});

test('CLI accepts mixed Markdown HTML examples but rejects real HTML write code', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-mixed-markdown-html-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  const op = (...parts) => parts.join('');
  const example = `client.${op('com', 'ment')}(note)`;
  await writeFile(path.join(repo, 'safe.md'), [
    '# Safe mixed document',
    '',
    '<p>普通 HTML 标签</p>',
    '',
    `行内示例：\`${example}\`。`,
    '',
    '```js',
    example,
    '```',
    '',
  ].join('\n'));
  let audit = runAudit(repo);
  assert.equal(audit.status, 0, audit.stdout + audit.stderr);

  await writeFile(path.join(repo, 'script.md'), `<p>普通 HTML 标签</p>\n<script>${example}</script>\n`);
  audit = runAudit(repo);
  assert.equal(audit.status, 1, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /worktree:script\.md: 写能力调用/);

  await rm(path.join(repo, 'script.md'));
  await writeFile(path.join(repo, 'handler.md'), `<button onclick="${example}">run</button>\n`);
  audit = runAudit(repo);
  assert.equal(audit.status, 1, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /worktree:handler\.md: 写能力调用/);
});

test('CLI rejects final-review executable syntax in real Markdown and HTML files', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-final-syntax-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  const op = (...parts) => parts.join('');
  const write = op('publish_', 'content');
  const cases = new Map([
    ['bind.md', `const p=api.${write}.bind(api); p()`],
    ['conditional.md', `const p=ready ? api.${write} : fallback; p()`],
    ['logical.md', `const p=api.${write} || fallback; p()`],
    ['default-object.md', `const {${write}: p=fallback}=api; p()`],
    ['array.md', `const [p]=[api.${write}]; p()`],
    ['call.md', `api.${write}.call(api, payload)`],
    ['apply.md', `api.${write}.apply(api, [payload])`],
    ['object-slot.md', `const slot={p:api.${write}}; slot.p()`],
    ['later-assignment.md', `let p; p=api.${write}; p()`],
    ['event.html', `<button onclick=api.${write}()>run</button>`],
    ['regex.md', `const matcher=/https?:\\/\\//;\napi.${write}(payload)`],
    ['control-flow.md', `if (ready) { prepare(); }\napi.${write}(payload)`],
    ['prose-boundary.md', `普通 Markdown 说明第一行。\n说明继续到第二行。\nconst p=api.${write};\np()`],
    ['html-boundary.html', `<p>普通 HTML 说明\n继续说明。</p>\n<script>\nconst p=api.${write};\np()\n</script>`],
  ]);
  for (const [file, content] of cases) await writeFile(path.join(repo, file), content);
  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  for (const file of cases.keys()) assert.match(rejected.stderr, new RegExp(`worktree:${file.replace('.', '\\.')}: 写能力调用`), file);
});

test('CLI audits aliased object slots in worktree, index, and reachable history', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-slot-aliases-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  const op = (...parts) => parts.join('');
  const write = op('publish_', 'content');
  const cases = new Map([
    ['worktree.html', `<button onclick="const slot={p:api.${write}}; const alias=slot; alias?.p?.()">run</button>`],
    ['index.md', `const slot={p:api.${write}}; const {p}=slot; p()`],
    ['history.md', `const slot={}; slot.p=api.${write}; const alias=slot; alias.p()`],
  ]);
  await writeFile(path.join(repo, 'worktree.html'), cases.get('worktree.html'));
  await writeFile(path.join(repo, 'index.md'), cases.get('index.md'));
  assert.equal(runGit('add', 'index.md').status, 0);
  await rm(path.join(repo, 'index.md'));
  await writeFile(path.join(repo, 'history.md'), cases.get('history.md'));
  assert.equal(runGit('add', 'history.md').status, 0);
  assert.equal(runGit('commit', '-m', 'unsafe history').status, 0);
  await writeFile(path.join(repo, 'history.md'), 'safe\n');
  assert.equal(runGit('add', 'history.md').status, 0);
  assert.equal(runGit('commit', '-m', 'safe head').status, 0);

  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /worktree:worktree\.html: 写能力调用/);
  assert.match(rejected.stderr, /index:index\.md: 写能力调用/);
  assert.match(rejected.stderr, /history:.*history\.md: 写能力调用/);
});

test('CLI audits recursive object slots in worktree, index, and reachable history', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-recursive-slots-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  const op = (...parts) => parts.join('');
  const write = op('publish_', 'content');
  await writeFile(path.join(repo, 'worktree.html'), `<button onclick="const box={p:api.${write}}; const copy={...box}; copy.p()">run</button>`);
  await writeFile(path.join(repo, 'index.md'), `const box={inner:{p:api.${write}}}; box.inner.p()`);
  assert.equal(runGit('add', 'index.md').status, 0);
  await rm(path.join(repo, 'index.md'));
  await writeFile(path.join(repo, 'history.md'), `const box={inner:{p:api.${write}}}; const {inner:{p}}=box; p()`);
  assert.equal(runGit('add', 'history.md').status, 0);
  assert.equal(runGit('commit', '-m', 'unsafe history').status, 0);
  await writeFile(path.join(repo, 'history.md'), 'safe\n');
  assert.equal(runGit('add', 'history.md').status, 0);
  assert.equal(runGit('commit', '-m', 'safe head').status, 0);

  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /worktree:worktree\.html: 写能力调用/);
  assert.match(rejected.stderr, /index:index\.md: 写能力调用/);
  assert.match(rejected.stderr, /history:.*history\.md: 写能力调用/);
});

test('CLI rejects final-review extensionless key paths and private-key armor', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-final-keys-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  await mkdir(path.join(repo, '.ssh'));
  for (const name of ['id_rsa', 'id_ed25519', 'id_dsa']) await writeFile(path.join(repo, '.ssh', name), 'fixture\n');
  const armor = (...parts) => parts.join('');
  await writeFile(path.join(repo, 'dsa.txt'), armor('-----BEGIN DSA ', 'PRIVATE KEY-----'));
  await writeFile(path.join(repo, 'pgp.txt'), armor('-----BEGIN PGP ', 'PRIVATE KEY BLOCK-----'));
  await writeFile(path.join(repo, 'ssh2.txt'), armor('-----BEGIN SSH2 ENCRYPTED ', 'PRIVATE KEY-----'));
  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  for (const name of ['id_rsa', 'id_ed25519', 'id_dsa']) assert.match(rejected.stderr, new RegExp(`worktree:\\.ssh/${name}: 禁入项`), name);
  for (const name of ['dsa', 'pgp', 'ssh2']) assert.match(rejected.stderr, new RegExp(`worktree:${name}\\.txt: 私钥内容`), name);
});

test('CLI audits staged index content independently of the worktree', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-index-'));
  await mkdir(path.join(repo, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(repo, '04-工具/security-audit.mjs'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), ['API_', 'KEY=real-staged-secret-value\n'].join(''));
  assert.equal(runGit('add', '.').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), ['API_', 'KEY=your_api_key\n'].join(''));
  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /index:safe\.txt: 疑似凭据/);
});

test('CLI audits blobs retained only in reachable Git history', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-history-'));
  await mkdir(path.join(repo, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(repo, '04-工具/security-audit.mjs'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  await writeFile(path.join(repo, 'history.txt'), ['API_', 'KEY=real-history-secret-value\n'].join(''));
  assert.equal(runGit('add', '.').status, 0);
  assert.equal(runGit('commit', '-m', 'unsafe history').status, 0);
  await writeFile(path.join(repo, 'history.txt'), ['API_', 'KEY=your_api_key\n'].join(''));
  assert.equal(runGit('add', 'history.txt').status, 0);
  assert.equal(runGit('commit', '-m', 'safe head').status, 0);
  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /history:.*history\.txt: 疑似凭据/);
});

test('CLI audits a reachable blob even when no historical path names it', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-tagged-blob-'));
  await mkdir(path.join(repo, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(repo, '04-工具/security-audit.mjs'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), 'safe\n');
  assert.equal(runGit('add', '.').status, 0);
  assert.equal(runGit('commit', '-m', 'safe head').status, 0);
  const secret = ['API_', 'KEY=tagged-object-secret-value\n'].join('');
  const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, encoding: 'utf8', input: secret });
  assert.equal(blob.status, 0);
  assert.equal(runGit('tag', 'retained-blob', blob.stdout.trim()).status, 0);
  const rejected = runAudit(repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /history:.*疑似凭据/);
});

test('CLI rejects forbidden paths retained in the index and reachable history', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-forbidden-path-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  await writeFile(path.join(repo, 'staged.zip'), 'not really an archive\n');
  assert.equal(runGit('add', 'staged.zip').status, 0);
  await rm(path.join(repo, 'staged.zip'));
  const indexRejected = runAudit(repo);
  assert.equal(indexRejected.status, 1, indexRejected.stdout + indexRejected.stderr);
  assert.match(indexRejected.stderr, /index:staged\.zip: 禁入项/);

  assert.equal(runGit('commit', '-m', 'retained forbidden path').status, 0);
  assert.equal(runGit('rm', 'staged.zip').status, 0);
  assert.equal(runGit('commit', '-m', 'remove forbidden path').status, 0);
  const historyRejected = runAudit(repo);
  assert.equal(historyRejected.status, 1, historyRejected.stdout + historyRejected.stderr);
  assert.match(historyRejected.stderr, /history:.*staged\.zip: 禁入项/);
});

test('CLI history scan stays within a basic linear performance boundary', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-performance-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  for (let index = 0; index < 40; index += 1) {
    await writeFile(path.join(repo, 'safe.txt'), `safe revision ${index}\n`);
    assert.equal(runGit('add', 'safe.txt').status, 0);
    assert.equal(runGit('commit', '-m', `safe ${index}`).status, 0);
  }
  const audit = runAudit(repo, 10_000);
  assert.equal(audit.status, 0, audit.stdout + audit.stderr);
  assert.equal(audit.error, undefined, audit.error?.message);
});

test('CLI enforces the 16 MiB limit in worktree, index, and reachable history', async () => {
  const oversized = Buffer.alloc(16 * 1024 * 1024 + 1, 0x61);
  const makeRepo = async name => {
    const repo = await mkdtemp(path.join(os.tmpdir(), `xhs-security-limit-${name}-`));
    const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(runGit('init').status, 0);
    assert.equal(runGit('config', 'user.name', 'test').status, 0);
    assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
    return { repo, runGit };
  };

  const worktree = await makeRepo('worktree');
  await writeFile(path.join(worktree.repo, 'large.txt'), oversized);
  let rejected = runAudit(worktree.repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /worktree:large\.txt:.*超大/);

  const index = await makeRepo('index');
  await writeFile(path.join(index.repo, 'large.txt'), oversized);
  assert.equal(index.runGit('add', 'large.txt').status, 0);
  await rm(path.join(index.repo, 'large.txt'));
  rejected = runAudit(index.repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /index:large\.txt:.*超大/);

  const history = await makeRepo('history');
  await writeFile(path.join(history.repo, 'large.txt'), oversized);
  assert.equal(history.runGit('add', 'large.txt').status, 0);
  assert.equal(history.runGit('commit', '-m', 'large history').status, 0);
  assert.equal(history.runGit('rm', 'large.txt').status, 0);
  assert.equal(history.runGit('commit', '-m', 'remove large history').status, 0);
  rejected = runAudit(history.repo);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /history:.*large\.txt:.*超大/);
});

test('CLI rejects an oversized pathless tag blob under a constrained heap', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-large-tag-'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  assert.equal(runGit('config', 'user.name', 'test').status, 0);
  assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), 'safe\n');
  assert.equal(runGit('add', 'safe.txt').status, 0);
  assert.equal(runGit('commit', '-m', 'safe head').status, 0);
  const objectFile = path.join(repo, 'large-object');
  await writeFile(objectFile, Buffer.alloc(48 * 1024 * 1024, 0x61));
  const blob = runGit('hash-object', '-w', objectFile);
  assert.equal(blob.status, 0, blob.stderr);
  assert.equal(runGit('tag', 'large-retained-blob', blob.stdout.trim()).status, 0);
  await rm(objectFile);
  const audit = spawnSync(process.execPath, [auditScript], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, SECURITY_AUDIT_ROOT: repo, NODE_OPTIONS: '--max-old-space-size=64' },
    timeout: 20_000,
  });
  assert.equal(audit.status, 1, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /history:.*超大/);
});

test('CLI fails safely when the Git index cannot be read', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-no-index-'));
  await mkdir(path.join(directory, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(directory, '04-工具/security-audit.mjs'));
  const audit = runAudit(directory);
  assert.equal(audit.status, 2, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /Git index/);
});

test('CLI fails safely when worktree, index, or history content is unreadable', async () => {
  const makeRepo = async name => {
    const repo = await mkdtemp(path.join(os.tmpdir(), `xhs-security-unreadable-${name}-`));
    const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(runGit('init').status, 0);
    assert.equal(runGit('config', 'user.name', 'test').status, 0);
    assert.equal(runGit('config', 'user.email', 'test@example.invalid').status, 0);
    return { repo, runGit };
  };
  const removeLooseObject = async (repo, oid) => rm(path.join(repo, '.git', 'objects', oid.slice(0, 2), oid.slice(2)));

  const worktree = await makeRepo('worktree');
  await writeFile(path.join(worktree.repo, 'tracked.txt'), 'safe\n');
  assert.equal(worktree.runGit('add', 'tracked.txt').status, 0);
  await rm(path.join(worktree.repo, 'tracked.txt'));
  await mkdir(path.join(worktree.repo, 'tracked.txt'));
  let failed = runAudit(worktree.repo);
  assert.equal(failed.status, 2, failed.stdout + failed.stderr);
  assert.match(failed.stderr, /无法读取工作树/);

  const index = await makeRepo('index');
  await writeFile(path.join(index.repo, 'staged.txt'), 'staged only\n');
  assert.equal(index.runGit('add', 'staged.txt').status, 0);
  const indexOid = index.runGit('rev-parse', ':staged.txt').stdout.trim();
  await removeLooseObject(index.repo, indexOid);
  failed = runAudit(index.repo);
  assert.equal(failed.status, 2, failed.stdout + failed.stderr);
  assert.match(failed.stderr, /Git index|index 对象/);

  const history = await makeRepo('history');
  await writeFile(path.join(history.repo, 'history.txt'), 'old history\n');
  assert.equal(history.runGit('add', 'history.txt').status, 0);
  assert.equal(history.runGit('commit', '-m', 'old').status, 0);
  const historyOid = history.runGit('rev-parse', 'HEAD:history.txt').stdout.trim();
  await writeFile(path.join(history.repo, 'history.txt'), 'current safe\n');
  assert.equal(history.runGit('add', 'history.txt').status, 0);
  assert.equal(history.runGit('commit', '-m', 'current').status, 0);
  await removeLooseObject(history.repo, historyOid);
  failed = runAudit(history.repo);
  assert.equal(failed.status, 2, failed.stdout + failed.stderr);
  assert.match(failed.stderr, /可达|历史|对象/);
});

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  findForbiddenPath,
  findSecret,
  findWriteCapabilityInvocation,
  shouldAuditTextFile,
} from './security-audit.mjs';

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
  ]) assert.match(findForbiddenPath(file) ?? '', /密钥|证书/i, file);

  assert.equal(findForbiddenPath('LICENSE'), null);
  assert.equal(findForbiddenPath('fixtures/README.md'), null);
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

test('CLI audits staged index content rather than a differing worktree', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-audit-'));
  await mkdir(path.join(repo, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(repo, '04-工具/security-audit.mjs'));
  const runGit = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.equal(runGit('init').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), ['API_', 'KEY=your_api_key\n'].join(''));
  assert.equal(runGit('add', '.').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), 'nothing sensitive in the worktree\n');

  const audit = spawnSync(process.execPath, ['04-工具/security-audit.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(audit.status, 0, audit.stderr);

  await writeFile(path.join(repo, 'safe.txt'), ['API_', 'KEY=real-staged-secret-value\n'].join(''));
  assert.equal(runGit('add', 'safe.txt').status, 0);
  await writeFile(path.join(repo, 'safe.txt'), ['API_', 'KEY=your_api_key\n'].join(''));
  const rejected = spawnSync(process.execPath, ['04-工具/security-audit.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /safe\.txt: 疑似凭据/);
});

test('CLI fails safely when the Git index cannot be read', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xhs-security-no-index-'));
  await mkdir(path.join(directory, '04-工具'));
  await copyFile(new URL('./security-audit.mjs', import.meta.url), path.join(directory, '04-工具/security-audit.mjs'));
  const audit = spawnSync(process.execPath, ['04-工具/security-audit.mjs'], { cwd: directory, encoding: 'utf8' });
  assert.equal(audit.status, 2, audit.stdout + audit.stderr);
  assert.match(audit.stderr, /Git index/);
});

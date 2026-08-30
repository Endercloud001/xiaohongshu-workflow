import assert from 'node:assert/strict';
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
  assert.equal(findForbiddenPath('LICENSE.key'), null);
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

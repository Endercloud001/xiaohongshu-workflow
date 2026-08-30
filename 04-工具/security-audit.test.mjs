import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findForbiddenPath,
  findSecret,
  findWriteCapabilityInvocation,
} from './security-audit.mjs';

test('rejects local authentication and runtime paths', () => {
  assert.match(findForbiddenPath('browser-profile/Default/Cookies') ?? '', /Cookie|profile/i);
  assert.match(findForbiddenPath('01-账号/账号档案.md') ?? '', /真实账号档案/);
  assert.equal(findForbiddenPath('01-账号/账号档案.example.md'), null);
});

test('detects credential-like content without flagging placeholders', () => {
  const fakeCredential = ['API_KEY=', 'sk-live_', '12345678901234567890'].join('');
  assert.match(findSecret(fakeCredential) ?? '', /疑似凭据/);
  assert.equal(findSecret('API_KEY=your_api_key_here'), null);
  assert.equal(findSecret('note_url=https://example.invalid/demo'), null);
});

test('detects executable publish and interaction calls but permits prohibition docs', () => {
  const publishCall = ['await client.', 'publish_content', '(payload)'].join('');
  const interactionCall = ['redbook ', 'post', ' --title demo'].join('');
  assert.match(findWriteCapabilityInvocation(publishCall) ?? '', /写能力调用/);
  assert.match(findWriteCapabilityInvocation(interactionCall) ?? '', /写能力调用/);
  assert.equal(findWriteCapabilityInvocation('不调用 `publish_content`。'), null);
});

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const render = path.join(root, '04-工具', 'render.mjs');
const verify = path.join(root, '04-工具', 'verify.mjs');
const selftest = path.join(root, '06-产出', '00000000-selftest');
const fixture = path.join(root, '06-产出', '00000000-verify-fixture');

function run(label, command, args) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`FAIL ${label}: ${path.relative(root, command)} ${args.join(' ')} exited ${result.status ?? 2}`);
    process.exit(result.status ?? 2);
  }
}

run('render selftest', render, [selftest]);
run('verify fixture', verify, [fixture]);

console.log('PASS public smoke test');

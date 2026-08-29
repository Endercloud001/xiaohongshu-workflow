import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, '06-产出', '00000000-verify-fixture');
const verify = path.join(root, '04-工具', 'verify.mjs');
const result = spawnSync(process.execPath, [verify, fixture], { cwd: root, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 2);

console.log('PASS 最小 fixture smoke 通过（无网络、无凭据、无外部研究工具）');

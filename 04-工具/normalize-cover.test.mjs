// 04-工具/normalize-cover.test.mjs — normalize-cover.mjs 自测
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(here, '..', '06-产出', '00000000-selftest', 'normalize-tmp');
const assets = path.join(tmp, 'assets');
const images = path.join(tmp, 'images');
const fails = [];
const script = path.join(here, 'normalize-cover.mjs');
const transientSessionClose = /Protocol error \(Emulation\.setTouchEmulationEnabled\): Session closed(?:\.|$)/i;

function runNormalize(args = [tmp]) {
  let result;
  // 最多三次总尝试；仅重试已观测到的触控模拟会话关闭。
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    if (!transientSessionClose.test(result.stderr)) return result;
  }
  return result;
}

// setup: 写入一张 2x3（2:3，非3:4）的固定 PNG fixture。
// fixture 不再另启 Puppeteer，避免测试准备阶段与被测 CLI 争用浏览器进程。
await rm(tmp, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await writeFile(
  path.join(assets, 'cover-src.png'),
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGP4XyX1v0qKAYUCAGigCXNtlvOvAAAAAElFTkSuQmCC', 'base64'),
);

// case 1: 正常路径 → images/cover.png 应恰为 2160x2880 (3:4)
{
  const r = runNormalize();
  if (r.status !== 0) fails.push(`正常路径退出码应为0，实际${r.status}: ${r.stderr}`);
  try {
    const buf = await readFile(path.join(images, 'cover.png'));
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== 2160 || h !== 2880) fails.push(`输出尺寸应为2160x2880，实际${w}x${h}`);
    // 容许 puppeteer 截图/DSF 缩放的浮点误差
    if (Math.abs(w / h - 3 / 4) > 0.02 * (3 / 4)) fails.push(`输出比例非3:4: ${w}x${h}`);
  } catch { fails.push('未生成 images/cover.png'); }
}

// case 2: 缺源图 → 退出码 2
{
  await rm(path.join(assets, 'cover-src.png'), { force: true });
  const r = runNormalize();
  if (r.status !== 2) fails.push(`缺源图退出码应为2，实际${r.status}`);
}

// 坏图解码契约由 normalize-image.test.mjs 覆盖；此处不重复启动浏览器。
// case 3: 缺参数属于用法错误 → 退出码 2（与 normalize-image CLI 契约一致）
{
  const r = runNormalize([]);
  if (r.status !== 2) fails.push(`缺参数退出码应为2，实际${r.status}`);
}

await rm(tmp, { recursive: true, force: true });
if (fails.length) { fails.forEach(f => console.error('FAIL ' + f)); process.exit(1); }
console.log('PASS normalize-cover 自测通过'); process.exit(0);

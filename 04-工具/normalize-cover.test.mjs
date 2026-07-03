// 04-工具/normalize-cover.test.mjs — normalize-cover.mjs 自测（造 fixture 用 puppeteer）
import puppeteer from 'puppeteer';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(here, '..', '06-产出', '00000000-selftest', 'normalize-tmp');
const assets = path.join(tmp, 'assets');
const images = path.join(tmp, 'images');
const fails = [];

// setup: 造一张 800x1200 (2:3，非3:4) 的 fixture → assets/cover-src.png
await rm(tmp, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
{
  const b = await puppeteer.launch();
  const p = await b.newPage();
  await p.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1 });
  await p.setContent('<div style="width:800px;height:1200px;background:#FF7A1A"></div>');
  await p.screenshot({ path: path.join(assets, 'cover-src.png') });
  await b.close();
}

// case 1: 正常路径 → images/cover.png 应恰为 2160x2880 (3:4)
{
  const r = spawnSync('node', [path.join(here, 'normalize-cover.mjs'), tmp], { encoding: 'utf8' });
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
  const r = spawnSync('node', [path.join(here, 'normalize-cover.mjs'), tmp], { encoding: 'utf8' });
  if (r.status !== 2) fails.push(`缺源图退出码应为2，实际${r.status}`);
}

// case 3: 坏源图（非 PNG 内容）→ 解码失败 → 退出码 1
{
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(assets, 'cover-src.png'), 'not a real png');
  const r = spawnSync('node', [path.join(here, 'normalize-cover.mjs'), tmp], { encoding: 'utf8' });
  if (r.status !== 1) fails.push(`坏源图退出码应为1，实际${r.status}`);
}

await rm(tmp, { recursive: true, force: true });
if (fails.length) { fails.forEach(f => console.error('FAIL ' + f)); process.exit(1); }
console.log('PASS normalize-cover 自测通过'); process.exit(0);

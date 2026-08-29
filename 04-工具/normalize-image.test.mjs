// 04-工具/normalize-image.test.mjs — normalize-image.mjs 自测（内页路径，造 fixture 用 puppeteer）
import puppeteer from 'puppeteer';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'normalize-image.mjs');
const tmp = path.join(here, '..', '06-产出', '00000000-selftest', 'normalize-image-tmp');
const assets = path.join(tmp, 'assets');
const images = path.join(tmp, 'images');
const SRC = 'assets/page-01-src.png';
const OUT = 'images/page-01.png';
const fails = [];

// setup: 造一张 1600x900 (16:9，横构图，非3:4) 的 fixture → assets/page-01-src.png
await rm(tmp, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
{
  const b = await puppeteer.launch();
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await p.setContent('<div style="width:1600px;height:900px;background:#101014"></div>');
  await p.screenshot({ path: path.join(assets, 'page-01-src.png') });
  await b.close();
}

// case 1: 正常路径 → images/page-01.png 应恰为 2160x2880 (3:4)
{
  const r = spawnSync('node', [script, tmp, SRC, OUT], { encoding: 'utf8' });
  if (r.status !== 0) fails.push(`正常路径退出码应为0，实际${r.status}: ${r.stderr}`);
  try {
    const buf = await readFile(path.join(images, 'page-01.png'));
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== 2160 || h !== 2880) fails.push(`输出尺寸应为2160x2880，实际${w}x${h}`);
    if (Math.abs(w / h - 3 / 4) > 0.02 * (3 / 4)) fails.push(`输出比例非3:4: ${w}x${h}`);
  } catch { fails.push('未生成 images/page-01.png'); }
}

// case 2: 缺源图 → 退出码 2
{
  await rm(path.join(assets, 'page-01-src.png'), { force: true });
  const r = spawnSync('node', [script, tmp, SRC, OUT], { encoding: 'utf8' });
  if (r.status !== 2) fails.push(`缺源图退出码应为2，实际${r.status}`);
}

// case 3: 坏源图（非 PNG 内容）→ 解码失败 → 退出码 1
{
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(assets, 'page-01-src.png'), 'not a real png');
  const r = spawnSync('node', [script, tmp, SRC, OUT], { encoding: 'utf8' });
  if (r.status !== 1) fails.push(`坏源图退出码应为1，实际${r.status}`);
}

// case 4: 缺参数 → 退出码 2
{
  const r = spawnSync('node', [script, tmp], { encoding: 'utf8' });
  if (r.status !== 2) fails.push(`缺参数退出码应为2，实际${r.status}`);
}

await rm(tmp, { recursive: true, force: true });
if (fails.length) { fails.forEach(f => console.error('FAIL ' + f)); process.exit(1); }
console.log('PASS normalize-image 自测通过'); process.exit(0);

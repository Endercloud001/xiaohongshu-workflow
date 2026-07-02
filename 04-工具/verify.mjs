// 04-工具/verify.mjs — 发布前硬校验（规格 §9）。零依赖。
// 用法: node 04-工具/verify.mjs <运行目录> [词表md路径，默认 02-规范/风控清单.md]
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) { console.error('用法: node verify.mjs <运行目录> [词表md路径]'); process.exit(2); }
const errors = [];

// --- 1. 解析 copy.md 的 json 块 ---
let copy;
try {
  const copyRaw = await readFile(path.join(runDir, 'copy.md'), 'utf8');
  const m = copyRaw.match(/```json\s*([\s\S]*?)```/);
  if (!m) { console.error('copy.md 缺少 ```json 机器可读块'); process.exit(2); }
  copy = JSON.parse(m[1]);
} catch (e) {
  console.error(`读取 copy.md 失败(${e.code ?? e.name}): ${path.join(runDir, 'copy.md')}`);
  process.exit(2);
}

// --- 2. 标题/正文/标签 ---
if (!Array.isArray(copy.titles) || copy.titles.length !== 3) errors.push('标题候选须恰好 3 个');
for (const t of copy.titles ?? []) if ([...t].length > 20) errors.push(`标题超 20 字: "${t}" (${[...t].length}字)`);
if ([...(copy.body ?? '')].length > 1000) errors.push(`正文超 1000 字 (${[...(copy.body ?? '')].length}字)`);
const nTags = (copy.tags ?? []).length;
if (nTags < 3 || nTags > 6) errors.push(`标签须 3-6 个，当前 ${nTags}`);
if (!copy.comment_guide) errors.push('缺评论区首条引导语');

// --- 3. 图片：数量、纯英文路径、3:4 比例（读 PNG IHDR） ---
let pngs = [];
try {
  const imgDir = path.join(runDir, 'images');
  pngs = (await readdir(imgDir)).filter(f => f.endsWith('.png'));
  if (pngs.length < 2 || pngs.length > 9) errors.push(`图片须 2-9 张，当前 ${pngs.length}`);
  for (const f of pngs) {
    if (!/^[a-z0-9._-]+$/i.test(f)) errors.push(`图片文件名含非英文字符: ${f}`);
    const buf = await readFile(path.join(imgDir, f));
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); // PNG IHDR
    if (Math.abs(w / h - 3 / 4) > 0.02 * (3 / 4)) errors.push(`图片比例非 3:4 (±2%): ${f} (${w}x${h})`);
  }
  if (!pngs.includes('cover.png')) errors.push('缺 cover.png');
} catch (e) {
  console.error(`读取 images/ 失败(${e.code ?? e.name}): ${path.join(runDir, 'images')}`);
  process.exit(2);
}

// --- 4. 风控词扫描（标题+正文+标签+引导语） ---
const wordSrc = process.argv[3] ?? path.join(import.meta.dirname, '..', '02-规范', '风控清单.md');
try {
  const wordRaw = await readFile(wordSrc, 'utf8');
  const wm = wordRaw.match(/```json\s*([\s\S]*?)```/);
  const banned = wm ? JSON.parse(wm[1]).banned : [];
  const fullText = [...(copy.titles ?? []), copy.body ?? '', ...(copy.tags ?? []), copy.comment_guide ?? ''].join('\n');
  for (const w of banned) if (fullText.includes(w)) errors.push(`命中风控词: "${w}"`);
} catch (e) {
  console.error(`读取词表失败(${e.code ?? e.name}): ${wordSrc}`);
  process.exit(2);
}

// --- 结果 ---
if (errors.length) { errors.forEach(e => console.error('FAIL ' + e)); process.exit(1); }
console.log(`PASS 硬校验全部通过（${pngs.length} 张图，标题 3 候选）`);

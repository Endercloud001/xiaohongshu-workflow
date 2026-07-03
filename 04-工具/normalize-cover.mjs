// 04-工具/normalize-cover.mjs — AI 封面原图规范化为精确 1080×1440 (3:4)
// 用法: node 04-工具/normalize-cover.mjs <运行目录>
//   读 <运行目录>/assets/cover-src.png，用 object-fit:cover 居中裁切，
//   输出 <运行目录>/images/cover.png（2160×2880 = 1080×1440 @2x，恒 3:4）。
import puppeteer from 'puppeteer';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const W = 1080, H = 1440, DSF = 2;
const runDir = process.argv[2];
if (!runDir) { console.error('用法: node normalize-cover.mjs <运行目录>'); process.exit(2); }
const src = path.resolve(runDir, 'assets', 'cover-src.png');
const imgDir = path.resolve(runDir, 'images');

try { await access(src); }
catch { console.error(`缺少源图: ${src}`); process.exit(2); }
await mkdir(imgDir, { recursive: true });

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;}
img{width:${W}px;height:${H}px;object-fit:cover;object-position:center;display:block;}
</style></head><body><img src="${pathToFileURL(src).href}"></body></html>`;

let browser;
try { browser = await puppeteer.launch(); }
catch (err) { console.error(`启动浏览器失败: ${err.message}`); process.exit(2); }
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(imgDir, 'cover.png') });
  console.log(`ok: cover.png (${W * DSF}x${H * DSF})`);
} catch (err) {
  console.error(`规范化失败: ${err.message}`); process.exit(2);
} finally {
  await browser.close();
}
process.exit(0);

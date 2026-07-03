// 04-工具/normalize-cover.mjs — AI 封面原图规范化为精确 1080×1440 (3:4)
// 用法: node 04-工具/normalize-cover.mjs <运行目录>
//   读 <运行目录>/assets/cover-src.png，用 object-fit:cover 居中裁切，
//   输出 <运行目录>/images/cover.png（2160×2880 = 1080×1440 @2x，恒 3:4）。
import puppeteer from 'puppeteer';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const W = 1080, H = 1440, DSF = 2;
const runDir = process.argv[2];
if (!runDir) { console.error('用法: node normalize-cover.mjs <运行目录>'); process.exit(2); }
const src = path.resolve(runDir, 'assets', 'cover-src.png');
const imgDir = path.resolve(runDir, 'images');

// 以 data: URI 内联源图：headless Chrome 会拦截 setContent 文档里的 file:// 子资源
// （naturalWidth=0、decode 失败），故读进内存转 base64，避开跨源 file:// 限制。
let srcBuf;
try { srcBuf = await readFile(src); }
catch { console.error(`缺少源图: ${src}`); process.exit(2); }
await mkdir(imgDir, { recursive: true });

const dataUri = `data:image/png;base64,${srcBuf.toString('base64')}`;
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;}
img{width:${W}px;height:${H}px;object-fit:cover;object-position:center;display:block;}
</style></head><body><img src="${dataUri}"></body></html>`;

let code = 0;
let browser;
try { browser = await puppeteer.launch(); }
catch (err) { console.error(`启动浏览器失败: ${err.message}`); process.exit(2); }
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // networkidle0 不保证 <img> 已解码渲染；显式等待 decode，失败即视为源图不可用
  const decoded = await page.evaluate(async () => {
    const img = document.querySelector('img');
    if (!img) return false;
    try { await img.decode(); } catch { return false; }
    return img.complete && img.naturalWidth > 0;
  });
  if (!decoded) {
    console.error(`源图无法解码/渲染（可能损坏或非图片）: ${src}`);
    code = 1;
  } else {
    await page.screenshot({ path: path.join(imgDir, 'cover.png') });
    console.log(`ok: cover.png (${W * DSF}x${H * DSF})`);
  }
} catch (err) {
  console.error(`规范化失败: ${err.message}`);
  code = 2;
} finally {
  try { await browser.close(); } catch {}
}
process.exit(code);

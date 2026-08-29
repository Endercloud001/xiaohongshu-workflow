// 04-工具/normalize-image.mjs — 任意比例源图规范化为精确 1080×1440 (3:4)
// CLI 用法: node 04-工具/normalize-image.mjs <运行目录> <源相对路径> <出相对路径>
//   例: node 04-工具/normalize-image.mjs 06-产出/x-run assets/page-01-src.png images/page-01.png
//   用 object-fit:cover 居中裁切，输出 2160×2880 (=1080×1440 @2x，恒 3:4)。
// 模块用法: import { normalizeImage } from './normalize-image.mjs'
// 退出码/返回值契约: 0=成功 / 1=源图不可解码 / 2=用法或缺源图或浏览器错误
import puppeteer from 'puppeteer';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 1080, H = 1440, DSF = 2;

export async function normalizeImage(runDir, srcRel, outRel) {
  const src = path.resolve(runDir, srcRel);
  const out = path.resolve(runDir, outRel);

  // 以 data: URI 内联源图：headless Chrome 会拦截 setContent 文档里的 file:// 子资源
  // （naturalWidth=0、decode 失败），故读进内存转 base64，避开跨源 file:// 限制。
  let srcBuf;
  try { srcBuf = await readFile(src); }
  catch { console.error(`缺少源图: ${src}`); return 2; }
  await mkdir(path.dirname(out), { recursive: true });

  const dataUri = `data:image/png;base64,${srcBuf.toString('base64')}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;}
img{width:${W}px;height:${H}px;object-fit:cover;object-position:center;display:block;}
</style></head><body><img src="${dataUri}"></body></html>`;

  let browser;
  try { browser = await puppeteer.launch(); }
  catch (err) { console.error(`启动浏览器失败: ${err.message}`); return 2; }
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
      return 1;
    }
    await page.screenshot({ path: out });
    console.log(`ok: ${outRel} (${W * DSF}x${H * DSF})`);
    return 0;
  } catch (err) {
    console.error(`规范化失败: ${err.message}`);
    return 2;
  } finally {
    try { await browser.close(); } catch {}
  }
}

// CLI 入口守卫：仅当本文件被直接 `node` 执行时触发（被 import 时不触发）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [runDir, srcRel, outRel] = process.argv.slice(2);
  if (!runDir || !srcRel || !outRel) {
    console.error('用法: node normalize-image.mjs <运行目录> <源相对路径> <出相对路径>');
    process.exit(2);
  }
  process.exit(await normalizeImage(runDir, srcRel, outRel));
}

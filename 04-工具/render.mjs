// 04-工具/render.mjs — HTML→PNG 渲染（规格 §8.2）
// 用法: node 04-工具/render.mjs <运行目录>  （运行目录下须有 html/，输出到 images/）
import puppeteer from 'puppeteer';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const W = 1080, H = 1440, DSF = 2;

const runDir = process.argv[2];
if (!runDir) { console.error('用法: node render.mjs <运行目录>'); process.exit(2); }
const htmlDir = path.resolve(runDir, 'html');
const imgDir = path.resolve(runDir, 'images');
await mkdir(imgDir, { recursive: true });

let files;
try {
  // 文件名按字典序排序；调用方约定 page-NN 两位零填充
  files = (await readdir(htmlDir)).filter(f => f.endsWith('.html')).sort();
} catch {
  console.error(`html/ 目录不存在: ${htmlDir}`);
  process.exit(2);
}
if (!files.length) { console.error('html/ 目录为空'); process.exit(2); }

const browser = await puppeteer.launch();
let failed = 0;
let crashed = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF });

  for (const f of files) {
    try {
      await page.goto(pathToFileURL(path.join(htmlDir, f)).href, { waitUntil: 'networkidle0' });
      const over = await page.evaluate(() => {
        const e = document.documentElement;
        return { h: e.scrollHeight, w: e.scrollWidth };
      });
      if (over.h > H || over.w > W) {
        console.error(`FAIL 溢出: ${f} (scroll ${over.w}x${over.h} > ${W}x${H})`);
        failed++;
        continue;
      }
      const out = path.join(imgDir, f.replace(/\.html$/, '.png'));
      await page.screenshot({ path: out });
      console.log(`ok: ${path.basename(out)} (${W * DSF}x${H * DSF})`);
    } catch (err) {
      console.error(`FAIL 渲染异常: ${f} ${err.message}`);
      crashed++;
    }
  }
} finally {
  await browser.close();
}
process.exit(crashed ? 2 : failed ? 1 : 0);

// 04-工具/render.mjs — HTML→PNG 渲染（规格 §8.2）
// 用法: node 04-工具/render.mjs <运行目录>  （运行目录下须有 html/，输出到 images/）
import puppeteer from 'puppeteer';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runDir = process.argv[2];
if (!runDir) { console.error('用法: node render.mjs <运行目录>'); process.exit(2); }
const htmlDir = path.resolve(runDir, 'html');
const imgDir = path.resolve(runDir, 'images');
await mkdir(imgDir, { recursive: true });

const files = (await readdir(htmlDir)).filter(f => f.endsWith('.html')).sort();
if (!files.length) { console.error('html/ 目录为空'); process.exit(2); }

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1440, deviceScaleFactor: 2 });

let failed = 0;
for (const f of files) {
  await page.goto(pathToFileURL(path.join(htmlDir, f)).href, { waitUntil: 'networkidle0' });
  const over = await page.evaluate(() => {
    const e = document.documentElement;
    return { h: e.scrollHeight, w: e.scrollWidth };
  });
  if (over.h > 1440 || over.w > 1080) {
    console.error(`FAIL 溢出: ${f} (scroll ${over.w}x${over.h} > 1080x1440)`);
    failed++;
    continue;
  }
  const out = path.join(imgDir, f.replace(/\.html$/, '.png'));
  await page.screenshot({ path: out });
  console.log(`ok: ${path.basename(out)} (2160x2880)`);
}
await browser.close();
process.exit(failed ? 1 : 0);

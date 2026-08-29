// 04-工具/normalize-cover.mjs — 封面规范化（薄封装，委托 normalize-image.mjs）
// 用法: node 04-工具/normalize-cover.mjs <运行目录>
//   读 <运行目录>/assets/cover-src.png → 出 <运行目录>/images/cover.png（精确 3:4）。
// 退出码契约与 normalize-image 一致: 0=成功 / 1=源图不可解码 / 2=用法或缺源图或浏览器错误
import { normalizeImage } from './normalize-image.mjs';

const runDir = process.argv[2];
if (!runDir) { console.error('用法: node normalize-cover.mjs <运行目录>'); process.exit(2); }
process.exit(await normalizeImage(runDir, 'assets/cover-src.png', 'images/cover.png'));

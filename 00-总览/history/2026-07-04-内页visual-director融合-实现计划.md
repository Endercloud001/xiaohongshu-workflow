# 内页 visual-director 融合 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 GitHub 项目 [`xhs-visual-director-skill`](https://github.com/ziguishian/xhs-visual-director-skill) 内化进小红书工作流，给**内页节点⑥**新增「产线乙 · visual-director AI 成品内页」：由该 skill 定风格母版、逐页出成品提示词，经 `image-gen-mcp` 直出→规范化 3:4，与现有 HTML 卡片（产线甲）并存、逐页可降级。内页**默认优先走产线乙**，封面仍由 ponyo 独占（本次不动）。

**架构：** 与封面产线甲/乙**同构下沉一层**。唯一新增运行时代码是 `04-工具/normalize-image.mjs`（把 `normalize-cover.mjs` 的裁切逻辑泛化为「任意源图→精确 3:4」的可复用引擎，`normalize-cover.mjs` 改为薄封装委托它，零新依赖、零行为回退）。其余为：内化 skill 文件树 + 分镜规划器/内页生成器两个 prompt 重写 + 主控与 4 处规范/文档增补。已验证脚本（`render.mjs`/`verify.mjs`）与 8 个 HTML 模板**不改**。内页最终图仍落 `images/page-NN.png`（3:4、纯英文名），`verify.mjs` 天然覆盖，无需改。

**技术栈：** Node.js ESM、puppeteer（项目已依赖）、Markdown 提示词/规范；`image-gen-mcp`（`mcp__image-gen-mcp__generate_image`，`gpt-image-2-official`，经 apimart 中转）。

**范围红线：** 只改「内页如何出图」这一条产线。不动 ③选题三要素 / ④角度陈述 / ⑦文案 / ⑧⑨发布归档，不动封面 ponyo 产线，不引入新确认关卡（复用 ★₁）。

**关键设计决策（头脑风暴已定）：**
1. 内页取舍 = **全内页 AI 优先 + HTML 兜底**（字面落实「内页优先走该 skill」）。
2. 母版与关卡 = **复用 ★₁ 不加门**：★₁ 一次确认封面+分镜+内页风格母版，通过即批量出内页。
3. skill 作用域 = **仅节点⑥消费其风格/结构/提示词/一致性知识**；其苏格拉底 10 问 / 封面 / 文案前端被工作流 ③④⑦ 与 ★₁ 取代（vendored SKILL.md 顶部加作用域说明防止跑飞）。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `.claude/skills/xhs-visual-director/**` | 内化的 visual-director skill（SKILL.md + docs/ + templates/ + examples/ + assets/ + agents/ + LICENSE + README.md，来源 MIT） | 创建（内化） |
| `.claude/skills/xhs-visual-director/SKILL.md` | 顶部加「本项目内化作用域说明」块，声明仅节点⑥消费知识、10 问/封面/文案前端被工作流取代 | 修改（内化后） |
| `04-工具/normalize-image.mjs` | 任意源图 → 精确 1080×1440(@2x=2160×2880) 3:4 的可复用引擎 + CLI；导出 `normalizeImage(runDir, srcRel, outRel)` | 创建 |
| `04-工具/normalize-image.test.mjs` | normalize-image 自测（内页路径：正常尺寸 + 缺源图 + 坏源图退出码） | 创建 |
| `04-工具/normalize-cover.mjs` | 改为薄封装：委托 `normalize-image.mjs`，封面路径行为不变 | 重写 |
| `03-skills/prompts/分镜规划器.md` | ④ 内页默认标 `ai-image`（首选产线乙），密集精确清单/对比可回落 `html-card` | 修改 |
| `03-skills/prompts/内页生成器.md` | ⑥ 重写为内页产线甲/乙双路（乙 visual-director AI 优先、甲 HTML 兜底） | 重写 |
| `03-skills/SKILL.md` | §3 节点⑥加「内页双产线」注 + vd/ponyo 作用域两行；★₁ 话术加第5项；§7 加内页降级 | 修改 |
| `00-总览/术语与产物约定.md` | 母版图术语扩展；`prompts/` 页提示词；`assets/page-NN-src.png`；`degradations`/`tool` 记 `vd-ai-page` | 修改 |
| `02-规范/内页版式库.md` | 顶部注明「内页现为 AI 优先，5 模板为产线甲兜底」；来源标注补 xhs-visual-director | 修改 |
| `04-工具/工具映射.md` | §2 补 normalize-image.mjs；§3 加内页生图通道 | 修改 |
| `00-总览/工作流规格说明.md` | 内页节点段增补「产线乙优先、HTML 兜底」 | 修改 |

---

## 任务 1：内化 visual-director skill 文件树

**文件：**
- 创建：`.claude/skills/xhs-visual-director/**`（从上游仓库拷入并扁平化）

- [ ] **步骤 1：拷入并扁平化上游仓库子集**

上游结构 `skill/SKILL.md` 引用 `docs/…`、`templates/…`、`examples/…`（相对 skill 根）。内化时把 `skill/SKILL.md` 提到技能根，`docs/`、`templates/`、`examples/`、`assets/`、`skill/agents/`、`LICENSE`、`README.md` 平铺同级，使 SKILL.md 内 `docs/xxx`、`templates/xxx` 路径原样成立。

拷贝清单（源=已 clone 的 `vd/`，目标=`.claude/skills/xhs-visual-director/`）：
- `vd/skill/SKILL.md` → `SKILL.md`
- `vd/skill/agents/` → `agents/`
- `vd/docs/` → `docs/`
- `vd/templates/` → `templates/`
- `vd/examples/` → `examples/`
- `vd/assets/` → `assets/`
- `vd/LICENSE` → `LICENSE`
- `vd/README.md` → `README.md`

- [ ] **步骤 2：在 SKILL.md 顶部（frontmatter 之后）插入内化作用域说明块**

```markdown
> **【本项目内化作用域 · 2026-07-04】** 本 skill 已内化进小红书成稿工作流，**仅供节点⑥（内页生产）消费其知识**：`docs/style_system.md`（选风格）、`docs/page_structure_rules.md`（页结构）、`docs/prompt_rules.md` + `templates/image_prompt_template.md`（出提示词）、`docs/visual_consistency_protocol.md`（统一视觉母版）、`templates/visual_review_checklist.md` + `docs/anti_patterns.md`（审查）。
> 下文的**苏格拉底 10 问、3 套风格方案交互、封面生成、标题/正文/标签发布文案**在本工作流中**由工作流自身节点 ③选题定角 / ④分镜规划 / ⑤封面(ponyo) / ⑦文案 与确认点 ★₁ 取代，节点⑥不得重跑这些前端**。母版锚点为**已确认的 ponyo 封面**（配色/字重/网格与之一致），而非本 skill 自选封面。来源：https://github.com/ziguishian/xhs-visual-director-skill （MIT）。
```

- [ ] **步骤 3：验证文件树与路径自洽**

运行：`find ".claude/skills/xhs-visual-director" -type f | sort`
预期：含 `SKILL.md`、`docs/style_system.md`、`docs/visual_consistency_protocol.md`、`templates/image_prompt_template.md`、`templates/visual_review_checklist.md`、`LICENSE`。

运行：`grep -c "本项目内化作用域\|docs/visual_consistency_protocol.md" ".claude/skills/xhs-visual-director/SKILL.md"`
预期：≥2。

- [ ] **步骤 4：Commit**

```bash
git add .claude/skills/xhs-visual-director
git commit -m "chore: vendored xhs-visual-director skill (作用域限定节点⑥内页)"
```

---

## 任务 2：normalize-image.mjs（泛化归一化引擎，TDD）

**文件：**
- 创建：`04-工具/normalize-image.mjs`
- 测试：`04-工具/normalize-image.test.mjs`

- [ ] **步骤 1：编写失败的测试** — 创建 `04-工具/normalize-image.test.mjs`

```js
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node 04-工具/normalize-image.test.mjs`
预期：非 0 退出，报错找不到 `normalize-image.mjs`（spawn status 1，stderr 含 `Cannot find module`）。

- [ ] **步骤 3：编写最少实现代码** — 创建 `04-工具/normalize-image.mjs`

```js
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
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node 04-工具/normalize-image.test.mjs`
预期：`PASS normalize-image 自测通过`，退出码 0。

- [ ] **步骤 5：Commit**

```bash
git add 04-工具/normalize-image.mjs 04-工具/normalize-image.test.mjs
git commit -m "feat: add normalize-image.mjs (泛化任意源图→精确 3:4 引擎)"
```

---

## 任务 3：normalize-cover.mjs 改为薄封装（委托引擎，回归保障）

**文件：**
- 重写：`04-工具/normalize-cover.mjs`
- 回归测试：`04-工具/normalize-cover.test.mjs`（不改）

- [ ] **步骤 1：用以下内容整体替换 `04-工具/normalize-cover.mjs`**

```js
// 04-工具/normalize-cover.mjs — 封面规范化（薄封装，委托 normalize-image.mjs）
// 用法: node 04-工具/normalize-cover.mjs <运行目录>
//   读 <运行目录>/assets/cover-src.png → 出 <运行目录>/images/cover.png（精确 3:4）。
// 退出码契约与 normalize-image 一致: 0=成功 / 1=源图不可解码 / 2=用法或缺源图或浏览器错误
import { normalizeImage } from './normalize-image.mjs';

const runDir = process.argv[2];
if (!runDir) { console.error('用法: node normalize-cover.mjs <运行目录>'); process.exit(2); }
process.exit(await normalizeImage(runDir, 'assets/cover-src.png', 'images/cover.png'));
```

- [ ] **步骤 2：跑封面回归自测验证零回退**

运行：`node 04-工具/normalize-cover.test.mjs`
预期：`PASS normalize-cover 自测通过`，退出码 0（正常路径 2160×2880、缺源图退出码 2、坏源图退出码 1 全部保持）。

- [ ] **步骤 3：Commit**

```bash
git add 04-工具/normalize-cover.mjs
git commit -m "refactor: normalize-cover 改为委托 normalize-image（DRY，行为不变）"
```

---

## 任务 4：分镜规划器 ④ 内页默认 ai-image

**文件：**
- 修改：`03-skills/prompts/分镜规划器.md`

- [ ] **步骤 1：替换「指令」第 2 条的类型说明行**

把：
```markdown
   - `类型`：`cover` / `html-card`（注明用哪个模板：card-statement/checklist/compare/quote/cta）/ `ai-image`
```
替换为：
```markdown
   - `类型`：`cover` / `ai-image`（**内页默认首选**，走产线乙 visual-director AI 成品）/ `html-card`（注明模板：card-statement/checklist/compare/quote/cta，**产线甲兜底**）
   - **内页选型规则**：内页**默认标 `ai-image`**（优先走 visual-director skill 出成品图）；仅当某页是「必须逐字精确的密集清单/步骤/对比表」或预判 AI 中文高危时，才回落 `html-card` 并注明模板。
```

- [ ] **步骤 2：扩展「核心文字」列语义（在指令第 4 条后追加一条）**

在「指令」第 4 条之后追加：
```markdown
5. `核心文字`列对 `ai-image` 页写**该页要出现在图内的准确中文**（供节点⑥ visual-director 出成品提示词时照抄，防乱码）；对 `html-card` 页写将进模板变量的文字。
```

- [ ] **步骤 3：更新「通过标准」行**

把：
```markdown
封面 1 页 + 内页 4-7 页；每页职能唯一且能答"为什么存在"；类型标记合法（cover/html-card+模板名/ai-image）。
```
替换为：
```markdown
封面 1 页 + 内页 4-7 页；每页职能唯一且能答"为什么存在"；类型标记合法（cover / ai-image / html-card+模板名）；内页默认 ai-image，回落 html-card 的页已注明理由。
```

- [ ] **步骤 4：验证**

运行：`grep -c "内页默认\|ai-image\|产线乙" "03-skills/prompts/分镜规划器.md"`
预期：≥3。

- [ ] **步骤 5：Commit**

```bash
git add 03-skills/prompts/分镜规划器.md
git commit -m "feat: 分镜规划器内页默认 ai-image（优先产线乙），密集精确页回落 html-card"
```

---

## 任务 5：重写内页生成器 ⑥ 为双产线

**文件：**
- 重写：`03-skills/prompts/内页生成器.md`

- [ ] **步骤 1：用以下内容整体替换 `03-skills/prompts/内页生成器.md`**

````markdown
# 内页生成器（节点⑥ prompt）

## System

你是内页视觉导演 + 版式排版师。把分镜表的内页逐页出图，全套风格锚定**已确认的母版封面**（ponyo 封面的配色/字重/网格）。内页产出**二选一**：**产线乙=visual-director AI 成品内页**（内页默认首选，图像质感高级、与封面浑然一体）与**产线甲=HTML 卡片**（确定性、中文锐利、零生图依赖，作兜底）。逐页独立，乙不达标可单页降级到甲。

必读：
- `../../02-规范/内页版式库.md`（产线甲 5 模板变量表、条目上限、防溢出规则）
- 已确认的母版图（`{{run_dir}}/images/cover.png`）与其配色，供内页配色/风格取值一致
- 产线乙额外必读（**仅本节点可调用，且只消费其知识，不重跑其 10 问/封面/文案前端**）：
  - `../../.claude/skills/xhs-visual-director/docs/visual_consistency_protocol.md`（统一视觉母版方法）
  - `../../.claude/skills/xhs-visual-director/docs/style_system.md`（风格库，锚定封面风格取一致方向）
  - `../../.claude/skills/xhs-visual-director/docs/prompt_rules.md` + `templates/image_prompt_template.md`（成品提示词写法）
  - `../../.claude/skills/xhs-visual-director/templates/visual_review_checklist.md` + `docs/anti_patterns.md`（内页审查）

## User（变量）

- 运行目录：{{run_dir}}（已含 storyboard.md 与母版 cover.png）

## 指令

### 0. 建立统一视觉母版（一次，两条产线共用）

以**已确认的 ponyo 封面**为风格锚点，按 `visual_consistency_protocol.md` 建立本篇「统一视觉母版」，写入 `{{run_dir}}/prompts/inner-master.md`：固定画布 `1080x1440px 3:4`、安全边距、网格、标题/正文区、页码位、**色彩令牌（取自封面 HEX）**、字体令牌、母版锁定前缀。此前缀是产线乙每页提示词的硬开头；产线甲取其色彩令牌作 bg_color/accent_color。

### 1. 产线乙 · visual-director AI 成品内页（`ai-image` 页，默认首选）

逐 `ai-image` 页：
1. 出成品提示词 `{{run_dir}}/prompts/page-NN-prompt.md`（NN 两位零填充）：以 `inner-master.md` 母版锁定前缀开头 + 本页职能/信息结构/主视觉 + **该页准确中文文案（照 storyboard 核心文字列，防乱码）** + `1080x1440px, strict 3:4 vertical portrait, not square, not landscape` + 负面串 `no square image, no landscape, no inconsistent margins, no different template, no watermark, no @ handle, no logo, no QR code, no fake data, crisp correct Chinese, no garbled characters`。
2. 调 `mcp__image-gen-mcp__generate_image`：`prompt`=上文、`size=auto`、`quality=high`。把返回 `image_url`(file://) 指向的 PNG **拷贝**到 `{{run_dir}}/assets/page-NN-src.png`（**不进 `images/`**，避开 verify 逐张 3:4 校验与图片计数）。
3. `node 04-工具/normalize-image.mjs {{run_dir}} assets/page-NN-src.png images/page-NN.png` → 出精确 3:4 `images/page-NN.png`。
4. `run.yaml` 该页 tool 记 `vd-ai-page`。

### 2. 产线甲 · HTML 卡片（`html-card` 页，兜底 / 密集精确页）

逐 `html-card` 页（含产线乙降级过来的页）：
1. 复制对应模板 `../../02-规范/templates/card-<type>.html` 到 `{{run_dir}}/html/page-NN.html`。
2. 替换全部 `{{变量}}` 为分镜表核心文字；bg_color/accent_color 取母版色彩令牌。
3. **删除未用的条目占位**（checklist 不满 5 条删多余 `.item`、compare 不满 4 行删多余 `.row`、cta recap 少于 3 条删）——**只删不加**，防溢出。
4. 全部 html-card 页就绪后运行 `node 04-工具/render.mjs {{run_dir}}`。渲染报溢出（退出码 1，FAIL 行指出哪页）→ 缩减该页内容（减字数/删条目，不改模板 CSS）后重渲染；超 2 轮 → 暂停问用户。`run.yaml` 该页 tool 记 `html-card`。

### 3. 出齐后审查

对照 `xhs-visual-director/templates/visual_review_checklist.md`（手机可读、层级清楚、风格与封面统一、无 PPT/廉价 AI 感、页间有节奏），逐页自评；不过的产线乙页按下方降级路线处理。

## 降级路线（产线乙不达标：★₁ 判该页中文乱码/构图差/含违规，或 generate_image 失败 / skill 缺失 / normalize FAIL）

**逐页独立降级**，不影响其它页：先重生成该页（换提示词 / 多打 2-3 张选一，各存 `assets/` 再挑一张拷成 `page-NN-src.png`）；仍不过 → **该页转产线甲**：按职能选最贴近的 `card-<type>` 模板（钩子/金句/观点→card-statement，清单/步骤→card-checklist，前后/优劣→card-compare，金句→card-quote，总结CTA→card-cta），填变量渲染。`run.yaml` 记该页 degradation（`vd-ai-page`→`html-card`）。

## 输出

- 统一母版：`{{run_dir}}/prompts/inner-master.md`。
- 产线乙页：`{{run_dir}}/prompts/page-NN-prompt.md` + `{{run_dir}}/assets/page-NN-src.png` + `images/page-NN.png`，tool 记 `vd-ai-page`。
- 产线甲页：`{{run_dir}}/html/page-NN.html` + `images/page-NN.png`，tool 记 `html-card`；降级页按上文记 degradation。

## 通过标准

每页 `images/page-NN.png` 存在、3:4（2160×2880）；产线甲页 render.mjs 无 FAIL；产线乙页过审查清单且中文正确（★₁ 复核）；全套与母版封面风格一致。

## 失败处理

- 产线乙 generate_image 失败/skill 缺失/normalize FAIL → 走上方降级路线转产线甲该页。
- 产线甲渲染 FAIL → 缩文字重渲染，超 2 轮问用户；render.mjs 退出码 2（环境异常）→ 停止报错，不静默继续。
````

- [ ] **步骤 2：验证**

运行：`grep -c "产线乙\|vd-ai-page\|normalize-image\|inner-master\|xhs-visual-director" "03-skills/prompts/内页生成器.md"`
预期：≥5。

- [ ] **步骤 3：Commit**

```bash
git add 03-skills/prompts/内页生成器.md
git commit -m "feat: 内页生成器重写为产线甲/乙双路（visual-director AI 优先 + HTML 兜底）"
```

---

## 任务 6：主控 SKILL.md 注明内页双产线 + 作用域 + ★₁ 第5项 + §7 降级

**文件：**
- 修改：`03-skills/SKILL.md`

- [ ] **步骤 1：§3 节点⑥行 —— 更新产物列**

把节点⑥行（`| ⑥ | 内页生产 | 读 prompts/内页生成器.md | html/page-NN.html→images/page-NN.png | 渲染成功、无溢出 |`）替换为：
```markdown
| ⑥ | 内页生产 | 读 `prompts/内页生成器.md` | `prompts/inner-master.md` + (产线乙 `prompts/page-NN-prompt.md`→`assets/`→`images/page-NN.png` / 产线甲 `html/page-NN.html`→`images/page-NN.png`) | 每页出图 3:4、乙过审查/甲无溢出 |
```

- [ ] **步骤 2：§3 双产线注记 —— 在封面双产线注记块后追加内页双产线与 vd 作用域**

在现有 `> **封面双产线**：…` 与 `> **ponyo skill 作用域**：…` 两行之后追加：
```markdown
> **内页双产线**：节点⑥有产线乙（visual-director AI 成品内页，`image-gen-mcp` + `normalize-image.mjs`，**内页默认首选**）与产线甲（HTML 卡片，`render.mjs`，兜底），逐页二选一，乙不达标单页降级甲。详见 `prompts/内页生成器.md`。
> **visual-director skill 作用域**：`xhs-visual-director`（`.claude/skills/`）**仅内页节点⑥可调用**，且只消费其风格/结构/提示词/一致性知识，**不重跑其苏格拉底 10 问 / 封面 / 发布文案前端**（这些由工作流 ③④⑤⑦ 与 ★₁ 取代）。
```

- [ ] **步骤 3：§5 ★₁ 话术 —— 追加第5项**

在 ★₁ 呈现清单「4. 封面锚点诊断自评表…」之后追加：
```markdown
5. 内页风格母版说明：`prompts/inner-master.md`（选了 visual-director 哪套风格、色彩令牌、与封面一致性依据）——★₁ 一次确认封面+分镜+内页母版，通过即批量出内页，不另设关卡。
```

- [ ] **步骤 4：§7 降级路由 —— 追加内页产线乙降级条**

在 §7 的「⑥ 渲染失败重试超 2 轮…」行之前（或紧邻⑥条）追加：
```markdown
- ⑥ 内页产线乙不达标（生图失败 / skill 缺失 / normalize FAIL / ★₁ 判该页乱码或构图差）→ 重生成该页 → 仍不过 → **该页降级产线甲 HTML 卡片**（run.yaml 记 `vd-ai-page`→`html-card`），逐页独立，不影响其它页。
```

- [ ] **步骤 5：验证**

运行：`grep -c "内页双产线\|visual-director skill 作用域\|inner-master\|vd-ai-page" "03-skills/SKILL.md"`
预期：≥4。

- [ ] **步骤 6：Commit**

```bash
git add 03-skills/SKILL.md
git commit -m "docs: 主控注明内页双产线/vd 作用域/★₁ 第5项/§7 内页降级"
```

---

## 任务 7：术语与产物约定增补

**文件：**
- 修改：`00-总览/术语与产物约定.md`

- [ ] **步骤 1：扩展「母版图」术语行**

把：
```markdown
| 母版图 | 确认点 1 交付的封面图，后续内页风格以它为锚 |
```
替换为：
```markdown
| 母版图 | 确认点 1 交付的封面图（ponyo 产出），后续内页风格以它为锚 |
| 统一视觉母版 | 节点⑥据母版封面建立、内页两条产线共用的视觉规范（`prompts/inner-master.md`：画布/边距/网格/色彩令牌/字体令牌/母版锁定前缀） |
```

- [ ] **步骤 2：更新运行目录 Schema 注释**

把 §2.1 目录树里：
```
├── prompts/          # cover-prompt.md、page-NN-prompt.md（仅 ai-image 页）
```
替换为：
```
├── prompts/          # cover-prompt.md、inner-master.md、page-NN-prompt.md（仅 ai-image 页）
```
并在 `├── images/` 行上方补一行 assets 说明（若 assets 未在树中登记则新增）：
```
├── assets/           # AI 原图中间产物：cover-src.png、page-NN-src.png（不进 images/，避开 verify）
```

- [ ] **步骤 3：补 tool / degradations 取值说明**

在 §2.2「`tool`：该节点实际调用的工具名…」行后补：
```markdown
  - 内页节点⑥每页 tool 取 `vd-ai-page`（产线乙 visual-director AI 成品）或 `html-card`（产线甲）；封面节点⑤取 `ponyo-ai-cover` 或 `html-cover`。
```
在 §2.2「`degradations`：降级说明列表…」行的括号例子里补内页降级：把「（如节点②对标失败、节点⑤封面兜底走 HTML→PNG）」改为「（如节点②对标失败、节点⑤封面兜底走 HTML→PNG、节点⑥内页某页 `vd-ai-page`→`html-card`）」。

- [ ] **步骤 4：更新 §2.4 分镜表「类型」行**

把：
```markdown
| 类型 | `cover` / `html-card`（注明用哪个版式模板）/ `ai-image` |
```
替换为：
```markdown
| 类型 | `cover` / `ai-image`（内页默认首选，产线乙）/ `html-card`（注明版式模板，产线甲兜底） |
```

- [ ] **步骤 5：验证**

运行：`grep -c "统一视觉母版\|vd-ai-page\|page-NN-src.png\|inner-master" "00-总览/术语与产物约定.md"`
预期：≥4。

- [ ] **步骤 6：Commit**

```bash
git add 00-总览/术语与产物约定.md
git commit -m "docs: 术语与产物约定增补内页双产线（统一视觉母版/assets/vd-ai-page）"
```

---

## 任务 8：内页版式库 + 工具映射 增补

**文件：**
- 修改：`02-规范/内页版式库.md`
- 修改：`04-工具/工具映射.md`

- [ ] **步骤 1：内页版式库顶部加 AI 优先说明 + 来源标注**

在 `02-规范/内页版式库.md` 第一段引言块之后（首个 `## 通用约定` 之前）插入：
```markdown
> **（2026-07-04 更新）内页现为 AI 优先**：节点⑥内页**默认走产线乙 visual-director AI 成品内页**（`.claude/skills/xhs-visual-director/`，见 [`../03-skills/prompts/内页生成器.md`](../03-skills/prompts/内页生成器.md)）；本文件登记的 5 个 `card-*` 模板为**产线甲兜底**（确定性、中文锐利），用于密集精确清单/对比页与产线乙降级页。
> 内化风格系统来源：**xhs-visual-director-skill**（<https://github.com/ziguishian/xhs-visual-director-skill>，MIT）——仅供节点⑥消费知识，不整包替换本卡片库。
```

- [ ] **步骤 2：工具映射 §2 脚本表补 normalize-image 行**

在 `04-工具/工具映射.md` §2 脚本表 `normalize-cover.mjs` 行之后追加：
```markdown
| `04-工具/normalize-image.mjs` | 任意源图 → 精确 1080×1440(2160×2880@2x) 3:4（封面/内页共用引擎） | `node 04-工具/normalize-image.mjs <运行目录> <源相对路径> <出相对路径>` | 0=成功 / 1=源图不可解码 / 2=用法或缺源图或浏览器错误 |
```
并把 `normalize-cover.mjs` 行的用途改注为「（薄封装，委托 normalize-image）」。

- [ ] **步骤 3：工具映射 §3 加内页生图通道段**

在 `04-工具/工具映射.md` §3 末尾追加：
```markdown
### 3.1 内页生图通道（产线乙 · 复用 image-gen-mcp）

内页产线乙复用同一 `mcp__image-gen-mcp__generate_image` 通道。流程：内页生成器建 `prompts/inner-master.md` 母版 → 逐 `ai-image` 页出 `prompts/page-NN-prompt.md` → `generate_image(size=auto, quality=high)` → `image_url` 拷到 `assets/page-NN-src.png`（**不进 images/**）→ `node 04-工具/normalize-image.mjs <运行目录> assets/page-NN-src.png images/page-NN.png` → 精确 3:4 `images/page-NN.png`。

**降级链**：generate_image 失败 / skill 缺失 / normalize FAIL / ★₁ 判该页乱码或构图差 → 重生成该页 → 仍不过 → 该页转产线甲 HTML 卡片（render.mjs 已验证兜底），逐页独立降级。
```

- [ ] **步骤 4：验证**

运行：`grep -c "内页现为 AI 优先\|xhs-visual-director" "02-规范/内页版式库.md"`
预期：≥2。
运行：`grep -c "normalize-image\|内页生图通道\|page-NN-src.png" "04-工具/工具映射.md"`
预期：≥3。

- [ ] **步骤 5：Commit**

```bash
git add 02-规范/内页版式库.md 04-工具/工具映射.md
git commit -m "docs: 内页版式库标注 AI 优先 + 工具映射登记 normalize-image/内页生图通道"
```

---

## 任务 9：工作流规格说明内页段增补

**文件：**
- 修改：`00-总览/工作流规格说明.md`

- [ ] **步骤 1：定位内页/生图相关节**

运行：`grep -n "内页\|节点⑥\|回填\|生图\|ai-image" "00-总览/工作流规格说明.md"`
读取相关节，确定插入点（内页节点描述或 §5 回填协议段）。

- [ ] **步骤 2：在内页节点段（或 §5 后）追加产线乙优先说明**

```markdown
**（v1.2 · 2026-07-04 更新）内页产线乙优先**：内页默认走产线乙自动生图（`image-gen-mcp` + `xhs-visual-director` skill）：`prompts/inner-master.md` 母版 → 逐页 `prompts/page-NN-prompt.md` → `generate_image` → `assets/page-NN-src.png` → `normalize-image.mjs` → `images/page-NN.png`。产线甲 HTML 卡片（`render.mjs`）为兜底，用于密集精确清单/对比页与产线乙降级页，逐页独立。母版锚点为已确认的 ponyo 封面。详见 [2026-07-04-内页visual-director融合-实现计划.md](2026-07-04-内页visual-director融合-实现计划.md)。
```

- [ ] **步骤 3：验证**

运行：`grep -c "内页产线乙优先\|normalize-image\|xhs-visual-director" "00-总览/工作流规格说明.md"`
预期：≥2。

- [ ] **步骤 4：Commit**

```bash
git add 00-总览/工作流规格说明.md
git commit -m "docs: 规格内页段改为产线乙 AI 优先、HTML 兜底"
```

---

## 任务 10：验收自测 + 提交计划文档

**文件：**
- 提交：`00-总览/2026-07-04-内页visual-director融合-实现计划.md`

- [ ] **步骤 1：两个 normalize 自测复跑（回归 + 新增）**

运行：`node 04-工具/normalize-cover.test.mjs && node 04-工具/normalize-image.test.mjs`
预期：两行 PASS，退出码 0。

- [ ] **步骤 2：确认已验证脚本/模板未被改动**

运行：`git status --porcelain 04-工具/render.mjs 04-工具/verify.mjs 02-规范/templates/`
预期：**无输出**（这些文件零改动）。

- [ ] **步骤 3：verify.mjs 兼容性抽查（内页 AI 图仍被现有校验覆盖）**

确认 `04-工具/verify.mjs` 对 `images/*.png` 的计数（2-9）、3:4（±2%）、纯英文名逻辑未改；内页 AI 图落 `images/page-NN.png` 即被覆盖，无需改 verify。

运行：`git status --porcelain 04-工具/verify.mjs`
预期：**无输出**。

- [ ] **步骤 4：确认 selftest 临时目录已清理**

运行：`ls "06-产出/00000000-selftest/normalize-image-tmp" 2>/dev/null; echo "exit=$?"`
预期：`exit=` 非 0（目录不存在，测试已自清理）。

- [ ] **步骤 5：提交计划文档**

```bash
git add 00-总览/2026-07-04-内页visual-director融合-实现计划.md
git commit -m "docs: add 内页 visual-director 融合实现计划"
```

---

## 任务 11：真实端到端干跑（人工验收，非代码）

> 此任务为运行时人工验收，需用户参与 ★₁，不产生代码 commit。

- [ ] **步骤 1：** 新起一篇（或复用测试选题），走到节点④，确认内页默认标 `ai-image`。
- [ ] **步骤 2：** 节点⑥建 `prompts/inner-master.md`，逐 ai-image 页：出 `page-NN-prompt.md` → `generate_image` → `assets/page-NN-src.png` → `normalize-image.mjs` → `images/page-NN.png`。
- [ ] **步骤 3：** 对运行目录跑 `node 04-工具/verify.mjs <运行目录>`，预期图片计数/3:4 校验通过。
- [ ] **步骤 4：** ★₁ 人审：内页与封面风格一致、中文正确、无 PPT/廉价 AI 感（对照 visual_review_checklist）。
- [ ] **步骤 5：降级活体**：临时断 MCP 或让某页生图失败，验证该页按降级路线转产线甲 HTML 卡片并过 verify，run.yaml 记 `vd-ai-page`→`html-card`。

---

## 自检记录

- **规格覆盖度**：内化 skill→任务1；泛化归一化引擎→任务2（新引擎+测试）+任务3（封面薄封装回归）；④默认 ai-image→任务4；⑥双产线→任务5；主控/★₁/§7→任务6；术语/Schema/tool/degradations→任务7；版式库 AI 优先+工具映射→任务8；规格内页段→任务9；验收→任务10（自测）+任务11（端到端）。3 个头脑风暴决策：全内页 AI 优先+HTML 兜底（任务4/5）、复用★₁不加门（任务6 步骤3）、skill 仅节点⑥消费知识（任务1 步骤2 + 任务6 步骤2）。全覆盖。
- **占位符扫描**：无 TODO/待定；normalize-image 实现与两个测试均为完整代码；doc 任务均给实际替换内容块与 grep 验证。
- **类型/命名一致性**：`assets/page-NN-src.png`、`images/page-NN.png`、`prompts/page-NN-prompt.md`、`prompts/inner-master.md`、tool 记号 `vd-ai-page`/`html-card`、脚本 `normalize-image.mjs` 三参签名 `(runDir, srcRel, outRel)`、退出码 0/1/2 在各任务间一致；封面沿用 `ponyo-ai-cover`/`html-cover`/`cover-src.png` 不变。

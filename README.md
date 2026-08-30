# xiaohongshu-workflow

只读研究、可插拔配图、双闸门复核、人工发布的小红书轻编辑部工作流。

## 先看这里

这个仓库不是“小红书自动运营机器人”，而是一套在本地协助完成**研究、选题、图文制作、校验和人工发布包整理**的工作流。它把容易混在一起的创作步骤拆成 12 个可恢复节点，并在选题和成图后设置两道质量闸门。

- 想先跑通环境：直接看[最小运行](#最小运行)
- 想理解每一步：看[核心工作流](#核心工作流)和[`00-总览/使用说明.md`](00-总览/使用说明.md)
- 想实现或修改节点：以[`00-总览/工作流规格说明.md`](00-总览/工作流规格说明.md)为权威规格
- 想核对字段与产物：看[`00-总览/术语与产物约定.md`](00-总览/术语与产物约定.md)
- 想确认工具、许可和分发边界：看[`04-工具/工具映射.md`](04-工具/工具映射.md)与[`THIRD_PARTY_LICENSES/README.md`](THIRD_PARTY_LICENSES/README.md)

文档职责按此分工维护：本 README 定义项目定位、公开产出范围、安装与命令契约；`使用说明.md` 只提供操作入口；`工作流规格说明.md` 定义流程与状态语义；`术语与产物约定.md` 提供便于查阅的术语和产物示例。出现冲突时，项目与命令边界以本 README 为准，流程与字段语义以 `工作流规格说明.md` 为准。

## 核心工作流

```text
① 档案加载 → ② 只读研究 → ③ Topic Gate → ④ 选题定角 → ⑤ 分镜规划
→ ⑥ Style Router → ⑦ 封面生产 → ★1 视觉母版确认 → ⑧ 内页生产
→ ⑨ Visual Gate → ⑩ 文案定稿 → ⑪ 组包终审 → ★2 发布包确认
→ ⑫ Publish Pack（手动发布后补录）
```

| 阶段 | 作用 | 关键结果 |
|---|---|---|
| ① 档案加载 | 读取本地账号定位与风格边界 | `run.yaml` 初始化 |
| ② 只读研究 | 用可用的只读后端收集证据 | `research.md`、`research-evidence.json` |
| ③ Topic Gate | 判断题目是否值得继续 | `go / revise / reject` |
| ④–⑤ 定角与分镜 | 固定切入角度，规划封面与 4–7 张内页 | `storyboard.md` |
| ⑥ Style Router | 为封面和内页选择可用视觉产线 | `prompts/style-decision.md` |
| ⑦ + ★1 封面与确认 | 先确认视觉母版，再批量生产内页 | `images/cover.png`、人工确认记录 |
| ⑧–⑨ 内页与 Visual Gate | 逐页生成、校验并按页降级 | `images/page-NN.png`、`visual-review.json` |
| ⑩–⑪ 文案与终审 | 完成文案并运行硬校验 | `copy.md`、校验结果 |
| ★2 + ⑫ 发布包 | 人工确认标题与图片顺序，生成手动发布材料 | `manual-publish.md` |

Topic Gate 只回答“这个题是否有证据、有区分度且适合做成图文”；Visual Gate 只回答“成图是否尺寸合法、手机可读、风格一致、中文正确且没有明显廉价 AI 感”。两者都不是发布按钮。完整输入、输出、阈值和失败路由见[`工作流规格说明`](00-总览/工作流规格说明.md)。

## 项目定位

- 研究只读：OpenCLI 首选；redbook 仅在已安装且入口检查通过时作为可选研究增强；OpenCLI 不可用时由 xiaohongshu-mcp 兜底
- 视觉可插拔：封面 / 内页按风格注册表动态路由
- 双闸门：研究后做 Topic Gate，成图后做 Visual Gate
- 人工发布：仓库不包含自动发布、自动评论、自动点赞收藏能力

## 目录结构

- `00-总览/`：规格、术语与使用入口
- `01-账号/`：账号模板与本地私有档案
- `02-规范/`：平台与视觉判据、HTML 模板
- `03-skills/`：主控、路由规则、节点 prompt
- `04-工具/`：确定性脚本与工具边界
- `05-验收/`：检查清单与模板索引
- `06-产出/`：运行产物；公开树只保留 `00000000-selftest` 与 `00000000-verify-fixture`

公开仓库与本地运行数据严格分开：`账号档案.md`、`已发档案.jsonl`、Cookie、认证状态、可执行文件、`node_modules/` 和真实 run 均由 `.gitignore` 排除。公开示例只能使用明确标注的虚构模板或确定性测试夹具，不能复制真实账号档案、Cookie 内容或真实产出充当示例。

## 环境要求

- Node.js >= 20 且 < 25（推荐使用当前 `.nvmrc` 的 Node 20 LTS）
- npm 10（`package.json` 已固定推荐版本；更高版本也可执行 lockfile v3）
- Windows 本地环境已实测；确定性 Node 命令不依赖 Windows 专属可执行文件

## 最小运行

```bash
npm ci
npm test
npm run check:config
npm run smoke
npm run audit:security
```

这些命令只验证仓库的确定性基础能力和公开树安全边界，不会访问小红书、不需要登录，也不会创建或发布真实笔记。预期行为是全部命令均以退出码 0 结束；若其中一条失败，先按下方“常见失败”排查，不要用本地 `node_modules`、Cookie 或可执行文件绕过安装契约。安全报告与泄露处理见 [`SECURITY.md`](SECURITY.md)。

`npm ci` 严格按 `package-lock.json` 安装并下载 Puppeteer 所需浏览器。若受代理或网络策略影响，先修复下载问题，不要改用仓库中的本地 `node_modules` 或提交浏览器可执行文件。

Puppeteer 当前精确锁定为 23.11.1，以复现已验证的 Windows/Chrome 131 组合；npm 会提示该版本已停止上游支持。升级须同时验证新版自带 Chrome 在目标 Windows 环境可启动，不能只改依赖范围。

基础检查命令不需要 Cookie、Token、MCP 服务或小红书登录态。`.env.example` 只列出可选研究后端的非敏感默认值；如需覆盖，请复制为被 Git 忽略的 `.env`，并在调用命令前由 shell 或运行器加载。

### 常见失败

- `npm ci` 下载 Chromium 失败：检查代理、证书和网络策略后重试；不要提交下载后的浏览器或整个 `node_modules/`。
- Node 版本不在 `>=20 <25`：切换到 `.nvmrc` 指定的 Node 20，再重新执行 `npm ci`。
- `npm run check:config` 失败：Node 版本不符合要求，缺少 `package-lock.json`、`.env.example` 或 `06-产出/00000000-verify-fixture/copy.md`，以及 `XHS_MCP_URL` 不是有效的 HTTP(S) URL，均会导致命令失败；其余可选能力仅做只读探测并输出信息，不检查私有账号档案或已发档案，也无需凭据。请按具体 `FAIL` 信息修复对应基础配置。
- `npm run smoke` 失败：保留完整输出，先重新执行 `npm test` 区分依赖/脚本问题与 fixture 问题。
- 可选研究后端不可用：不影响基础四条命令；真实工作流会记录 `degraded`，而不是越过只读边界或尝试自动发布。

本地首次运行前，准备私有文件：

- 根据 `01-账号/账号档案.example.md` 创建 `01-账号/账号档案.md`
- 根据 `05-验收/已发档案.example.jsonl` 创建 `05-验收/已发档案.jsonl`

`xhs-visual-director` 已随当前仓库快照提供在
`.claude/skills/xhs-visual-director/`，克隆本仓库后无需重复安装，也不要向这个非空目录再次执行
`git clone`。其 MIT 许可证原文已随目录保留。

其余视觉技能不随公开 Git 树分发。安装前请先确认以下许可与项目政策边界：

- `cover-anchor-system` 上游未声明许可证，具有无许可证的使用与再分发风险；仅在用户本地显式安装到被 `.gitignore` 排除的 `.claude/skills/cover-anchor-system/` 后才可能按 `style-registry.yaml` 参与路由，不随公开 Git 树分发；安装、使用及合规责任由用户承担。
- `guizang-social-card-skill` 上游许可证为 AGPL-3.0；仅在用户本地显式安装到被 `.gitignore` 排除的 `.claude/skills/guizang-social-card-skill/` 后才可能按 `style-registry.yaml` 参与路由，不随公开 Git 树分发；使用者须自行评估并履行 AGPL-3.0 义务。

接受上述边界后，仅在目标目录不存在时安装：

```powershell
if (-not (Test-Path -LiteralPath ".claude/skills/cover-anchor-system")) {
  git clone https://github.com/ponyodong2026/ponyo-cover-anchor-system ".claude/skills/cover-anchor-system"
}
if (-not (Test-Path -LiteralPath ".claude/skills/guizang-social-card-skill")) {
  git clone https://github.com/op7418/guizang-social-card-skill ".claude/skills/guizang-social-card-skill"
}
Push-Location ".claude/skills/guizang-social-card-skill"
npm install
Pop-Location
npx playwright install chromium
```

## 可选能力边界

以下能力都不是 `npm ci`、`npm test`、`npm run check:config` 或 `npm run smoke` 的前置条件：

- OpenCLI（`@jackwener/opencli`）：仓库外安装的只读研究首选；认证和会话数据不得进入本仓库。
- redbook（`@lucasygu/redbook`）：仓库外安装的可选只读增强；缺失不影响主路径。
- xiaohongshu-mcp：仓库外独立服务，仅在 OpenCLI 不可用时作为只读研究兜底；本仓库的 `.mcp.json` 只含本机默认 URL，不包含服务二进制、Cookie 或登录态。
- `xhs-visual-director`：已随公开快照提供，无需另行安装。
- `cover-anchor-system` 与 `guizang-social-card-skill`：仅可在接受上文许可边界后本地显式安装，目录被 Git 忽略，缺失时由仓库内 HTML 模板降级。

后端优先级不是“必须全部安装”：OpenCLI 是只读研究首选，redbook 只做可选增强，xiaohongshu-mcp 只在 OpenCLI 不可用时承担只读研究兜底。任一后端的认证信息都留在仓库外；没有研究后端时可以生成降级记录，但不能把未经对标的内容伪装成已研究结论。

研究增强示例（按需选择，不要作为基础安装步骤）：

```bash
npm install -g @jackwener/opencli
npm install -g @lucasygu/redbook
```

## 使用

- 新建 run：`/xhs <主题>`
- 继续 run：`继续 <run>`
- 运行测试：`npm test`
- 检查基础配置：`npm run check:config`
- 运行无网络最小 fixture：`npm run smoke`
- 运行硬校验：`npm run verify -- 06-产出/<run>`
- 渲染 HTML：`npm run render -- 06-产出/<run>`

## 断点续跑

- `waiting_backfill`：等待人工回填图片
- `waiting_confirm`：等待 ★1 / ★2 确认
- `package_ready`：发布包已就绪，等待用户手动发布后补录

节点失败时保留已经落盘的产物：`revise` 回到对应上游节点，视觉失败按单页 fallback 链降级，`in_progress` 节点在续跑时整节点重做。详细状态语义和恢复规则见[`术语与产物约定`](00-总览/术语与产物约定.md)。

## 人工发布边界

工作流的终点是 `manual-publish.md`。用户需要亲自检查标题、正文、标签、图片顺序和平台风险，再手动上传发布；发布后可把链接交回工作流补录 `receipt.md`。项目不会保存或调用发布能力，也不会自动评论、点赞、收藏或进行其他互动。评论区首条引导语只是发布包中的文案建议，是否使用以及何时发布均由用户人工决定。

## 第三方致谢与许可

| 项目 | 用途 | 许可 | 处理方式 |
|---|---|---|---|
| `xhs-visual-director-skill` | 内页视觉一致性知识 | MIT | 随当前快照提供（含上游 LICENSE），无需重复 clone |
| `ponyo-cover-anchor-system` | 封面专项 skill | 上游未声明 LICENSE | 无许可证风险；仅在本地显式安装到被 `.gitignore` 排除的 `.claude/skills/cover-anchor-system/` 后才可能按 registry 路由；不随公开 Git 树分发；安装、使用及合规责任由用户承担 |
| `guizang-social-card-skill` | 结构化图文与版式校验 | AGPL-3.0 | 仅在本地显式安装到被 `.gitignore` 排除的 `.claude/skills/guizang-social-card-skill/` 后才可能按 registry 路由；不随公开 Git 树分发；使用者须自行评估并履行 AGPL-3.0 义务 |
| `Puppeteer` | 本地 HTML 渲染与图片规范化 | Apache-2.0 | npm 安装；不跟踪 `node_modules` 或浏览器可执行文件 |
| `OpenCLI` (`@jackwener/opencli`) | 只读研究首选 | Apache-2.0 | 仓库外安装，不分发会话数据 |
| `redbook` (`@lucasygu/redbook`) | 可选只读研究增强 | MIT | 已安装且入口检查通过时可用，认证数据留在仓库外 |
| `xiaohongshu-mcp` | OpenCLI 不可用时的只读研究兜底 | Apache-2.0 | 独立本地服务，不随仓库分发 |

仓库根 `LICENSE` 只适用于本仓库自有文件，不适用于 `.claude/skills/` 下第三方 skill。
完整审计、传递依赖许可类型和字体 / 图片 / 模板边界见
[`THIRD_PARTY_LICENSES/README.md`](THIRD_PARTY_LICENSES/README.md)。

## 公开化基线说明

公开内容以当前 Git 根提交及其追踪文件为准。仓库外的离线 bundle 与审计清单仅用于恢复和过程核验，
可能对应公开化流程中的不同中间节点，不属于安装依赖，也不定义当前公开快照的内容。

## 免责声明

本项目不包含自动发布、自动评论、自动点赞、自动收藏、自动互动能力。请自行评估平台规则与账号风险，并对最终发布内容做人工复核。

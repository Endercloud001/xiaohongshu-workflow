# xiaohongshu-workflow

只读研究、可插拔配图、双闸门复核、人工发布的小红书轻编辑部工作流。

## 架构

```text
① 档案加载 → ② 只读研究 → ③ Topic Gate → ④ 选题定角 → ⑤ 分镜规划
→ ⑥ Style Router → ⑦ 封面生产 → ★1 视觉母版确认 → ⑧ 内页生产
→ ⑨ Visual Gate → ⑩ 文案定稿 → ⑪ 组包终审 → ★2 发布包确认
→ ⑫ Publish Pack（手动发布后补录）
```

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
- `06-产出/`：运行产物；仓库只保留 selftest、verify fixture 与一个展示样例

## 环境要求

- Node.js >= 20 且 < 25（推荐使用当前 `.nvmrc` 的 Node 20 LTS）
- npm 10（`package.json` 已固定推荐版本；更高版本也可执行 lockfile v3）
- Windows 本地环境已实测；确定性 Node 命令不依赖 Windows 专属可执行文件

## 安装

```bash
npm ci
npm test
npm run check:config
npm run smoke
```

`npm ci` 严格按 `package-lock.json` 安装并下载 Puppeteer 所需浏览器。若受代理或网络策略影响，先修复下载问题，不要改用仓库中的本地 `node_modules` 或提交浏览器可执行文件。

Puppeteer 当前精确锁定为 23.11.1，以复现已验证的 Windows/Chrome 131 组合；npm 会提示该版本已停止上游支持。升级须同时验证新版自带 Chrome 在目标 Windows 环境可启动，不能只改依赖范围。

基础四条命令不需要 Cookie、Token、MCP 服务或小红书登录态。`.env.example` 只列出可选研究后端的非敏感默认值；如需覆盖，请复制为被 Git 忽略的 `.env`，并在调用命令前由 shell 或运行器加载。

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

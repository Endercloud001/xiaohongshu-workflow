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

- 研究只读：OpenCLI 是首选主后端；redbook 仅在已安装且入口检查通过时作为可选证据增强；xiaohongshu-mcp 是 OpenCLI 不可用时的兜底主后端
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

- Node.js >= 20
- npm
- Windows 本地环境（当前脚本与周边工具按此环境实测）

## 安装

```bash
npm install
```

本地首次运行前，准备私有文件：

- 根据 `01-账号/账号档案.example.md` 创建 `01-账号/账号档案.md`
- 根据 `05-验收/已发档案.example.jsonl` 创建 `05-验收/已发档案.jsonl`

`xhs-visual-director` 已随当前仓库快照提供在
`.claude/skills/xhs-visual-director/`，克隆本仓库后无需重复安装，也不要向这个非空目录再次执行
`git clone`。其 MIT 许可证原文已随目录保留。

其余视觉技能不随仓库分发。安装前请先确认以下许可与项目政策边界：

- `cover-anchor-system` 上游未声明许可证；在许可证状态明确前，本项目不 vendoring、不纳入公开跟踪树，也不默认集成。
- `guizang-social-card-skill` 上游许可证可确认为 AGPL-3.0。本项目基于自身的公开分发政策，不将其 vendoring、不纳入公开跟踪树，也不默认集成；用户如自行安装，应自行遵守 AGPL-3.0。

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

研究增强可选安装：

```bash
npm install -g @lucasygu/redbook
```

## 使用

- 新建 run：`/xhs <主题>`
- 继续 run：`继续 <run>`
- 运行测试：`npm test`
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
| `ponyo-cover-anchor-system` | 封面专项 skill | 上游未声明 LICENSE | 不随仓库分发，只提供安装命令 |
| `guizang-social-card-skill` | 结构化图文与版式校验 | AGPL-3.0 | 本项目政策：不随仓库分发、不纳入公开跟踪树、不默认集成；仅提供用户自行安装命令 |
| `Puppeteer` | 本地 HTML 渲染与图片规范化 | Apache-2.0 | npm 安装；不跟踪 `node_modules` 或浏览器可执行文件 |
| `OpenCLI` (`@jackwener/opencli`) | 只读研究首选 | Apache-2.0 | 仓库外安装，不分发会话数据 |
| `redbook` (`@lucasygu/redbook`) | 只读研究增强 | MIT | 可选安装，认证数据留在仓库外 |
| `xiaohongshu-mcp` | 只读研究兜底 | Apache-2.0 | 独立本地服务，不随仓库分发 |

仓库根 `LICENSE` 只适用于本仓库自有文件，不适用于 `.claude/skills/` 下第三方 skill。
完整审计、传递依赖许可类型和字体 / 图片 / 模板边界见
[`THIRD_PARTY_LICENSES/README.md`](THIRD_PARTY_LICENSES/README.md)。

## 公开化基线说明

公开内容以当前 Git 根提交及其追踪文件为准。仓库外的离线 bundle 与审计清单仅用于恢复和过程核验，
可能对应公开化流程中的不同中间节点，不属于安装依赖，也不定义当前公开快照的内容。

## 免责声明

本项目不包含自动发布、自动评论、自动点赞、自动收藏、自动互动能力。请自行评估平台规则与账号风险，并对最终发布内容做人工复核。

# xiaohongshu-workflow

只读研究、可插拔配图、双闸门复核、人工发布的小红书轻编辑部工作流。

## 项目定位

这个仓库不是自动运营机器人，而是一套在本地协助完成研究、选题、图文制作、校验和人工发布包整理的工作流。它把容易混在一起的创作步骤拆成 12 个可恢复节点，并在选题和成图后设置两道质量闸门。

当前已在 Windows 本地 Codex 桌面环境实测；仓库脚本本身不绑定某个 Agent 宿主，Claude Code、Codex 或其他宿主只要能运行同样的 Node 命令就能使用，但宿主差异未在本仓库中额外承诺。

## 示例产出

- `06-产出/00000000-selftest/`：公开自检样例
- `06-产出/00000000-verify-fixture/`：`verify.mjs` 夹具
- 真实 run 目录：仅在本地并且被 Git 忽略，公开仓库不分发

## 工作流

```text
① 档案加载 → ② 只读研究 → ③ Topic Gate → ④ 选题定角 → ⑤ 分镜规划
→ ⑥ Style Router → ⑦ 封面生产 → ★1 视觉母版确认 → ⑧ 内页生产
→ ⑨ Visual Gate → ⑩ 文案定稿 → ⑪ 组包终审 → ★2 发布包确认
→ ⑫ Publish Pack（手动发布后补录）
```

Topic Gate 只回答“这个题是否有证据、区分度和继续价值”；Visual Gate 只回答“成图是否尺寸合法、手机可读、风格一致、中文正确且没有明显廉价 AI 感”。两者都不是发布按钮。完整节点语义见 [`00-总览/工作流规格说明.md`](00-总览/工作流规格说明.md)。

## 能力矩阵

| 能力 | 状态 | 登录态 | 依赖 | 替代路线 |
|---|---|---|---|---|
| 研究 | 支持 | OpenCLI 不需要；`xiaohongshu-mcp` 兜底需要 | OpenCLI / redbook / xiaohongshu-mcp | 只保留降级研究记录 |
| 选题 | 支持 | 不需要 | 研究产物 + 规格文档 | 人工改题后重跑 |
| 文案 | 支持 | 不需要 | 研究产物 + 文案规范 | 手工改写发布包 |
| 图片 | 支持 | 取决于所选视觉 skill | `cover-anchor-system`、`xhs-visual-director`、`guizang-social-card-skill`、HTML 模板 | 按 fallback 链降级 |
| 渲染 | 支持 | 不需要 | Puppeteer | 走 HTML 模板与 `render.mjs` |
| 验收 | 支持 | 不需要 | `verify.mjs`、`smoke.mjs` | 仅保留夹具验收 |
| 人工发布包 | 支持 | 不需要发布登录态 | `manual-publish.md` | 用户手动发布后补录 |
| 自动发布 | 不支持 | 需要平台登录态，但仓库不提供 | 无 | 始终手动发布 |
| 互动操作 | 不支持 | 需要平台登录态，但仓库不提供 | 无 | 不做评论、点赞、收藏或关注 |

## 环境要求

- Node.js >= 20 且 < 25
- npm 10
- Windows 本地环境已实测；`npm ci` 会通过 Puppeteer 下载浏览器

## 安装

安装说明和可选外部工具见 [`docs/installation.md`](docs/installation.md)。

最小安装命令：

```bash
npm ci
```

## 干跑示例

```bash
npm test
npm run check:config
npm run smoke
npm run verify -- 06-产出/00000000-verify-fixture
```

这些命令只验证仓库的确定性基础能力和公开树安全边界，不会访问小红书，也不会创建或发布真实笔记。

## 外部工具

外部工具和宿主边界见 [`docs/integrations.md`](docs/integrations.md) 与 [`04-工具/工具映射.md`](04-工具/工具映射.md)。

## 目录

- `00-总览/`：规格、术语与使用入口
- `01-账号/`：账号模板与本地私有档案
- `02-规范/`：平台与视觉判据、HTML 模板
- `03-skills/`：主控、路由规则、节点 prompt
- `04-工具/`：确定性脚本与工具边界说明
- `05-验收/`：检查清单与模板索引
- `06-产出/`：运行产物；公开树只保留 `00000000-selftest` 与 `00000000-verify-fixture`
- `docs/`：安装、集成和故障排查
- `.github/`：CI、Issue 模板和 PR 模板

公开仓库与本地运行数据严格分开：`账号档案.md`、`已发档案.jsonl`、Cookie、认证状态、可执行文件、`node_modules/` 和真实 run 均由 `.gitignore` 排除。

## 测试

- `npm test`
- `npm run check:config`
- `npm run smoke`
- `npm run verify -- 06-产出/00000000-verify-fixture`
- `npm run audit:security`

CI 也只跑这些确定性命令，不注入 cookies、平台登录态或 AI API key。提交前再补跑 `npm run audit:security`。

## 故障排查

常见排查路径见 [`docs/troubleshooting.md`](docs/troubleshooting.md)。

## 隐私

不要把真实账号档案、Cookie、Token、私有 Skill、真实发布归档或个人绝对路径提交进仓库。公开示例只用明确标注的虚构模板和确定性夹具。

## 许可证

根目录 `LICENSE` 只适用于本仓库自有文件，不覆盖第三方 Skill、素材和依赖。第三方边界见 [`THIRD_PARTY_LICENSES/README.md`](THIRD_PARTY_LICENSES/README.md) 与 [`04-工具/工具映射.md`](04-工具/工具映射.md)。

## 贡献

先读 [`CONTRIBUTING.md`](CONTRIBUTING.md) 和 [`00-总览/工作流规格说明.md`](00-总览/工作流规格说明.md)。

## 版本策略

采用语义化版本：不兼容的公开接口、产物格式或命令参数变化升 major；新增兼容能力升 minor；文档、测试和修复升 patch。变更记录见 [`CHANGELOG.md`](CHANGELOG.md)。

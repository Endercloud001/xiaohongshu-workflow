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

- 研究只读：OpenCLI 首选，redbook 增强，xiaohongshu-mcp 兜底
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

视觉技能安装方式：

```bash
git clone https://github.com/ponyodong2026/ponyo-cover-anchor-system ".claude/skills/cover-anchor-system"
git clone https://github.com/ziguishian/xhs-visual-director-skill ".claude/skills/xhs-visual-director"
git clone https://github.com/op7418/guizang-social-card-skill ".claude/skills/guizang-social-card-skill"
cd .claude/skills/guizang-social-card-skill && npm install
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
| `xhs-visual-director-skill` | 内页视觉一致性知识 | MIT | 可本地安装，仓库可说明引用 |
| `ponyo-cover-anchor-system` | 封面专项 skill | 上游未声明 LICENSE | 不随仓库分发，只提供安装命令 |
| `guizang-social-card-skill` | 结构化图文与版式校验 | AGPL-3.0 / 商业双许可 | 不随仓库分发，只提供安装命令 |
| `redbook` | 研究增强与发布后健康检查 | 以上游仓库为准 | 可选安装 |

仓库根 `LICENSE` 只适用于本仓库自有文件，不适用于 `.claude/skills/` 下第三方 skill。

## 免责声明

本项目不包含自动发布、自动评论、自动点赞、自动收藏、自动互动能力。请自行评估平台规则与账号风险，并对最终发布内容做人工复核。

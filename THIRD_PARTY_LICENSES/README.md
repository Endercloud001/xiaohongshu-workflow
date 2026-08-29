# 第三方依赖、许可证与资源审计

本文件记录公开跟踪树中的第三方内容，以及运行时需要在仓库外安装的工具。审计日期：2026-08-29。

> 本清单用于说明来源和分发边界，不替代各上游许可证原文。仓库根 `LICENSE` 仅覆盖本项目自有内容。

## 随仓库分发

| 项目 / 资源 | 位置与用途 | 许可证 | 审计结论 |
|---|---|---|---|
| [xhs-visual-director-skill](https://github.com/ziguishian/xhs-visual-director-skill) | `.claude/skills/xhs-visual-director/`；内页视觉规划知识、模板与示例图 | MIT | 保留。快照包含上游 `LICENSE`，代码、文档、模板和 `assets/covers/` 示例图按该许可证再分发。 |
| HTML 模板 | `02-规范/templates/` | 本项目根许可证 | 项目自有模板；未复制第三方字体或图片。设计思路的来源标注见对应规范。 |
| 测试图片与 HTML | `06-产出/00000000-selftest/`、`06-产出/00000000-verify-fixture/` | 本项目根许可证 | 由仓库模板和测试脚本生成的确定性夹具；不作为第三方素材库。 |

## 仅外置安装或运行时使用

以下项目不在 Git 跟踪树中分发。安装会在用户本机产生其自身文件，使用者仍应遵守对应上游许可证和服务条款。

| 项目 | 用途 | 已核验许可证 | 分发处理 |
|---|---|---|---|
| [Puppeteer](https://github.com/puppeteer/puppeteer) 23.11.1 | HTML 渲染和图片规范化 | Apache-2.0 | 由 npm 安装；`node_modules/` 和下载的浏览器可执行文件不跟踪。锁文件中的传递依赖为 MIT、Apache-2.0、BSD-2-Clause、BSD-3-Clause、ISC、0BSD、Python-2.0。 |
| [OpenCLI](https://github.com/jackwener/opencli) (`@jackwener/opencli`) | 小红书只读研究首选后端 | Apache-2.0 | 全局或外部安装；仓库不复制其源码、浏览器配置或会话数据。 |
| [redbook](https://github.com/lucasygu/redbook) (`@lucasygu/redbook`) | 可选只读研究增强 | MIT | 可选全局安装；认证与 Cookie 留在仓库外。 |
| [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) | 只读研究兜底 | Apache-2.0 | 作为独立本地服务安装；本仓库不分发服务端、可执行文件或登录数据。 |
| [ponyo-cover-anchor-system](https://github.com/ponyodong2026/ponyo-cover-anchor-system) | 可选封面方法 skill | **上游未声明许可证** | 不得 vendoring 或随本仓库再分发；仅提供用户自行安装说明，目录已被 `.gitignore` 排除。 |
| [guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill) | 可选结构化卡片与版式校验 | AGPL-3.0（未确认商业授权） | 不随仓库分发，不纳入公开跟踪树；仅由用户自行安装。使用前需向上游取得书面许可，并自行评估 AGPL 义务。 |

## 字体、图片、模板与生成资源

- 仓库没有跟踪 `.ttf`、`.otf`、`.woff` 或 `.woff2` 字体文件。HTML 模板只声明 `Microsoft YaHei`、`PingFang SC`、`Georgia` 和通用 `sans-serif` 回退字体；字体由运行环境提供，未随项目再分发。
- `.claude/skills/xhs-visual-director/assets/covers/` 的三张示例图属于 MIT 上游快照，并与上游 LICENSE 一同保留。
- 根项目模板、测试夹具图片与 HTML 不主张包含第三方素材。真实运行产生的图片、用户上传素材和模型生成内容默认位于被忽略的运行目录，权利与使用许可由使用者逐项确认。
- `cover-anchor-system` 上游仓库包含示例图片，但因其未声明许可证，本项目不复制这些图片。
- 不得把网页截图、平台笔记图片、用户头像、品牌素材或模型输出视为“因可访问即可再分发”；公开前应另做来源、肖像、商标和模型条款审查。

## 维护规则

1. 新增 vendored 目录前，必须确认许可证允许再分发，并同时保留版权声明与许可证原文。
2. 无许可证、来源不明、仅限商业授权或 copyleft 义务尚未评估的内容，默认改为仓库外安装，不进入公开跟踪树。
3. `cookies*.json`、认证状态、浏览器 profile、`.env*`、可执行文件、压缩包、日志、`node_modules/` 和真实运行产物不得提交。
4. 升级 npm 依赖后，重新检查 `package-lock.json` 中的许可证字段和新增包；字段缺失时不得直接推定为宽松许可证。
5. 外置项目的许可证可能变化；公开发布前应按锁定版本或安装时提交再次核验。

## 本次审计结果

- 公开跟踪树中未发现 `cover-anchor-system`、`guizang-social-card-skill`、`node_modules/`、Cookie、浏览器可执行文件或字体二进制。
- 唯一 vendored 的第三方 skill 为 MIT 的 `xhs-visual-director`，且许可证原文已随目录保留。
- 没有因本次审计删除本地文件；高风险项目继续采用外置安装边界。

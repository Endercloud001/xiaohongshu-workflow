# 集成说明

## 当前边界

本仓库的脚本、文档和模板是宿主无关的，但只在 Windows 本地 Codex 桌面环境中实测过。Claude Code、Codex 或其他宿主只要能运行同样的 Node 命令就能工作，不过宿主差异、终端配置和浏览器可用性需要你自己再确认。

## 工具矩阵

| 集成 | 角色 | 登录态 | 依赖 | 兜底 |
|---|---|---|---|---|
| OpenCLI | 只读研究首选 | 不需要 | 仓库外安装 | redbook / xiaohongshu-mcp |
| redbook | 只读研究增强 | 需要其自身认证 | 仓库外安装 | xiaohongshu-mcp |
| xiaohongshu-mcp | 只读研究兜底 | 需要登录态 | 独立本地服务 | 仅保留降级研究记录 |
| `cover-anchor-system` | 封面 skill | 不需要平台登录态 | 本地显式安装 | `guizang-social-card-skill` → HTML 模板 |
| `xhs-visual-director` | 内页 skill | 不需要平台登录态 | 本地显式安装 | `guizang-social-card-skill` → HTML 模板 |
| `guizang-social-card-skill` | 结构化图文 fallback | 不需要平台登录态 | 本地显式安装 | HTML 模板 |
| Puppeteer | 本地渲染 | 不需要 | npm 安装 | 无 |

## 手动发布边界

仓库只生成 `manual-publish.md` 和发布后补录所需材料，不提供自动发布、自动评论、自动点赞、自动收藏或其他互动操作。

## 公开仓库边界

- 认证数据、Cookie、Token、浏览器 profile 和账号档案都留在仓库外
- 第三方 Skill 只有在明确许可且本地显式安装时才参与路由
- 没有研究后端时，工作流只记录 `degraded`，不会伪造证据

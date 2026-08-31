# 贡献指南

感谢你帮忙维护这个公开仓库。

## 开始前

先读这三份文件：

- [`README.md`](README.md)
- [`00-总览/工作流规格说明.md`](00-总览/工作流规格说明.md)
- [`docs/troubleshooting.md`](docs/troubleshooting.md)

## 提交边界

- 不提交真实账号档案、Cookie、Token、浏览器 profile、真实发布归档、个人绝对路径或私有 Skill
- 不新增自动发布、自动评论、自动点赞、自动收藏或其他互动能力
- 不把未经授权的第三方素材塞进公开树

## 修改前后

提交前至少跑一次：

```bash
npm run check:config
npm run smoke
npm test
npm run verify -- 06-产出/00000000-verify-fixture
```

如果改到安装、外部集成或公开边界，再补跑相关文档检查。

## Issue 和 PR

- Bug 用 bug report 模板
- 新需求用 feature request 模板
- PR 里说明改了什么、为什么改、跑了什么命令、有没有影响公开边界

## 分支与提交

- 保持改动聚焦，别顺手重构别的模块
- 提交信息尽量短而明确
- 版本遵循语义化版本：不兼容改动升 major，兼容新增升 minor，文档和修复升 patch

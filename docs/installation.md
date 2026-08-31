# 安装说明

## 环境

- Node.js >= 20 且 < 25
- npm 10
- Windows 本地环境已实测；仓库脚本不依赖某个 Agent 宿主

## 安装步骤

在仓库根目录执行：

```bash
npm ci
```

首次安装时，Puppeteer 会下载对应浏览器。若下载失败，先检查代理、证书和网络策略，再重试安装。

## 首次验证

```bash
npm test
npm run check:config
npm run smoke
```

这三条只检查公开仓库的确定性基础能力，不需要小红书登录态。

## 夹具验收

```bash
npm run verify -- 06-产出/00000000-verify-fixture
```

如果要检查 HTML 渲染，可再跑：

```bash
npm run render -- 06-产出/00000000-selftest
```

如果要复现“项目目录外、匿名 clone、无可选外部工具”的整套验收流程，请按 [`../05-验收/全新环境验收.md`](../05-验收/全新环境验收.md) 执行。

## 可选外部工具

这些工具不是最小安装前置条件：

- OpenCLI：只读研究首选
- redbook：只读研究增强
- xiaohongshu-mcp：OpenCLI 不可用时的只读研究兜底
- `cover-anchor-system`、`xhs-visual-director`、`guizang-social-card-skill`：可选视觉 skill

外部工具的分发边界和登录态要求见 [`integrations.md`](integrations.md) 与 [`../04-工具/工具映射.md`](../04-工具/工具映射.md)。

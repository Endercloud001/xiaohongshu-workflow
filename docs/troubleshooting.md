# 故障排查

## `npm ci` 失败

先看是否是网络、代理或证书问题。Puppeteer 需要下载浏览器，常见处理顺序是：

```bash
npm ci
```

如果还是失败，修复网络后重试，不要把下载后的浏览器或 `node_modules/` 提交进仓库。

## Node 版本不对

仓库要求 Node.js >= 20 且 < 25。版本不符时，先切到受支持的 Node，再重新跑：

```bash
npm ci
```

## `check:config` 失败

优先检查这些点：

- `package-lock.json` 是否存在
- `.env.example` 是否存在
- `06-产出/00000000-verify-fixture/copy.md` 是否存在
- `XHS_MCP_URL` 是否是合法的 HTTP(S) 地址

命令：

```bash
npm run check:config
```

## `smoke` 或 `test` 失败

先确认浏览器已经成功安装，再看具体报错。`smoke` 只跑本地确定性工具，正常情况下不需要平台登录态。

```bash
npm run smoke
npm test
```

## 研究后端不可用

这是可接受的降级场景。OpenCLI、redbook 或 `xiaohongshu-mcp` 缺一个时，工作流会记录降级，不会把没有对标的内容伪装成已研究结论。

## 视觉 skill 缺失

如果本地没有安装 `cover-anchor-system`、`xhs-visual-director` 或 `guizang-social-card-skill`，路由会继续沿 fallback 链往下走，最终落到 HTML 模板。

## 平台规则变化

如果小红书规则、风控词或登录行为变了，先更新 [`../02-规范/风控清单.md`](../02-规范/风控清单.md) 和 [`../04-工具/工具映射.md`](../04-工具/工具映射.md)，再重新跑验收命令。

## 仍然卡住

把完整命令、退出码和最后一段 stderr 贴出来，优先保留原始输出，不要只给一句“报错了”。

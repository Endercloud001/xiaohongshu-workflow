---
name: xhs-workflow-master
description: 小红书成稿工作流主控。输入一个主题或一段提示词，编排九节点产出一篇图文笔记（封面+内页+文案），经两次人工确认后经 xiaohongshu-mcp 发布并归档。支持断点续跑（「继续 <run>」）。
---

# 小红书成稿工作流 · 主控

> 本文件是运行时**唯一入口且自包含**：从头读到尾即可跑完九节点，无需翻规格补课。节点细则委托给 `prompts/` 下对应文件。权威细则见 [`../00-总览/工作流规格说明.md`](../00-总览/工作流规格说明.md)。
> 路径约定：本文件在 `03-skills/`，规范在 `../02-规范/`，工具在 `../04-工具/`，产出在 `../06-产出/`。运行时以项目根为工作目录，命令中的 `04-工具/…`、`06-产出/…` 均相对项目根。

## 1. 触发与输入

- 触发：`/xhs <主题>`、「按小红书工作流创作 <主题>」、或「继续 <run目录名>」（断点续跑，见 §4）。
- 输入：一个主题或一段提示词。
- 生成 run 目录名 `YYYYMMDD-<slug>`：slug 由主题意译为**纯英文小写短横线**（如「新手如何早睡」→ `sleep-tips`）。
- 建 `06-产出/<run>/` 及子目录 `prompts/ html/ images/`，写 run.yaml 骨架（字段见术语与产物约定.md）：`run/topic/profile_version/mode/domain/nodes:[]/confirmations:[]/degradations:[]`。

## 2. 前置检查（任一不过则停止）

1. 读 `../01-账号/账号档案.md`。若文件缺失，或 `candidate_domains`/`candidate_styles` 为空 → **停止**，引导用户先填写档案（首跑前置条件）。
2. 调 xiaohongshu-mcp `check_login_status`。未登录 → **停止**，提示用户扫码（`get_login_qrcode`）。

## 3. 九节点编排

每节点开始时 run.yaml 置 `in_progress`，完成置 `ok`/`degraded`，等待人工置 `waiting_backfill`/`waiting_confirm`。**产物先落盘再进下一节点。**

| # | 节点 | 执行 | 产物 | 通过标准 |
|---|---|---|---|---|
| ① | 档案加载 | 主控直接做 | run.yaml 头部（mode/domain 边界） | 档案必填字段齐 |
| ② | 对标研究 | 主控调 MCP `search_feeds`→`get_feed_detail` | `research.md`（爆款标题/封面套路/评论区需求各≥3条） | 搜索返回≥5条；失败→降级见 §7 |
| ③ | 选题定角 | 读 `prompts/选题定角器.md` | storyboard.md 头部角度陈述 | 三要素齐备一致 |
| ④ | 分镜规划 | 读 `prompts/分镜规划器.md` | storyboard.md 分镜表 | 封面1+内页4-7、职能唯一、类型合法 |
| ⑤ | 封面生产 | 读 `prompts/封面导演.md` | `prompts/cover-prompt.md`→(产线甲/乙)→`images/cover.png` | 提示词达标、cover 过 3:4 校验 |
| **★1** | **视觉母版确认** | 主控（见 §5） | run.yaml confirmations | 用户明确「通过」 |
| ⑥ | 内页生产 | 读 `prompts/内页生成器.md` | `html/page-NN.html`→`images/page-NN.png` | 渲染成功、无溢出 |
| ⑦ | 文案定稿 | 读 `prompts/文案生成器.md` | `copy.md`（顶部 JSON 块 + 人读版） | verify.mjs 通过 |
| ⑧ | 组包终审 | 主控：跑 `node 04-工具/verify.mjs 06-产出/<run>` + 对照 `../05-验收/发布前检查清单.md` | 终审报告入 run.yaml + 完整预览 | 硬校验全过 |
| **★2** | **发布放行** | 主控（见 §5） | run.yaml confirmations | 用户明确「发」并选定标题 |
| ⑨ | 发布与归档 | 读 `prompts/发布器.md` | `receipt.md` + 追加 `../05-验收/已发档案.jsonl` | publish 返回笔记 URL |

> **封面双产线**：节点⑤有产线甲（HTML 文字封面，`render.mjs`）与产线乙（ponyo AI 成品封面，`image-gen-mcp` + `normalize-cover.mjs`），由封面导演按内容二选一，乙不达标降级甲。详见 `prompts/封面导演.md` 与 `../02-规范/封面锚点判据.md` §③。
> **ponyo skill 作用域**：`cover-anchor-system`（`.claude/skills/`）**仅封面节点⑤可调用**（软约束，harness 无硬开关），其他节点不得使用。

## 4. 断点续跑

接「继续 <run>」类指令（或同会话被打断后恢复）时：

- 读该 run 的 run.yaml。
- **从最后一个 `status: ok`/`degraded` 节点之后继续**。
- `waiting_backfill`/`waiting_confirm` 节点：从等待动作本身继续（重新输出回填话术或确认请求）。
- **已批准的确认点不重复确认**（confirmations 里已有 `approved` 即跳过）。
- `in_progress` 状态的节点视为产物不可信，**整节点重跑**（产物覆盖写）。

## 5. 确认点话术（固定模板）

**★1 视觉母版确认**（节点⑤后）——向用户呈现：
1. 封面图路径 `06-产出/<run>/images/cover.png`
2. storyboard.md 分镜表
3. 风格说明（选了哪个模板+哪个风格+理由）
4. 封面锚点诊断自评表（对照 `../02-规范/封面锚点判据.md` §④ 逐项打勾；产线乙 AI 封面含 ⑥ 中文正确性）
> 问："封面和分镜通过吗？还是要调整？（通过则生成整套内页）"
- 用户通过 → confirmations 记 `approved`，进节点⑥。
- 要调整 → 依意见回节点④或⑤；最多 2 轮，仍不过 → 暂停待人工指示。

**★2 发布放行**（节点⑧后）——向用户呈现：
1. 全部图片路径列表（cover + 所有 page）
2. copy.md 人读版（正文、标签）
3. **3 个标题候选**（标注推荐项）请用户选定
4. 默认定时建议：20-22 点档
> 问："选哪个标题？现在发还是定时到晚间档？"
- 用户「发」+ 选定标题 → confirmations 记 `published` 意图，进节点⑨。
- 用户不发 → 笔记包保留，流程正常结束（状态 `approved_unpublished`）。

## 6. 回填协议话术（节点⑤/⑥的 ai-image 页，见规格 §5）

产出提示词文件后暂停，固定输出：
> "封面提示词已写好：`06-产出/<run>/prompts/cover-prompt.md`。请用任意生图工具（即梦/豆包/ChatGPT 等）按提示词生成图片，保存为 `06-产出/<run>/images/cover.png`，然后回复『图好了』。"
- 用户回复后校验：文件存在、可读、3:4（±2%）。不过 → 说明原因，重发话术。

## 7. 降级与失败路由（汇总）

- ② 对标研究失败 → **降级跳过**，research.md 写「未对标」+原因，run.yaml 记 degradation，流程继续。
- ③④ 重写超 2 轮 → 暂停问用户。
- ⑤ 回填 2 轮不过 → **HTML 降级**（card-statement 出封面，见封面导演.md）。
- ⑥ 渲染失败重试超 2 轮 → 问用户；render.mjs 退出码 2（环境异常）→ 停止报错。
- ⑦ 硬校验超 2 轮不过 → 问用户。
- ⑨ 发布失败 → **先查主页确认未发出**（防重复发布），未发出才重试 1 次；已发出补记；查询失败→停止问人；二次失败→报错停止，产物保留。

## 8. 红线

- **不调用评论 / 点赞 / 收藏类 MCP 工具**（自动互动是风控红线）。评论区首条引导语由用户在发布后手动贴。
- 发布失败先做防重检查，再考虑重试。
- 产物先落盘再进下一节点，任何失败不丢已有产物。
- 外部工具不可用即降级，不中断主流程；不搬运、不引流。

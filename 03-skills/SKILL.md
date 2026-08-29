---
name: xhs-workflow-master
description: 小红书成稿工作流主控。输入一个主题或一段提示词，编排 12 节点产出一篇图文笔记（封面 + 内页 + 文案），经双闸门复核后产出人工发布包（Publish Pack），发布由用户手动完成后补录归档。支持断点续跑（「继续 <run>」）。
---

# 小红书成稿工作流 · 主控

> 本文件是运行时唯一入口。节点细则委托给 `prompts/` 下对应文件；权威细则见 [`../00-总览/工作流规格说明.md`](../00-总览/工作流规格说明.md)。
> 路径约定：本文件在 `03-skills/`，规范在 `../02-规范/`，工具在 `../04-工具/`，产出在 `../06-产出/`。运行时以项目根为工作目录。

## 1. 触发与输入

- 触发：`/xhs <主题>`、「按小红书工作流创作 <主题>」、或「继续 <run目录名>」。
- 输入：一个主题或一段提示词。
- 生成 run 目录名 `YYYYMMDD-<slug>`：slug 由主题意译为纯英文小写短横线。
- 建 `06-产出/<run>/` 及子目录 `prompts/ html/ images/ assets/`，写 run.yaml 骨架：`run/topic/profile_version/mode/domain/nodes/confirmations/degradations`。

## 2. 前置检查

1. 读 `../01-账号/账号档案.md`。若文件缺失，或 `candidate_domains`/`candidate_styles` 为空，则停止并引导用户先填写档案。
2. 做研究后端体检：
   - 先跑 `agent-reach doctor --json`，读取 `xiaohongshu.active_backend`。
   - 若 `OpenCLI` 可用，研究节点走首选后端。
   - 若不可用，再检查 xiaohongshu-mcp 的 `check_login_status`。
   - 两者皆不可用时，不阻断全流程，但 research 节点须预记为将降级执行。
3. 检查 `03-skills/style-registry.yaml` 存在，且所列 skill 目录存在。缺失项在路由时不可选，并须写入降级说明。

## 3. 12 节点编排

每节点开始时 run.yaml 置 `in_progress`，完成置 `ok`/`degraded`，等待人工时置 `waiting_backfill`/`waiting_confirm`。产物先落盘再进下一节点。

| # | 节点 | 执行 | 产物 | 通过标准 |
|---|---|---|---|---|
| ① | 档案加载 | 主控直接做 | run.yaml 头部（mode/domain 边界） | 档案必填字段齐 |
| ② | 只读研究 | 主控：首选 agent-reach OpenCLI；增强 redbook（若已装）；兜底 xiaohongshu-mcp | `research.md` + `research-evidence.json` | 搜到足够证据，或合法降级 |
| ③ | Topic Gate | 读 `prompts/选题闸门.md` | `topic-gate.md` + `topic-score.json` | verdict 为 `go` 或给出合法 `revise/reject` |
| ④ | 选题定角 | 读 `prompts/选题定角器.md` | storyboard.md 头部角度陈述 | 三要素齐备一致 |
| ⑤ | 分镜规划 | 读 `prompts/分镜规划器.md` | storyboard.md 分镜表 | 封面 1 + 内页 4-7，职能唯一 |
| ⑥ | Style Router | 读 `style-router.md` | `prompts/style-decision.md` + run.yaml `visual_router` | 路由决策完整可解释 |
| ⑦ | 封面生产 | 读 `prompts/封面导演.md` | `prompts/cover-prompt.md` 或 html 中间产物 → `images/cover.png` | 通过 3:4 校验 |
| ★1 | 视觉母版确认 | 主控（见 §5） | run.yaml confirmations | 用户明确通过 |
| ⑧ | 内页生产 | 读 `prompts/内页生成器.md` | `prompts/inner-master.md` + `images/page-NN.png` | 每页成图合法 |
| ⑨ | Visual Gate | 读 `prompts/视觉复核器.md` | `visual-gate.md` + `visual-review.json` | 全套 `pass` 或按页 fallback 后可用 |
| ⑩ | 文案定稿 | 读 `prompts/文案生成器.md` | `copy.md` | verify 所需字段齐全 |
| ⑪ | 组包终审 | 主控：跑 `node 04-工具/verify.mjs 06-产出/<run>` + 对照 `../05-验收/发布前检查清单.md` | 终审报告入 run.yaml + 完整预览 | 硬校验全过 |
| ★2 | 发布包确认 | 主控（见 §5） | run.yaml confirmations | 用户明确确认发布包 |
| ⑫ | Publish Pack | 读 `prompts/发布包生成器.md` | `manual-publish.md`；手动发布后补录 `receipt.md` | 发布包就绪或补录完成 |

> 封面、内页的具体技能选择遵从 [`style-registry.yaml`](./style-registry.yaml) 与 [`style-router.md`](./style-router.md)。
> xiaohongshu-mcp 自本版起只作为研究兼容后端保留，不再作为发布通道。

## 4. 断点续跑

接到「继续 <run>」时：

- 读该 run 的 run.yaml。
- 从最后一个 `status: ok/degraded` 节点之后继续。
- `waiting_backfill`/`waiting_confirm` 节点从等待动作本身继续。
- 已批准的确认点不重复确认。
- `in_progress` 状态的节点视为产物不可信，整节点重跑。
- `workflow_mode` 缺失时，视作旧版 run，按旧语义续跑；新 run 写 `workflow_mode: slim_manual_publish`。

## 5. 确认点话术

**★1 视觉母版确认**（节点 ⑦ 后）向用户呈现：
1. `06-产出/<run>/images/cover.png`
2. `storyboard.md` 分镜表
3. `prompts/style-decision.md` 的风格说明
4. 封面锚点诊断自评表
5. `prompts/inner-master.md` 的内页母版说明（如已生成）

固定提问：
> 「封面和分镜通过吗？还是要调整？通过后我继续生成整套内页。」

**★2 发布包确认**（节点 ⑪ 后）向用户呈现：
1. `manual-publish.md` 预览
2. 3 个标题候选（标注推荐项）
3. 图片顺序清单（cover → page-01 → …）

固定话术：
> 「发布包已就绪：`06-产出/<run>/manual-publish.md`。请确认标题与图片顺序。发布由你手动完成；发布后把笔记链接发我，我来补录归档（可顺带做限流检测）。」

- 用户确认后，run.yaml `publish.status` 记为 `package_ready`。
- 不再出现「现在发还是定时」话术。

## 6. 回填协议

产出提示词文件后暂停，固定输出：
> 「提示词已写好：`06-产出/<run>/prompts/<file>.md`。请用任意生图工具生成图片，保存到指定路径，然后回复『图好了』。」

- 用户回复后校验：文件存在、可读、3:4（±2%）。
- 不过则说明原因并重发话术。

## 7. 降级与失败路由

- ② 研究后端不可用：research 降级执行，`research.md` 写明原因，run.yaml 记 `degraded`。
- ③ `topic_gate=reject`：流程终止，并给出改题建议。
- ③ `topic_gate=revise`：回到 ② 补充研究或换角度，最多 2 轮。
- ⑥ 路由命中拒绝规则：返回分镜层，改用实拍回填协议或改题。
- ⑦/⑧ AI 产线失败：按当前页或当前角色的 fallback 链降级。
- ⑨ `visual_gate` 单页 `fallback`：按 `style-registry.yaml` 的 fallback 链重做该页，run.yaml 记 degradation。
- ⑪ verify 失败：回对应节点修复。
- 手动发布后若用户未回链，流程可停在 `publish.status: package_ready`。

## 8. 红线

- 不调用评论 / 点赞 / 收藏类工具。
- 不调用 `publish_content`。发布动作只能由用户手动完成。
- 产物先落盘再进下一节点，任何失败不丢已有产物。
- 外部工具不可用即降级，不中断主流程。

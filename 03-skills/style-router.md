# Style Router

> 本文件定义封面 / 内页技能的显式路由规则。

## 1. 三种模式

1. 手动指定
   - 用户明确说「封面用 X / 内页用 Y」时，直接生效，并写入 run.yaml `visual_router.mode = manual`
2. 半自动
   - 用户只给风格家族（暖纸手绘 / 瑞士理性 / 杂志叙事 / 高对比信息卡），按 `style-registry.yaml` 的 `families` 映射
3. 自动路由（默认）
   - 封面：情绪 / 场景 / 人物题 → `cover-anchor-system`
   - 封面：纯文字 / 数字冲击 → `cover-anchor-system`
   - 封面：中文极密 → `guizang-social-card-skill`
   - 内页：强视觉叙事页 → `xhs-visual-director`
   - 内页：清单 / 对比 / 数据 / 密集中文页 → `guizang-social-card-skill`
   - 全部失败 → `html-templates`

## 2. 拒绝规则

路由前先判题材是否属于以下能力圈外内容：

- 日常 OOTD 全身
- 美食摆盘大片
- 梦核 / 氛围装饰
- Y2K 装饰系

命中任一项时，任何 skill 都不接，回到分镜或选题层，改用实拍回填协议或改题。

## 3. 产物

- 写 `06-产出/<run>/prompts/style-decision.md`
- 更新 run.yaml：

```yaml
visual_router:
  mode: auto | semi | manual
  cover_skill: cover-anchor-system
  inner_skill: xhs-visual-director
  fallback_skill: guizang-social-card-skill
```

## 4. 记录要求

- 说明为什么选这个 skill
- 若有缺失目录或依赖不可用，必须写入 `degradations`
- fallback 链只允许沿 `style-registry.yaml` 执行，不可临时发明新路径
